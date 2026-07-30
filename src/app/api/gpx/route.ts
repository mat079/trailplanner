/**
 * app/api/gpx/route.ts
 * Upload, parse et stockage d'un fichier GPX.
 *
 * Sécurité :
 *  - Taille max 20 Mo (rejet avant parse)
 *  - Parsing via fast-xml-parser (pur JS, pas de DTD/ENTITY → XXE impossible)
 *  - Validation du format GPX (namespace, élément racine)
 *
 * Performance :
 *  - Points bruts stockés via saveTrip (DB avec fallback mémoire)
 *  - Points simplifiés retournés dans la réponse (Douglas-Peucker)
 */

import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { saveTrip } from "@/lib/db";
import { douglasPeucker } from "@/modules/gpx/simplify";
import type { GpxPoint, TripMetadata, ApiResponse, Trip } from "@/types";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
});

interface RawGpxTrkpt {
  "@_lat": number;
  "@_lon": number;
  ele?: number;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseGpxPoints(xmlText: string): GpxPoint[] {
  const parsed = parser.parse(xmlText);
  const gpx = parsed?.gpx;
  if (!gpx) throw new Error("Fichier GPX invalide (élément <gpx> manquant).");

  const trk = gpx.trk;
  if (!trk) throw new Error("Aucune trace (<trk>) trouvée dans le fichier GPX.");

  const trkArray = Array.isArray(trk) ? trk : [trk];
  const allTrkpts: RawGpxTrkpt[] = [];

  for (const t of trkArray) {
    const trkseg = t.trkseg;
    if (!trkseg) continue;
    const segArray = Array.isArray(trkseg) ? trkseg : [trkseg];
    for (const seg of segArray) {
      const trkpt = seg.trkpt;
      if (!trkpt) continue;
      const pts = Array.isArray(trkpt) ? trkpt : [trkpt];
      allTrkpts.push(...pts);
    }
  }

  if (allTrkpts.length < 2) {
    throw new Error("La trace GPX contient moins de 2 points.");
  }

  let distCumul = 0;
  const points: GpxPoint[] = allTrkpts.map((pt, i) => {
    const lat = Number(pt["@_lat"]);
    const lon = Number(pt["@_lon"]);
    const ele = Number(pt.ele ?? 0);

    if (i > 0) {
      const prev = allTrkpts[i - 1];
      distCumul += haversineM(
        Number(prev["@_lat"]), Number(prev["@_lon"]),
        lat, lon
      );
    }

    return { lat, lon, ele, dist_cumul: distCumul, order_index: i };
  });

  return points;
}

function computeMetadata(points: GpxPoint[]): TripMetadata {
  let elevGain = 0;
  let elevLoss = 0;
  let maxEle = -Infinity;
  let minEle = Infinity;

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].ele - points[i - 1].ele;
    if (delta > 0) elevGain += delta;
    else elevLoss += Math.abs(delta);
    maxEle = Math.max(maxEle, points[i].ele);
    minEle = Math.min(minEle, points[i].ele);
  }
  if (points[0]) {
    maxEle = Math.max(maxEle, points[0].ele);
    minEle = Math.min(minEle, points[0].ele);
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);

  return {
    distance_m: points[points.length - 1]?.dist_cumul ?? 0,
    elev_gain_m: elevGain,
    elev_loss_m: elevLoss,
    max_ele_m: maxEle === -Infinity ? 0 : maxEle,
    min_ele_m: minEle === Infinity ? 0 : minEle,
    point_count: points.length,
    bbox: {
      min_lat: Math.min(...lats),
      max_lat: Math.max(...lats),
      min_lon: Math.min(...lons),
      max_lon: Math.max(...lons),
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Partial<Trip>>>> {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Fichier trop volumineux (max 20 Mo)." },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("session_id") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Aucun fichier reçu." }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id manquant." }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Fichier trop volumineux (max 20 Mo)." },
        { status: 413 }
      );
    }

    const xmlText = await file.text();

    let points: GpxPoint[];
    try {
      points = parseGpxPoints(xmlText);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Fichier GPX invalide." },
        { status: 422 }
      );
    }

    const metadata = computeMetadata(points);
    const cleanName = file.name.replace(/\.gpx$/i, "").replace(/[_-]/g, " ").trim();
    const tripName = cleanName.length > 0 ? cleanName : "Ma sortie";

    // Enregistre le trip via saveTrip (PostgreSQL + Fallback mémoire automatique)
    const trip = await saveTrip(
      {
        session_id: sessionId,
        name: tripName,
        start_date: null,
        gpx_raw: xmlText,
        metadata,
      },
      points
    );

    const simplified = douglasPeucker(points, 10);

    return NextResponse.json({
      ok: true,
      data: {
        id: trip.id,
        name: trip.name,
        metadata,
        simplified_points: simplified,
      },
    });
  } catch (err) {
    console.error("[api/gpx] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors du traitement du fichier GPX." },
      { status: 500 }
    );
  }
}
