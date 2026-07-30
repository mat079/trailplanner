/**
 * app/api/trips/[id]/route.ts
 * Récupération d'une sortie par son ID (metadata + points simplifiés + points bruts).
 */

import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints } from "@/lib/db";
import { douglasPeucker, adaptiveEpsilon } from "@/modules/gpx/simplify";
import type { ApiResponse, Trip, GpxPointSimplified } from "@/types";

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
