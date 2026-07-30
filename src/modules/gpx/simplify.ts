/**
 * modules/gpx/simplify.ts
 * Algorithme Douglas-Peucker pour la simplification des traces GPX.
 *
 * Les points bruts sont conservés en DB pour les calculs (D+, découpage, etc.).
 * Les points simplifiés sont utilisés uniquement pour l'affichage (carte + profil).
 *
 * ε (epsilon) est en mètres de distance perpendiculaire.
 * Valeurs recommandées :
 *   - Affichage carte large : ε = 20-50m
 *   - Profil altimétrique : ε = 5-10m (conserver les inflexions d'altitude)
 */

import type { GpxPoint, GpxPointSimplified } from "@/types";

/** Distance perpendiculaire d'un point à un segment (en mètres, approximation planaire). */
function perpendicularDistance(
  pt: GpxPointSimplified,
  start: GpxPointSimplified,
  end: GpxPointSimplified
): number {
  const dx = end.lon - start.lon;
  const dy = end.lat - start.lat;

  if (dx === 0 && dy === 0) {
    // start === end : distance euclidienne directe
    const dlat = (pt.lat - start.lat) * 111_320;
    const dlon = (pt.lon - start.lon) * 111_320 * Math.cos((start.lat * Math.PI) / 180);
    return Math.sqrt(dlat * dlat + dlon * dlon);
  }

  // Normaliser pour travailler en mètres approximatifs
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((start.lat * Math.PI) / 180);

  const ax = (start.lon - pt.lon) * lonScale;
  const ay = (start.lat - pt.lat) * latScale;
  const bx = dx * lonScale;
  const by = dy * latScale;

  const t = (ax * bx + ay * by) / (bx * bx + by * by);
  const px = ax - t * bx;
  const py = ay - t * by;

  return Math.sqrt(px * px + py * py);
}

/**
 * Douglas-Peucker récursif.
 * @param points  Points à simplifier
 * @param epsilon  Distance max en mètres (perpendiculaire)
 */
function dpRecursive(
  points: GpxPointSimplified[],
  epsilon: number,
  start: number,
  end: number,
  keep: boolean[]
): void {
  if (end <= start + 1) return;

  let maxDist = 0;
  let maxIndex = start;

  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[start], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    keep[maxIndex] = true;
    dpRecursive(points, epsilon, start, maxIndex, keep);
    dpRecursive(points, epsilon, maxIndex, end, keep);
  }
}

/**
 * Simplifie un tableau de points GPX avec Douglas-Peucker.
 * Toujours conserve le premier et le dernier point.
 *
 * @param points  Points bruts (GpxPoint ou GpxPointSimplified)
 * @param epsilon  Tolérance en mètres (défaut 10m)
 */
export function douglasPeucker(
  points: (GpxPoint | GpxPointSimplified)[],
  epsilon = 10
): GpxPointSimplified[] {
  if (points.length <= 2) {
    return points.map(({ lat, lon, ele, dist_cumul }) => ({ lat, lon, ele, dist_cumul }));
  }

  const simplified: GpxPointSimplified[] = points.map(({ lat, lon, ele, dist_cumul }) => ({
    lat, lon, ele, dist_cumul,
  }));

  const keep = new Array<boolean>(simplified.length).fill(false);
  keep[0] = true;
  keep[simplified.length - 1] = true;

  dpRecursive(simplified, epsilon, 0, simplified.length - 1, keep);

  return simplified.filter((_, i) => keep[i]);
}

/**
 * Epsilon adaptatif selon le nombre de points bruts.
 * Pour un affichage raisonnable sur mobile et desktop.
 */
export function adaptiveEpsilon(pointCount: number): number {
  if (pointCount < 1_000)   return 5;
  if (pointCount < 5_000)   return 10;
  if (pointCount < 15_000)  return 15;
  return 25;
}
