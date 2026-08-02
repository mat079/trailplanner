/**
 * app/api/trips/[id]/checklist/generate/route.ts
 * Régénère la checklist contextuelle (altitude max, nombre de nuits, météo
 * agrégée sur tous les jours). Remplace les items générés (custom = false),
 * préserve les items personnalisés et l'état coché des items inchangés.
 *
 * La météo est en best-effort : sans start_date, ou si Open-Meteo est
 * indisponible/lent, les règles pluie/neige/froid sont simplement ignorées
 * plutôt que de bloquer la génération (dégradation propre).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getDays, getTripPoints, regenerateChecklist } from "@/lib/db";
import { computeDayDate } from "@/modules/planning/dayBuilder";
import { fetchDayWeather } from "@/modules/weather/openMeteo";
import { resolveDayWeatherLocation } from "@/lib/weatherLocation";
import { generateChecklist, COLD_THRESHOLD_C } from "@/modules/checklist/generator";
import type { ApiResponse, ChecklistItem, DayWeather } from "@/types";

const WEATHER_AGGREGATION_TIMEOUT_MS = 20_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ items: ChecklistItem[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const days = await getDays(id);
    if (days.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Calculez d'abord le découpage en jours." },
        { status: 422 }
      );
    }

    let hasRain = false;
    let hasSnow = false;
    let hasCold = false;

    if (trip.start_date) {
      const points = await getTripPoints(id);
      const todayISO = new Date().toISOString().slice(0, 10);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEATHER_AGGREGATION_TIMEOUT_MS);
      try {
        const results = await Promise.allSettled(
          days.map((d): Promise<DayWeather | null> => {
            const location = resolveDayWeatherLocation(d, points);
            const dateISO = computeDayDate(trip.start_date, d.day_index);
            if (!location || !dateISO) return Promise.resolve(null);
            return fetchDayWeather(location, d.day_index, dateISO, todayISO, controller.signal);
          })
        );
        for (const r of results) {
          if (r.status !== "fulfilled" || !r.value) continue;
          const w = r.value;
          if (w.condition === "rain" || w.condition === "heavy_rain") hasRain = true;
          if (w.condition === "snow") hasSnow = true;
          if (w.temp_c < COLD_THRESHOLD_C || (w.feels_like_c !== null && w.feels_like_c < COLD_THRESHOLD_C)) {
            hasCold = true;
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    const generated = generateChecklist({
      maxEleM: trip.metadata.max_ele_m,
      nights: Math.max(0, days.length - 1),
      hasRain,
      hasSnow,
      hasCold,
    });

    const items = await regenerateChecklist(id, generated);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (err) {
    console.error("[api/trips/[id]/checklist/generate][POST] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la génération de la checklist." },
      { status: 500 }
    );
  }
}
