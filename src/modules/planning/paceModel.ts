/**
 * modules/planning/paceModel.ts
 * Modèle de vitesse — Option C (vitesse à plat + coefficient D+ paramétrables).
 */
import type { PaceParams } from "@/types";

/** Valeurs pré-remplies raisonnables pour une randonnée multi-jours. */
export const DEFAULT_PACE_PARAMS: PaceParams = {
  speed_kmh: 4,
  elev_coeff_min_per_100m: 12,
  hours_per_day: 8,
};

/**
 * Estime la durée (en heures) pour parcourir une distance avec un dénivelé positif donné.
 * Ne valide pas les params — la validation est faite une seule fois en amont (dayBuilder).
 */
export function estimateDurationHours(
  distanceM: number,
  elevGainM: number,
  params: PaceParams
): number {
  const distanceHours = distanceM / 1000 / params.speed_kmh;
  const climbHours = (elevGainM / 100) * (params.elev_coeff_min_per_100m / 60);
  return distanceHours + climbHours;
}

/** Valide les paramètres de rythme. Lève une erreur explicite si invalides. */
export function validatePaceParams(params: PaceParams): void {
  if (!(params.speed_kmh > 0)) {
    throw new Error("La vitesse à plat doit être strictement positive.");
  }
  if (!(params.hours_per_day > 0)) {
    throw new Error("Le budget horaire journalier doit être strictement positif.");
  }
  if (params.elev_coeff_min_per_100m < 0) {
    throw new Error("Le coefficient D+ ne peut pas être négatif.");
  }
}
