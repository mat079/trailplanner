/**
 * modules/nutrition/carbsCalc.ts
 * Estimation des besoins en glucides/heure à partir de l'intensité d'un jour.
 *
 * L'intensité est dérivée du rythme de montée (D+/h, signal dominant en
 * randonnée/trail) et, à défaut de dénivelé significatif, de la vitesse à
 * plat de référence (permet de distinguer une journée plate rapide d'une
 * journée plate tranquille).
 */
import type { DayNutrition, IntensityZone } from "@/types";

/** Rythme de montée (m/h) à partir duquel on considère l'effort en zone "tempo". */
export const CLIMB_RATE_TEMPO_M_H = 250;
/** Rythme de montée (m/h) à partir duquel on considère l'effort en zone "seuil". */
export const CLIMB_RATE_THRESHOLD_M_H = 500;
/** Vitesse à plat (km/h) à partir de laquelle on considère l'effort en zone "tempo". */
export const FLAT_SPEED_TEMPO_KMH = 6;
/** Vitesse à plat (km/h) à partir de laquelle on considère l'effort en zone "seuil". */
export const FLAT_SPEED_THRESHOLD_KMH = 9;

/** Recommandation g/h de glucides par zone d'intensité (repères usuels en nutrition sportive). */
export const CARBS_PER_HOUR_BY_ZONE: Record<IntensityZone, number> = {
  endurance: 45,
  tempo: 75,
  threshold: 100,
};

export interface DayEffort {
  elevGainM: number;
  durationH: number;
  /** Vitesse à plat de référence (paramètre de rythme du jour). */
  flatSpeedKmh: number;
}

/** Estime la zone d'intensité d'un jour à partir du D+/h et de la vitesse à plat. */
export function estimateIntensityZone(effort: DayEffort): IntensityZone {
  const climbRateMH = effort.durationH > 0 ? effort.elevGainM / effort.durationH : 0;

  if (climbRateMH >= CLIMB_RATE_THRESHOLD_M_H || effort.flatSpeedKmh >= FLAT_SPEED_THRESHOLD_KMH) {
    return "threshold";
  }
  if (climbRateMH >= CLIMB_RATE_TEMPO_M_H || effort.flatSpeedKmh >= FLAT_SPEED_TEMPO_KMH) {
    return "tempo";
  }
  return "endurance";
}

/**
 * Calcule les besoins en glucides d'un jour. `overrideGH` (saisie manuelle de
 * l'utilisateur) prime toujours sur la recommandation automatique.
 */
export function computeDayNutrition(
  dayIndex: number,
  effort: DayEffort,
  overrideGH: number | null
): DayNutrition {
  const intensity = estimateIntensityZone(effort);
  const carbsPerHourG = CARBS_PER_HOUR_BY_ZONE[intensity];
  const effectiveGH = overrideGH ?? carbsPerHourG;

  return {
    day_index: dayIndex,
    intensity,
    carbs_per_hour_g: carbsPerHourG,
    override_g_h: overrideGH,
    effective_g_h: effectiveGH,
    hours_estimated: effort.durationH,
    total_carbs_g: Math.round(effectiveGH * effort.durationH),
  };
}

/** Total de glucides estimé sur l'ensemble de la sortie (somme des jours). */
export function computeTripTotalCarbsG(days: DayNutrition[]): number {
  return days.reduce((sum, d) => sum + d.total_carbs_g, 0);
}
