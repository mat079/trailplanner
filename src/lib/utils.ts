import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Palette cyclique utilisée pour distinguer les jours sur la carte et le profil altimétrique. */
export const DAY_COLORS = [
  "#2d8a58", // tp-forest-light
  "#f59e0b", // tp-amber
  "#38bdf8", // tp-sky
  "#ef4444", // tp-red
  "#86c5a0", // tp-sage
  "#3b82f6", // tp-blue
  "#fcd34d", // tp-amber-light
  "#c4e8d3", // tp-sage-light
];

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

/** Trouve l'index du point le plus proche d'une distance cumulée donnée (recherche dichotomique). */
export function nearestIndexByDistance<T extends { dist_cumul: number }>(
  points: T[],
  targetM: number
): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].dist_cumul < targetM) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  if (lo > 0 && Math.abs(points[lo - 1].dist_cumul - targetM) < Math.abs(points[lo].dist_cumul - targetM)) {
    return lo - 1;
  }
  return lo;
}
