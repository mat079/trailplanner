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

const WAYPOINT_STYLE: Record<"bivouac" | "ravitaillement" | "checkpoint", { icon: string; color: string }> = {
  bivouac: { icon: "⛺", color: "#38bdf8" },
  ravitaillement: { icon: "🛒", color: "#f59e0b" },
  checkpoint: { icon: "📍", color: "#ef4444" },
};

export function waypointStyle(type: "bivouac" | "ravitaillement" | "checkpoint") {
  return WAYPOINT_STYLE[type];
}

const POI_STYLE: Record<"bakery" | "supermarket" | "grocery" | "water", { icon: string; color: string }> = {
  bakery: { icon: "🥖", color: "#d97706" },
  supermarket: { icon: "🏬", color: "#16a34a" },
  grocery: { icon: "🥫", color: "#86c5a0" },
  water: { icon: "💧", color: "#0891b2" },
};

export function poiStyle(type: "bakery" | "supermarket" | "grocery" | "water") {
  return POI_STYLE[type];
}

const WATER_SUBTYPE_STYLE: Record<
  "eau_potable" | "fontaine" | "riviere" | "lac" | "indetermine",
  { icon: string; color: string }
> = {
  eau_potable: { icon: "🚰", color: "#0891b2" },
  fontaine:    { icon: "⛲", color: "#0891b2" },
  riviere:     { icon: "🌊", color: "#0891b2" },
  lac:         { icon: "🏞️", color: "#0891b2" },
  indetermine: { icon: "💧", color: "#0891b2" },
};

/** Style d'un point d'eau selon son sous-type (icône plus précise que le générique `poiStyle("water")`). */
export function waterSubtypeStyle(subtype: "eau_potable" | "fontaine" | "riviere" | "lac" | "indetermine") {
  return WATER_SUBTYPE_STYLE[subtype];
}

const WEATHER_ICON: Record<
  "clear" | "partly_cloudy" | "cloudy" | "rain" | "heavy_rain" | "snow" | "storm" | "fog",
  string
> = {
  clear: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  heavy_rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  fog: "🌫️",
};

export function weatherIcon(
  condition: "clear" | "partly_cloudy" | "cloudy" | "rain" | "heavy_rain" | "snow" | "storm" | "fog"
): string {
  return WEATHER_ICON[condition];
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
