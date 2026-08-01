import { describe, it, expect, vi, afterEach } from "vitest";
import {
  pickWeatherMode,
  computeWindChillC,
  classifyWmoCode,
  buildForecastUrl,
  buildArchiveUrl,
  climatologyWindow,
  extractHourAt,
  averageSamples,
  toDayWeather,
  fetchDayWeather,
  FORECAST_HORIZON_DAYS,
  REPRESENTATIVE_HOUR,
} from "@/modules/weather/openMeteo";

const LOCATION = { lat: 45.05, lon: 6.03, elevationM: 1800 };

describe("pickWeatherMode — sélection forecast vs. archive", () => {
  it("choisit la prévision pour une date dans l'horizon (J+16)", () => {
    expect(pickWeatherMode("2026-08-17", "2026-08-01")).toBe("forecast");
  });

  it("choisit la prévision exactement à la limite (J+16)", () => {
    expect(pickWeatherMode("2026-08-17", "2026-08-01")).toBe("forecast");
    // 2026-08-01 + 16 jours = 2026-08-17
  });

  it("bascule en climatologie au-delà de l'horizon (J+17)", () => {
    expect(pickWeatherMode("2026-08-18", "2026-08-01")).toBe("climatology");
  });

  it("choisit la prévision pour aujourd'hui même (J+0)", () => {
    expect(pickWeatherMode("2026-08-01", "2026-08-01")).toBe("forecast");
  });

  it(`FORECAST_HORIZON_DAYS vaut bien 16`, () => {
    expect(FORECAST_HORIZON_DAYS).toBe(16);
  });
});

describe("computeWindChillC — Wind Chill NWS dans/hors plage de validité", () => {
  it("s'applique quand temp ≤ 10°C ET vent > 4.8 km/h", () => {
    const wc = computeWindChillC(0, 20);
    expect(wc).not.toBeNull();
    expect(wc!).toBeLessThan(0); // le ressenti doit être plus froid que la température brute
  });

  it("s'applique à la limite exacte de température (10°C)", () => {
    expect(computeWindChillC(10, 20)).not.toBeNull();
  });

  it("ne s'applique pas au-dessus de 10°C, même avec du vent", () => {
    expect(computeWindChillC(10.1, 30)).toBeNull();
  });

  it("ne s'applique pas à la limite exacte de vent (4.8 km/h, exclusif)", () => {
    expect(computeWindChillC(0, 4.8)).toBeNull();
  });

  it("s'applique juste au-dessus du seuil de vent (4.9 km/h)", () => {
    expect(computeWindChillC(0, 4.9)).not.toBeNull();
  });

  it("ne s'applique pas par vent nul ou quasi nul", () => {
    expect(computeWindChillC(-5, 0)).toBeNull();
  });
});

describe("classifyWmoCode", () => {
  it("reconnaît le ciel clair et les nuages", () => {
    expect(classifyWmoCode(0)).toBe("clear");
    expect(classifyWmoCode(1)).toBe("partly_cloudy");
    expect(classifyWmoCode(2)).toBe("partly_cloudy");
    expect(classifyWmoCode(3)).toBe("cloudy");
  });

  it("reconnaît le brouillard", () => {
    expect(classifyWmoCode(45)).toBe("fog");
    expect(classifyWmoCode(48)).toBe("fog");
  });

  it("distingue pluie et pluie forte", () => {
    expect(classifyWmoCode(61)).toBe("rain");
    expect(classifyWmoCode(65)).toBe("heavy_rain");
    expect(classifyWmoCode(82)).toBe("heavy_rain");
  });

  it("reconnaît la neige", () => {
    expect(classifyWmoCode(71)).toBe("snow");
    expect(classifyWmoCode(75)).toBe("snow");
    expect(classifyWmoCode(85)).toBe("snow");
  });

  it("reconnaît l'orage", () => {
    expect(classifyWmoCode(95)).toBe("storm");
    expect(classifyWmoCode(99)).toBe("storm");
  });

  it("retombe sur 'cloudy' pour un code inconnu plutôt que de planter", () => {
    expect(classifyWmoCode(9999)).toBe("cloudy");
  });
});

describe("buildForecastUrl / buildArchiveUrl", () => {
  it("utilise bien wind_speed_10m comme variable de vent (hauteur de référence NWS)", () => {
    const url = buildForecastUrl(LOCATION, "2026-08-05");
    expect(url).toContain("wind_speed_10m");
    expect(url).not.toContain("wind_gusts_10m");
    expect(url).not.toContain("wind_speed_80m");
  });

  it("cible l'endpoint prévision", () => {
    expect(buildForecastUrl(LOCATION, "2026-08-05")).toContain("api.open-meteo.com/v1/forecast");
  });

  it("cible l'endpoint archive", () => {
    expect(buildArchiveUrl(LOCATION, "2025-08-01", "2025-08-08")).toContain(
      "archive-api.open-meteo.com/v1/archive"
    );
  });

  it("transmet l'altitude pour le downscaling par l'API (pas de calcul lapse rate manuel)", () => {
    const url = buildForecastUrl(LOCATION, "2026-08-05");
    expect(url).toContain("elevation=1800");
  });

  it("omet l'altitude si elle est inconnue plutôt que d'envoyer une valeur inventée", () => {
    const url = buildForecastUrl({ ...LOCATION, elevationM: null }, "2026-08-05");
    expect(url).not.toContain("elevation=");
  });
});

describe("climatologyWindow", () => {
  it("centre la fenêtre sur la même date calendaire un an plus tôt", () => {
    const { start, end } = climatologyWindow("2026-08-15");
    expect(start).toBe("2025-08-12");
    expect(end).toBe("2025-08-18");
  });

  it("traverse correctement une frontière d'année", () => {
    const { start, end } = climatologyWindow("2026-01-01");
    expect(start).toBe("2024-12-29");
    expect(end).toBe("2025-01-04");
  });
});

describe("extractHourAt / averageSamples", () => {
  const data = {
    hourly: {
      time: ["2026-08-05T11:00", "2026-08-05T12:00", "2026-08-05T13:00"],
      temperature_2m: [8, 10, 12],
      rain: [0, 1, 2],
      snowfall: [0, 0, 0],
      cloud_cover: [50, 60, 70],
      wind_speed_10m: [10, 15, 20],
      weather_code: [1, 61, 61],
    },
  };

  it(`extrait l'échantillon à l'heure représentative (${REPRESENTATIVE_HOUR}h)`, () => {
    const sample = extractHourAt(data, "2026-08-05");
    expect(sample).toEqual({ tempC: 10, rainMm: 1, snowCm: 0, cloudPct: 60, windKmh: 15, wmoCode: 61 });
  });

  it("retourne null si l'heure demandée est absente des données", () => {
    expect(extractHourAt(data, "2026-08-06")).toBeNull();
  });

  it("moyenne plusieurs échantillons et retient le code WMO le plus fréquent", () => {
    const samples = [
      { tempC: 8, rainMm: 0, snowCm: 0, cloudPct: 50, windKmh: 10, wmoCode: 1 },
      { tempC: 10, rainMm: 1, snowCm: 0, cloudPct: 60, windKmh: 15, wmoCode: 61 },
      { tempC: 12, rainMm: 2, snowCm: 0, cloudPct: 70, windKmh: 20, wmoCode: 61 },
    ];
    const avg = averageSamples(samples);
    expect(avg.tempC).toBeCloseTo(10, 5);
    expect(avg.windKmh).toBeCloseTo(15, 5);
    expect(avg.wmoCode).toBe(61); // majoritaire (2/3)
  });

  it("lève une erreur si la liste d'échantillons est vide", () => {
    expect(() => averageSamples([])).toThrow();
  });
});

describe("toDayWeather", () => {
  it("calcule le ressenti quand applicable", () => {
    const dw = toDayWeather(0, "2026-08-05", "forecast", {
      tempC: 2,
      rainMm: 0,
      snowCm: 0,
      cloudPct: 40,
      windKmh: 25,
      wmoCode: 2,
    });
    expect(dw.feels_like_c).not.toBeNull();
    expect(dw.feels_like_c!).toBeLessThan(dw.temp_c);
    expect(dw.condition).toBe("partly_cloudy");
    expect(dw.snow_cm).toBeNull(); // 0 → null, pas "0cm de neige"
  });

  it("n'affiche pas de ressenti hors plage de validité", () => {
    const dw = toDayWeather(0, "2026-08-05", "forecast", {
      tempC: 25,
      rainMm: 0,
      snowCm: 0,
      cloudPct: 10,
      windKmh: 5,
      wmoCode: 0,
    });
    expect(dw.feels_like_c).toBeNull();
  });
});

describe("fetchDayWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("interroge l'endpoint prévision pour une date proche", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: ["2026-08-05T12:00"],
          temperature_2m: [5],
          rain: [0],
          snowfall: [0],
          cloud_cover: [20],
          wind_speed_10m: [10],
          weather_code: [0],
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const dw = await fetchDayWeather(LOCATION, 0, "2026-08-05", "2026-08-01");
    expect(dw.mode).toBe("forecast");
    expect(dw.temp_c).toBe(5);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("api.open-meteo.com/v1/forecast"), expect.anything());
  });

  it("interroge l'endpoint archive et moyenne pour une date lointaine", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: ["2025-05-01T12:00", "2025-05-02T12:00"],
          temperature_2m: [10, 14],
          rain: [0, 0],
          snowfall: [0, 0],
          cloud_cover: [30, 50],
          wind_speed_10m: [5, 15],
          weather_code: [0, 1],
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const dw = await fetchDayWeather(LOCATION, 2, "2026-05-01", "2026-01-01");
    expect(dw.mode).toBe("climatology");
    expect(dw.temp_c).toBeCloseTo(12, 5);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("archive-api.open-meteo.com/v1/archive"),
      expect.anything()
    );
  });

  it("propage une erreur explicite si Open-Meteo répond en erreur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchDayWeather(LOCATION, 0, "2026-08-05", "2026-08-01")).rejects.toThrow(/503/);
  });
});
