/**
 * modules/gpx/snap.ts
 * Snapping d'un point cliqué (lat/lon) sur la trace brute la plus proche.
 */
import { haversineM } from "@/lib/geo";
import type { GpxPoint, TripDay } from "@/types";

export interface SnappedPoint {
  point_index: number;
  lat: number;
  lon: number;
  ele: number;
  dist_cumul: number;
  distance_to_click_m: number;
}

/**
 * Tolérance (mètres) en deçà de laquelle deux passages de la trace sont
 * considérés comme des candidats concurrents plutôt que de laisser quelques
 * mètres de bruit GPS trancher arbitrairement lequel « gagne ».
 */
export const SNAP_AMBIGUITY_TOLERANCE_M = 15;

/**
 * Trouve le point brut le plus proche d'un lat/lon cliqué.
 *
 * Sur une trace en boucle ou aller-retour, la trace peut repasser à
 * proximité du clic à plusieurs endroits (indices) distincts. On ne cherche
 * donc pas le minimum global brut, mais tous les minima locaux le long de la
 * trace (un par passage proche du clic) : un point est un minimum local si
 * sa distance au clic est inférieure ou égale à celle de ses deux voisins
 * immédiats. Parmi les passages dont la distance reste dans
 * SNAP_AMBIGUITY_TOLERANCE_M du meilleur, on retient le premier rencontré le
 * long de la trace (point_index le plus petit) — convention déterministe et
 * documentée : en cas d'ambiguïté, on privilégie le passage le plus précoce.
 */
export function snapToTrace(points: GpxPoint[], lat: number, lon: number): SnappedPoint {
  if (points.length === 0) {
    throw new Error("Trace vide, impossible de snapper un point.");
  }

  let globalBestDist = Infinity;
  const distances = points.map((pt) => {
    const d = haversineM(lat, lon, pt.lat, pt.lon);
    if (d < globalBestDist) globalBestDist = d;
    return d;
  });

  const candidates: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const isLocalMin =
      (i === 0 || distances[i] <= distances[i - 1]) &&
      (i === points.length - 1 || distances[i] <= distances[i + 1]);
    if (isLocalMin && distances[i] <= globalBestDist + SNAP_AMBIGUITY_TOLERANCE_M) {
      candidates.push(i);
    }
  }

  // Le point du minimum global est toujours lui-même un minimum local et
  // reste toujours dans sa propre tolérance : candidates n'est donc jamais vide.
  const bestIndex = candidates[0];
  const p = points[bestIndex];
  return {
    point_index: bestIndex,
    lat: p.lat,
    lon: p.lon,
    ele: p.ele,
    dist_cumul: p.dist_cumul,
    distance_to_click_m: distances[bestIndex],
  };
}

/** Détermine à quel jour appartient un point brut, selon le découpage existant. */
export function resolveDayIndex(days: TripDay[], pointIndex: number): number | null {
  const day = days.find((d) => pointIndex >= d.start_point_index && pointIndex <= d.end_point_index);
  return day ? day.day_index : null;
}
