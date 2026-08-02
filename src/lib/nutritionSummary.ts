/**
 * lib/nutritionSummary.ts
 * Calcule les besoins en glucides de tous les jours d'une sortie — partagé
 * entre la route API nutrition (étape 6) et la fiche d'export PDF (étape 8)
 * pour éviter de dupliquer la logique d'agrégation.
 */
import { getTripPoints, getDays } from "@/lib/db";
import { computeDayStats } from "@/modules/planning/dayBuilder";
import { computeDayNutrition } from "@/modules/nutrition/carbsCalc";
import { DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import type { DayNutrition, Trip } from "@/types";

export async function computeAllDayNutrition(tripId: string, trip: Trip): Promise<DayNutrition[]> {
  const days = await getDays(tripId);
  if (days.length === 0) return [];

  const points = await getTripPoints(tripId);
  const paceParams = trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS;

  return days.map((d) => {
    const stats = computeDayStats(points, d.start_point_index, d.end_point_index, paceParams);
    return computeDayNutrition(
      d.day_index,
      { elevGainM: stats.elev_gain_m, durationH: stats.duration_h, flatSpeedKmh: paceParams.speed_kmh },
      d.nutrition_override_g_h
    );
  });
}
