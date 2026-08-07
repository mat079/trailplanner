/**
 * app/api/trips/[id]/waypoints/[waypointId]/route.ts
 * Suppression d'un point d'étape.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, getDays, saveDays, getWaypoints, deleteWaypoint, setDayBivouac } from "@/lib/db";
import { buildDays, attachStats, computeDayDate, bivouacCutIndices } from "@/modules/planning/dayBuilder";
import { DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import type { ApiResponse, DayWithStats, TripDay } from "@/types";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; waypointId: string }> }
): Promise<NextResponse<ApiResponse<{ deleted: true; days?: DayWithStats[] }>>> {
  try {
    const { id, waypointId } = await params;
    const numericId = Number(waypointId);
    if (!Number.isInteger(numericId)) {
      return NextResponse.json({ ok: false, error: "Identifiant de point d'étape invalide." }, { status: 400 });
    }

    const deleted = await deleteWaypoint(id, numericId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Point d'étape introuvable." }, { status: 404 });
    }

    if (deleted.type === "bivouac" && deleted.day_index !== null) {
      try {
        await setDayBivouac(id, deleted.day_index, null);
      } catch (bivouacErr) {
        console.warn(
          "[api/trips/[id]/waypoints/[waypointId]][DELETE] Échec effacement bivouac_* du jour:",
          (bivouacErr as Error).message
        );
      }
    }

    // Symétrique du POST : un bivouac supprimé n'est plus une fin de journée
    // obligatoire — on recalcule pour fusionner cette journée avec la suivante
    // (le budget horaire reprend simplement là où ce bivouac ne coupe plus).
    let recomputedDays: DayWithStats[] | undefined;
    if (deleted.type === "bivouac") {
      const days = await getDays(id);
      if (days.length > 0) {
        const trip = await getTrip(id);
        if (trip) {
          const points = await getTripPoints(id);
          const remainingWaypoints = await getWaypoints(id);
          const paceParams = trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS;
          const built = buildDays(points, paceParams, bivouacCutIndices(remainingWaypoints));
          const rebuilt: TripDay[] = built.map((d) => ({
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
          const saved = await saveDays(id, rebuilt);
          recomputedDays = attachStats(saved, points, paceParams);
        }
      }
    }

    return NextResponse.json({ ok: true, data: { deleted: true, days: recomputedDays } });
  } catch (err) {
    console.error("[api/trips/[id]/waypoints/[waypointId]][DELETE] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la suppression du point d'étape." },
      { status: 500 }
    );
  }
}
