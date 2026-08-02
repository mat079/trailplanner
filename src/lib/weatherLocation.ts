/**
 * lib/weatherLocation.ts
 * Résolution de la localisation météo d'un jour — partagée entre la route
 * météo (étape 5) et la génération de checklist (étape 7, règles pluie/
 * neige/froid) pour éviter de dupliquer la logique de repli.
 */
import type { GpxPoint, TripDay } from "@/types";
import type { WeatherLocation } from "@/modules/weather/openMeteo";

/**
 * Le bivouac placé pour ce jour s'il existe, sinon le point de fin de trace
 * du jour (meilleure estimation disponible).
 */
export function resolveDayWeatherLocation(day: TripDay, points: GpxPoint[]): WeatherLocation | null {
  if (day.bivouac_lat !== null && day.bivouac_lon !== null) {
    return { lat: day.bivouac_lat, lon: day.bivouac_lon, elevationM: day.bivouac_ele };
  }
  const endPoint = points[day.end_point_index];
  if (!endPoint) return null;
  return { lat: endPoint.lat, lon: endPoint.lon, elevationM: endPoint.ele };
}
