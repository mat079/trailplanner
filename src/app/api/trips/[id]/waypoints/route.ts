/**
 * app/api/trips/[id]/waypoints/route.ts
 * Points d'étape (bivouac / ravitaillement / checkpoint) — étape 3.
 *
 * POST : snappe un lat/lon cliqué sur la trace brute la plus proche et le sauvegarde.
 * GET  : liste les points d'étape, ordonnés le long de la trace.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, getDays, saveWaypoint, getWaypoints } from "@/lib/db";
import { snapToTrace, resolveDayIndex } from "@/modules/gpx/snap";
import type { ApiResponse, Waypoint, WaypointType } from "@/types";

const WAYPOINT_TYPES: WaypointType[] = ["bivouac", "ravitaillement", "checkpoint"];

function isValidCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ waypoint: Waypoint }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const type = body?.type;
    const lat = body?.lat;
    const lon = body?.lon;
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null;

    if (!WAYPOINT_TYPES.includes(type)) {
      return NextResponse.json(
        { ok: false, error: "Type de point d'étape invalide (bivouac, ravitaillement ou checkpoint)." },
        { status: 400 }
      );
    }
    if (!isValidCoord(lat, lon)) {
      return NextResponse.json({ ok: false, error: "Coordonnées lat/lon invalides." }, { status: 400 });
    }

    const points = await getTripPoints(id);
    if (points.length === 0) {
      return NextResponse.json({ ok: false, error: "Trace introuvable pour cette sortie." }, { status: 422 });
    }

    const snapped = snapToTrace(points, lat, lon);
    const days = await getDays(id);
    const dayIndex = resolveDayIndex(days, snapped.point_index);

    const waypoint = await saveWaypoint(id, {
      type,
      label,
      lat: snapped.lat,
      lon: snapped.lon,
      ele: snapped.ele,
      point_index: snapped.point_index,
      dist_cumul: snapped.dist_cumul,
      day_index: dayIndex,
    });

    return NextResponse.json({ ok: true, data: { waypoint } });
  } catch (err) {
    console.error("[api/trips/[id]/waypoints][POST] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la création du point d'étape." },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ waypoints: Waypoint[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }
    const waypoints = await getWaypoints(id);
    return NextResponse.json({ ok: true, data: { waypoints } });
  } catch (err) {
    console.error("[api/trips/[id]/waypoints][GET] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération des points d'étape." },
      { status: 500 }
    );
  }
}
