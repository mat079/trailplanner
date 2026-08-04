/**
 * types/index.ts
 * Types partagés TrailPlanner V1
 */

// ── Trip ──────────────────────────────────────────────────────────────────────

export type ActivityType = "randonnee" | "trail" | "alpinisme";

export interface Trip {
  id: string;
  session_id: string;
  share_token: string;
  name: string;
  activity_type: ActivityType;
  start_date: string | null;     // ISO date "YYYY-MM-DD"
  created_at: string;
  last_accessed_at: string;
  gpx_raw: string | null;
  metadata: TripMetadata;
}

/**
 * Vue publique d'un Trip renvoyée par l'API : exclut les champs internes qui
 * n'ont aucun usage côté client (session_id) ou qui gonfleraient inutilement
 * chaque réponse (gpx_raw, potentiellement plusieurs Mo, jamais lu par l'UI —
 * les points simplifiés/bruts transitent par leurs propres endpoints dédiés).
 */
export type PublicTrip = Omit<Trip, "gpx_raw" | "session_id">;

export function toPublicTrip(trip: Trip): PublicTrip {
  const { gpx_raw, session_id, ...publicTrip } = trip;
  void gpx_raw;
  void session_id;
  return publicTrip;
}

export interface TripMetadata {
  distance_m:   number;          // distance totale en mètres
  elev_gain_m:  number;          // D+
  elev_loss_m:  number;          // D-
  max_ele_m:    number;
  min_ele_m:    number;
  point_count:  number;          // nombre de points bruts
  bbox: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  pace_params?: PaceParams;      // derniers paramètres de rythme utilisés (étape 2)
}

// ── GPX points ────────────────────────────────────────────────────────────────

export interface GpxPoint {
  id?: number;
  trip_id?: string;
  lat: number;
  lon: number;
  ele: number;
  dist_cumul: number;            // distance cumulée en mètres
  order_index: number;
}

/** Point simplifié pour l'affichage (Douglas-Peucker) */
export interface GpxPointSimplified {
  lat: number;
  lon: number;
  ele: number;
  dist_cumul: number;
}

// ── Planning / jours ──────────────────────────────────────────────────────────

export interface TripDay {
  id?: number;
  trip_id: string;
  day_index: number;             // 0-indexed
  start_point_index: number;
  end_point_index: number;
  label: string | null;
  bivouac_lat: number | null;
  bivouac_lon: number | null;
  bivouac_ele: number | null;
  date: string | null;           // ISO date
  nutrition_override_g_h: number | null;
}

export interface PaceParams {
  speed_kmh: number;             // vitesse à plat (km/h)
  elev_coeff_min_per_100m: number; // min par 100m D+
  hours_per_day: number;         // budget horaire journalier
}

/** Jour calculé, enrichi des stats dérivées pour l'affichage (non persistées telles quelles). */
export interface DayWithStats extends TripDay {
  distance_m: number;
  elev_gain_m: number;
  elev_loss_m: number;
  duration_h: number;
  start_dist_m: number;          // distance cumulée du point de départ (pour placer les marqueurs)
  end_dist_m: number;            // distance cumulée du point de fin
}

// ── Waypoints ─────────────────────────────────────────────────────────────────

export type WaypointType = "bivouac" | "ravitaillement" | "checkpoint";

export interface Waypoint {
  id?: number;
  trip_id: string;
  type: WaypointType;
  label: string | null;
  lat: number;
  lon: number;
  ele: number | null;
  point_index: number | null;    // index du point GPX le plus proche
  dist_cumul: number | null;
  day_index: number | null;
  created_at?: string;
}

// ── POI ───────────────────────────────────────────────────────────────────────

export type PoiType = "bakery" | "grocery" | "water" | "supermarket";

export interface Poi {
  id?: number;
  trip_id?: string;
  day_index: number | null;
  type: PoiType;
  name: string | null;
  lat: number;
  lon: number;
  osm_id: number | null;
  fetched_at?: string;
}

// ── Météo ─────────────────────────────────────────────────────────────────────

export type WeatherMode = "forecast" | "climatology";

export interface DayWeather {
  day_index: number;
  date: string;
  mode: WeatherMode;
  temp_c: number;               // température downscalée par Open-Meteo (avec elevation=)
  feels_like_c: number | null;  // Wind Chill si applicable, sinon null
  wind_speed_kmh: number;       // wind_speed_10m
  rain_mm: number;
  snow_cm: number | null;
  cloud_cover_pct: number;
  condition: WeatherCondition;
}

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "storm"
  | "fog";

// ── Nutrition ─────────────────────────────────────────────────────────────────

export type IntensityZone = "endurance" | "tempo" | "threshold";

export interface DayNutrition {
  day_index: number;
  intensity: IntensityZone;
  carbs_per_hour_g: number;     // recommandation auto
  override_g_h: number | null;  // valeur saisie par l'utilisateur
  effective_g_h: number;        // = override si défini, sinon auto
  hours_estimated: number;
  total_carbs_g: number;        // effective_g_h × hours_estimated
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export type ChecklistCategory =
  | "navigation"
  | "clothing"
  | "bivouac"
  | "nutrition"
  | "safety"
  | "admin";

export interface ChecklistItem {
  id?: number;
  trip_id: string;
  label: string;
  category: ChecklistCategory;
  checked: boolean;
  custom: boolean;
  sort_order: number;
}

// ── API responses génériques ──────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
