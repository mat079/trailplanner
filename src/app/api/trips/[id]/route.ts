/**
 * app/api/trips/[id]/route.ts
 * Récupération d'une sortie par son ID (metadata + points simplifiés + points bruts).
 */

import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, updateTripStartDate } from "@/lib/db";
import { douglasPeucker, adaptiveEpsilon } from "@/modules/gpx/simplify";
import type { ApiResponse, Trip, GpxPointSimplified } from "@/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ trip: Trip; simplified_points: GpxPointSimplified[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);

    if (!trip) {
      return NextResponse.json(
        { ok: false, error: "Sortie introuvable." },
        { status: 404 }
      );
    }

    const points = await getTripPoints(id);
    const eps = adaptiveEpsilon(points.length);
    const simplified = douglasPeucker(points, eps);

    return NextResponse.json({
      ok: true,
      data: {
        trip,
        simplified_points: simplified,
      },
    });
  } catch (err) {
    console.error("[api/trips/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération de la sortie." },
      { status: 500 }
    );
  }
}

/**
 * Met à jour la date de départ de la sortie (nécessaire pour la météo et les
 * dates par jour). Body : { start_date: "YYYY-MM-DD" | null }.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ trip: Trip }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!("start_date" in (body ?? {}))) {
      return NextResponse.json({ ok: false, error: "start_date requis (YYYY-MM-DD ou null)." }, { status: 400 });
    }
    const startDate = body.start_date;
    if (startDate !== null && (typeof startDate !== "string" || !ISO_DATE_RE.test(startDate))) {
      return NextResponse.json(
        { ok: false, error: "start_date doit être au format YYYY-MM-DD ou null." },
        { status: 400 }
      );
    }

    const updated = await updateTripStartDate(id, startDate);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: { trip: updated } });
  } catch (err) {
    console.error("[api/trips/[id]][PATCH] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la mise à jour de la sortie." },
      { status: 500 }
    );
  }
}
