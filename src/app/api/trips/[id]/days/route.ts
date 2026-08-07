/**
 * app/api/trips/[id]/days/route.ts
 * Découpage automatique en jours (étape 2).
 *
 * POST  : calcule et sauvegarde le découpage à partir de pace_params.
 * GET   : renvoie le découpage existant, stats recalculées à la volée.
 * PATCH : ajustement manuel d'un point de coupure (snap au point brut le plus proche).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, getDays, saveDays, updateDay, updateTripPaceParams, getWaypoints } from "@/lib/db";
import {
  buildDays,
  attachStats,
  computeDayDate,
  findNearestPointIndex,
  bivouacCutIndices,
} from "@/modules/planning/dayBuilder";
import { DEFAULT_PACE_PARAMS, validatePaceParams } from "@/modules/planning/paceModel";
import type { ApiResponse, DayWithStats, PaceParams, TripDay } from "@/types";

function isPaceParams(v: unknown): v is PaceParams {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.speed_kmh === "number" &&
    typeof p.elev_coeff_min_per_100m === "number" &&
    typeof p.hours_per_day === "number"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ days: DayWithStats[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const paceParams = body?.pace_params;
    if (!isPaceParams(paceParams)) {
      return NextResponse.json({ ok: false, error: "pace_params manquant ou invalide." }, { status: 400 });
    }
    try {
      validatePaceParams(paceParams);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Paramètres invalides." },
        { status: 400 }
      );
    }

    const points = await getTripPoints(id);
    if (points.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Trace insuffisante pour calculer un découpage." },
        { status: 422 }
      );
    }

    const waypoints = await getWaypoints(id);
    const built = buildDays(points, paceParams, bivouacCutIndices(waypoints));
    const days: TripDay[] = built.map((d) => ({
      trip_id: id,
      day_index: d.day_index,
      start_point_index: d.start_point_index,
      end_point_index: d.end_point_index,
      label: null,
      bivouac_lat: null,
      bivouac_lon: null,
      bivouac_ele: null,
      date: computeDayDate(trip.start_date, d.day_index),
      nutrition_override_g_h: null,
    }));

    const saved = await saveDays(id, days);
    await updateTripPaceParams(id, paceParams);

    return NextResponse.json({ ok: true, data: { days: attachStats(saved, points, paceParams) } });
  } catch (err) {
    console.error("[api/trips/[id]/days][POST] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors du calcul du découpage." },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ days: DayWithStats[]; pace_params: PaceParams }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const paceParams = trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS;
    const days = await getDays(id);
    if (days.length === 0) {
      return NextResponse.json({ ok: true, data: { days: [], pace_params: paceParams } });
    }

    const points = await getTripPoints(id);
    return NextResponse.json({
      ok: true,
      data: { days: attachStats(days, points, paceParams), pace_params: paceParams },
    });
  } catch (err) {
    console.error("[api/trips/[id]/days][GET] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération du découpage." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ days: DayWithStats[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const boundaryIndex = body?.boundary_index;
    const newDistCumulM = body?.new_dist_cumul_m;
    if (typeof boundaryIndex !== "number" || typeof newDistCumulM !== "number") {
      return NextResponse.json(
        { ok: false, error: "boundary_index et new_dist_cumul_m sont requis." },
        { status: 400 }
      );
    }

    const days = await getDays(id);
    if (days.length < 2 || boundaryIndex < 0 || boundaryIndex > days.length - 2) {
      return NextResponse.json(
        { ok: false, error: "Point de coupure invalide pour ce découpage." },
        { status: 400 }
      );
    }

    const points = await getTripPoints(id);
    const dayBefore = days[boundaryIndex];
    const dayAfter = days[boundaryIndex + 1];

    // Garantit au moins un segment de chaque côté du point de coupure.
    const minIndex = dayBefore.start_point_index + 1;
    const maxIndex = dayAfter.end_point_index - 1;
    if (minIndex > maxIndex) {
      return NextResponse.json(
        { ok: false, error: "Pas assez de points pour ajuster ce point de coupure." },
        { status: 422 }
      );
    }

    let newIndex = findNearestPointIndex(points, newDistCumulM);
    newIndex = Math.min(Math.max(newIndex, minIndex), maxIndex);

    const updatedBefore: TripDay = { ...dayBefore, end_point_index: newIndex };
    const updatedAfter: TripDay = { ...dayAfter, start_point_index: newIndex };

    await updateDay(id, updatedBefore);
    await updateDay(id, updatedAfter);

    const updatedDays = [...days];
    updatedDays[boundaryIndex] = updatedBefore;
    updatedDays[boundaryIndex + 1] = updatedAfter;

    const paceParams = trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS;
    return NextResponse.json({ ok: true, data: { days: attachStats(updatedDays, points, paceParams) } });
  } catch (err) {
    console.error("[api/trips/[id]/days][PATCH] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de l'ajustement du point de coupure." },
      { status: 500 }
    );
  }
}
