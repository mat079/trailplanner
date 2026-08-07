/**
 * modules/poi/overpass.ts
 * Requêtes Overpass API — boulangeries, épiceries/supermarchés, points d'eau
 * dans un buffer autour d'une section de trace.
 */
import type { Poi, PoiType, WaterSubtype } from "@/types";

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const DEFAULT_BUFFER_M = 200;
/** Cap du nombre de points envoyés à Overpass (taille de requête raisonnable). */
export const MAX_QUERY_POINTS = 100;

interface LatLon {
  lat: number;
  lon: number;
}

/** Sous-échantillonne uniformément une liste de points à `max` points maximum. */
export function decimatePoints<T>(points: T[], max: number): T[] {
  if (points.length <= max || max <= 0) return points;
  const step = points.length / max;
  const result: T[] = [];
  for (let i = 0; i < max; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

const POI_TAG_FILTERS: Record<PoiType, string[]> = {
  bakery: ['"shop"="bakery"'],
  supermarket: ['"shop"="supermarket"'],
  grocery: ['"shop"="convenience"', '"shop"="grocery"'],
  // Rivières/lacs sont presque toujours des ways/relations (pas des nodes) dans
  // OSM, d'où le "nwr" (node/way/relation) plutôt que "node" ci-dessous.
  water: [
    '"amenity"="drinking_water"',
    '"natural"="spring"',
    '"amenity"="fountain"',
    '"waterway"="river"',
    '"waterway"="stream"',
    '"natural"="water"',
  ],
};

/** Construit une requête Overpass QL (out:json) pour un buffer autour d'une polyligne. */
export function buildOverpassQuery(points: LatLon[], bufferM: number = DEFAULT_BUFFER_M): string {
  if (points.length === 0) {
    throw new Error("Impossible de construire une requête Overpass sans points.");
  }
  if (bufferM <= 0) {
    throw new Error("Le buffer Overpass doit être strictement positif.");
  }

  const decimated = decimatePoints(points, MAX_QUERY_POINTS);
  const coords = decimated.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join(",");
  const around = `(around:${bufferM},${coords})`;

  const clauses = Object.values(POI_TAG_FILTERS)
    .flat()
    .map((tag) => `  nwr[${tag}]${around};`)
    .join("\n");

  // "out center" ajoute des coordonnées center:{lat,lon} aux ways/relations
  // (rivières, plans d'eau) en plus des lat/lon natifs des nodes (commerces,
  // fontaines) — nécessaire pour positionner un marqueur sur n'importe lequel.
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout center;`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  /** Coordonnée représentative pour les ways/relations (cf. "out center"). */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export type ParsedPoi = Pick<Poi, "type" | "name" | "lat" | "lon" | "osm_id" | "water_subtype">;

/** Détermine la catégorie POI à partir des tags OSM, ou null si non pertinent. */
export function classifyElement(tags: Record<string, string>): PoiType | null {
  if (tags.shop === "bakery") return "bakery";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.shop === "convenience" || tags.shop === "grocery") return "grocery";
  if (
    tags.amenity === "drinking_water" ||
    tags.natural === "spring" ||
    tags.amenity === "fountain" ||
    tags.waterway === "river" ||
    tags.waterway === "stream" ||
    tags.natural === "water"
  ) {
    return "water";
  }
  return null;
}

/**
 * Sous-type d'un point d'eau, pour indiquer au randonneur à quoi s'attendre
 * (eau potable garantie vs source/rivière/lac à traiter avant consommation).
 * "spring" (source naturelle) est rapproché de "fontaine" en l'absence d'un
 * sous-type dédié plus pertinent pour l'usage rando.
 */
export function classifyWaterSubtype(tags: Record<string, string>): WaterSubtype {
  if (tags.amenity === "drinking_water") return "eau_potable";
  if (tags.amenity === "fountain" || tags.natural === "spring") return "fontaine";
  if (tags.waterway === "river" || tags.waterway === "stream") return "riviere";
  if (tags.natural === "water") return "lac";
  return "indetermine";
}

/** Parse une réponse Overpass JSON en POI exploitables (sans trip_id/day_index). */
export function parseOverpassResponse(data: OverpassResponse): ParsedPoi[] {
  const results: ParsedPoi[] = [];
  for (const el of data.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number" || !el.tags) {
      continue;
    }
    const type = classifyElement(el.tags);
    if (!type) continue;
    results.push({
      type,
      name: el.tags.name ?? null,
      lat,
      lon,
      osm_id: el.id,
      water_subtype: type === "water" ? classifyWaterSubtype(el.tags) : null,
    });
  }
  return results;
}

/** Interroge Overpass et retourne les POI parsés pour une polyligne + buffer donnés. */
export async function fetchOverpassPoi(
  points: LatLon[],
  bufferM: number = DEFAULT_BUFFER_M,
  signal?: AbortSignal
): Promise<ParsedPoi[]> {
  const query = buildOverpassQuery(points, bufferM);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    // Overpass exige un User-Agent identifiable (politique d'usage officielle) et
    // le rejette avec 406 sinon — contrairement à curl, fetch() de Node n'en
    // envoie pas par défaut.
    headers: { "Content-Type": "text/plain", "User-Agent": "TrailPlanner/1.0 (+https://github.com/trailplanner)" },
    body: query,
    signal,
  });
  if (!res.ok) {
    throw new Error(`Overpass API a répondu avec le statut ${res.status}.`);
  }
  const data: OverpassResponse = await res.json();
  return parseOverpassResponse(data);
}
