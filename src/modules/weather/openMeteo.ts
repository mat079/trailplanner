/**
 * modules/weather/openMeteo.ts
 * Météo par jour via Open-Meteo — prévision (≤ J+16) ou estimation climatique au-delà.
 *
 * Température : appel avec `elevation` pour un downscaling fait par l'API elle-même
 * (pas de calcul lapse rate manuel côté client).
 * Ressenti : Wind Chill NWS uniquement (temp ≤ 10°C ET wind_speed_10m > 4.8 km/h) ;
 * heat index hors scope V1.
 */
import type { DayWeather, WeatherCondition, WeatherMode } from "@/types";

export const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
export const ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive";
/** Horizon de prévision fiable d'Open-Meteo — au-delà, on bascule en estimation climatique. */
export const FORECAST_HORIZON_DAYS = 16;
/** Heure locale représentative retenue pour résumer la journée (milieu de journée de marche). */
export const REPRESENTATIVE_HOUR = 12;
/** Demi-largeur (jours) de la fenêtre climatologique autour de la date équivalente l'an dernier. */
export const CLIMATOLOGY_WINDOW_DAYS = 3;

const HOURLY_VARS = "temperature_2m,rain,snowfall,cloud_cover,wind_speed_10m,weather_code";

export interface WeatherLocation {
  lat: number;
  lon: number;
  elevationM: number | null;
}

interface HourlySample {
  tempC: number;
  rainMm: number;
  snowCm: number;
  cloudPct: number;
  windKmh: number;
  wmoCode: number;
}

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    rain: number[];
    snowfall: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates ISO (YYYY-MM-DD), UTC. */
function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Prévision (≤ J+FORECAST_HORIZON_DAYS) ou estimation climatique au-delà. */
export function pickWeatherMode(targetDateISO: string, todayISO: string): WeatherMode {
  return daysBetween(todayISO, targetDateISO) <= FORECAST_HORIZON_DAYS ? "forecast" : "climatology";
}

/**
 * Wind Chill (formule NWS, variante métrique), applicable uniquement dans sa
 * plage de validité officielle : temp ≤ 10°C ET wind_speed_10m > 4.8 km/h.
 * Retourne null hors plage — pas de "ressenti" affiché dans ce cas.
 */
export function computeWindChillC(tempC: number, windSpeedKmh: number): number | null {
  if (tempC > 10 || windSpeedKmh <= 4.8) return null;
  const v016 = Math.pow(windSpeedKmh, 0.16);
  return 13.12 + 0.6215 * tempC - 11.37 * v016 + 0.3965 * tempC * v016;
}

/** Classe un code WMO (weather_code) en catégorie d'affichage. */
export function classifyWmoCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(code)) return "rain";
  if ([65, 67, 82].includes(code)) return "heavy_rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "cloudy";
}

function buildHourlyUrl(base: string, location: WeatherLocation, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    latitude: location.lat.toFixed(5),
    longitude: location.lon.toFixed(5),
    hourly: HOURLY_VARS,
    start_date: startDate,
    end_date: endDate,
    timezone: "auto",
  });
  if (location.elevationM !== null) {
    params.set("elevation", String(Math.round(location.elevationM)));
  }
  return `${base}?${params.toString()}`;
}

export function buildForecastUrl(location: WeatherLocation, dateISO: string): string {
  return buildHourlyUrl(FORECAST_API, location, dateISO, dateISO);
}

export function buildArchiveUrl(location: WeatherLocation, startDateISO: string, endDateISO: string): string {
  return buildHourlyUrl(ARCHIVE_API, location, startDateISO, endDateISO);
}

/**
 * Fenêtre climatologique : ± CLIMATOLOGY_WINDOW_DAYS jours autour de la date
 * calendaire équivalente un an plus tôt (données historiques réelles, pas une
 * prévision — cf. exigence UI "estimation climatique").
 */
export function climatologyWindow(targetDateISO: string): { start: string; end: string } {
  const target = new Date(targetDateISO + "T00:00:00Z");
  const lastYear = new Date(Date.UTC(target.getUTCFullYear() - 1, target.getUTCMonth(), target.getUTCDate()));
  const start = new Date(lastYear);
  start.setUTCDate(start.getUTCDate() - CLIMATOLOGY_WINDOW_DAYS);
  const end = new Date(lastYear);
  end.setUTCDate(end.getUTCDate() + CLIMATOLOGY_WINDOW_DAYS);
  return { start: toISODate(start), end: toISODate(end) };
}

/** Extrait l'échantillon horaire à REPRESENTATIVE_HOUR pour une date donnée. */
export function extractHourAt(
  data: OpenMeteoHourlyResponse,
  dateISO: string,
  hour: number = REPRESENTATIVE_HOUR
): HourlySample | null {
  const target = `${dateISO}T${String(hour).padStart(2, "0")}:00`;
  const idx = data.hourly.time.indexOf(target);
  if (idx === -1) return null;
  return {
    tempC: data.hourly.temperature_2m[idx],
    rainMm: data.hourly.rain[idx],
    snowCm: data.hourly.snowfall[idx],
    cloudPct: data.hourly.cloud_cover[idx],
    windKmh: data.hourly.wind_speed_10m[idx],
    wmoCode: data.hourly.weather_code[idx],
  };
}

function mostFrequentCode(samples: HourlySample[]): number {
  const counts = new Map<number, number>();
  for (const s of samples) counts.set(s.wmoCode, (counts.get(s.wmoCode) ?? 0) + 1);
  let best = samples[0].wmoCode;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/** Moyenne plusieurs échantillons horaires (climatologie multi-jours). */
export function averageSamples(samples: HourlySample[]): HourlySample {
  if (samples.length === 0) {
    throw new Error("Aucun échantillon à moyenner.");
  }
  const n = samples.length;
  const sums = samples.reduce(
    (acc, s) => ({
      tempC: acc.tempC + s.tempC,
      rainMm: acc.rainMm + s.rainMm,
      snowCm: acc.snowCm + s.snowCm,
      cloudPct: acc.cloudPct + s.cloudPct,
      windKmh: acc.windKmh + s.windKmh,
    }),
    { tempC: 0, rainMm: 0, snowCm: 0, cloudPct: 0, windKmh: 0 }
  );
  return {
    tempC: sums.tempC / n,
    rainMm: sums.rainMm / n,
    snowCm: sums.snowCm / n,
    cloudPct: sums.cloudPct / n,
    windKmh: sums.windKmh / n,
    wmoCode: mostFrequentCode(samples),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function toDayWeather(dayIndex: number, dateISO: string, mode: WeatherMode, sample: HourlySample): DayWeather {
  const feelsLike = computeWindChillC(sample.tempC, sample.windKmh);
  return {
    day_index: dayIndex,
    date: dateISO,
    mode,
    temp_c: round1(sample.tempC),
    feels_like_c: feelsLike !== null ? round1(feelsLike) : null,
    wind_speed_kmh: round1(sample.windKmh),
    rain_mm: round1(sample.rainMm),
    snow_cm: sample.snowCm > 0 ? round1(sample.snowCm) : null,
    cloud_cover_pct: Math.round(sample.cloudPct),
    condition: classifyWmoCode(sample.wmoCode),
  };
}

/** Récupère et résume la météo d'un jour (prévision ou climatologie selon la date). */
export async function fetchDayWeather(
  location: WeatherLocation,
  dayIndex: number,
  dateISO: string,
  todayISO: string,
  signal?: AbortSignal
): Promise<DayWeather> {
  const mode = pickWeatherMode(dateISO, todayISO);

  if (mode === "forecast") {
    const res = await fetch(buildForecastUrl(location, dateISO), { signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo (prévision) a répondu avec le statut ${res.status}.`);
    }
    const data: OpenMeteoHourlyResponse = await res.json();
    const sample = extractHourAt(data, dateISO);
    if (!sample) {
      throw new Error("Donnée horaire manquante pour la date demandée.");
    }
    return toDayWeather(dayIndex, dateISO, mode, sample);
  }

  const { start, end } = climatologyWindow(dateISO);
  const res = await fetch(buildArchiveUrl(location, start, end), { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo (archive) a répondu avec le statut ${res.status}.`);
  }
  const data: OpenMeteoHourlyResponse = await res.json();
  const hourSuffix = `T${String(REPRESENTATIVE_HOUR).padStart(2, "0")}:00`;
  const samples: HourlySample[] = [];
  for (const t of data.hourly.time) {
    if (t.endsWith(hourSuffix)) {
      const sample = extractHourAt(data, t.slice(0, 10));
      if (sample) samples.push(sample);
    }
  }
  if (samples.length === 0) {
    throw new Error("Aucune donnée climatique disponible pour cette période.");
  }
  return toDayWeather(dayIndex, dateISO, mode, averageSamples(samples));
}
