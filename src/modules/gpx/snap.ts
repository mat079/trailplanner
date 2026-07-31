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

/** Trouve le point brut le plus proche géographiquement d'un lat/lon cliqué. */
export function snapToTrace(points: GpxPoint[], lat: number, lon: number): SnappedPoint {
  if (points.length === 0) {
    throw new Error("Trace vide, impossible de snapper un point.");
  }
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = haversineM(lat, lon, points[i].lat, points[i].lon);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  const p = points[bestIndex];
  return {
    point_index: bestIndex,
    lat: p.lat,
    lon: p.lon,
    ele: p.ele,
    dist_cumul: p.dist_cumul,
    distance_to_click_m: bestDist,
  };
}

/** Détermine à quel jour appartient un point brut, selon le découpage existant. */
export function resolveDayIndex(days: TripDay[], pointIndex: number): number | null {
  const day = days.find((d) => pointIndex >= d.start_point_index && pointIndex <= d.end_point_index);
  return day ? day.day_index : null;
}
