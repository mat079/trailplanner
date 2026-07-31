/**
 * modules/planning/dayBuilder.ts
 * Découpage automatique d'une trace en jours, à partir des points bruts.
 */
import type { GpxPoint, PaceParams, TripDay, DayWithStats } from "@/types";
import { estimateDurationHours, validatePaceParams } from "./paceModel";
import { nearestIndexByDistance } from "@/lib/utils";

export interface BuiltDay {
  day_index: number;
  start_point_index: number;
  end_point_index: number;
  distance_m: number;
  elev_gain_m: number;
  elev_loss_m: number;
  duration_h: number;
}

/**
 * Découpe les points bruts en jours selon le budget horaire.
 * Garantit une progression d'au moins un point par jour (termine toujours),
 * même si un unique segment dépasse déjà le budget horaire à lui seul.
 */
export function buildDays(points: GpxPoint[], params: PaceParams): BuiltDay[] {
  if (points.length < 2) {
    throw new Error("Trace insuffisante pour un découpage (moins de 2 points).");
  }
  validatePaceParams(params);

  const days: BuiltDay[] = [];
  let dayStart = 0;
  let dayIndex = 0;

  while (dayStart < points.length - 1) {
    let cursor = dayStart;
    let distM = 0;
    let elevGain = 0;
    let elevLoss = 0;

    while (cursor < points.length - 1) {
      const next = cursor + 1;
      const segDist = points[next].dist_cumul - points[cursor].dist_cumul;
      const segEleDelta = points[next].ele - points[cursor].ele;
      const segGain = Math.max(0, segEleDelta);
      const segLoss = Math.max(0, -segEleDelta);

      const projectedDuration = estimateDurationHours(
        distM + segDist,
        elevGain + segGain,
        params
      );

      if (projectedDuration > params.hours_per_day && cursor > dayStart) {
        break;
      }

      distM += segDist;
      elevGain += segGain;
      elevLoss += segLoss;
      cursor = next;

      if (projectedDuration > params.hours_per_day) break;
    }

    days.push({
      day_index: dayIndex,
      start_point_index: dayStart,
      end_point_index: cursor,
      distance_m: distM,
      elev_gain_m: elevGain,
      elev_loss_m: elevLoss,
      duration_h: estimateDurationHours(distM, elevGain, params),
    });

    dayIndex++;
    dayStart = cursor;
  }

  return days;
}

/** Recherche par dichotomie du point brut le plus proche d'une distance cumulée donnée. */
export function findNearestPointIndex(points: GpxPoint[], targetDistM: number): number {
  return nearestIndexByDistance(points, targetDistM);
}

/** Recalcule les stats (distance/D+/D-/durée) d'un jour à partir des points bruts. */
export function computeDayStats(
  points: GpxPoint[],
  startIndex: number,
  endIndex: number,
  params: PaceParams
): Omit<BuiltDay, "day_index" | "start_point_index" | "end_point_index"> {
  let distM = 0;
  let elevGain = 0;
  let elevLoss = 0;
  for (let i = startIndex; i < endIndex; i++) {
    const segDist = points[i + 1].dist_cumul - points[i].dist_cumul;
    const segEleDelta = points[i + 1].ele - points[i].ele;
    distM += segDist;
    elevGain += Math.max(0, segEleDelta);
    elevLoss += Math.max(0, -segEleDelta);
  }
  return {
    distance_m: distM,
    elev_gain_m: elevGain,
    elev_loss_m: elevLoss,
    duration_h: estimateDurationHours(distM, elevGain, params),
  };
}

/** Enrichit des jours persistés avec les stats dérivées des points bruts (source unique de vérité). */
export function attachStats(days: TripDay[], points: GpxPoint[], params: PaceParams): DayWithStats[] {
  return days.map((d) => ({
    ...d,
    ...computeDayStats(points, d.start_point_index, d.end_point_index, params),
    start_dist_m: points[d.start_point_index]?.dist_cumul ?? 0,
    end_dist_m: points[d.end_point_index]?.dist_cumul ?? 0,
  }));
}

/** Calcule la date ISO (YYYY-MM-DD) d'un jour à partir de la date de départ. */
export function computeDayDate(startDateISO: string | null, dayIndex: number): string | null {
  if (!startDateISO) return null;
  const d = new Date(startDateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}
