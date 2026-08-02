/**
 * app/api/trips/[id]/weather/route.ts
 * Météo par jour (prévision ≤ J+16, sinon estimation climatique) — étape 5.
 *
 * GET ?day_index=N : nécessite trip.start_date (sans quoi la date du jour est
 * indéterminée). Localisation : le bivouac placé pour ce jour si disponible,
 * sinon le point de fin de trace du jour (meilleure estimation disponible).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, getDays } from "@/lib/db";
import { computeDayDate } from "@/modules/planning/dayBuilder";
import { fetchDayWeather } from "@/modules/weather/openMeteo";
import { resolveDayWeatherLocation } from "@/lib/weatherLocation";
import type { ApiResponse, DayWeather } from "@/types";

const WEATHER_TIMEOUT_MS = 15_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ weather: DayWeather }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }
    if (!trip.start_date) {
      return NextResponse.json(
        { ok: false, error: "Définissez une date de départ pour voir la météo." },
        { status: 422 }
      );
    }

    const dayIndexParam = req.nextUrl.searchParams.get("day_index");
    const dayIndex = Number(dayIndexParam);
    if (dayIndexParam === null || !Number.isInteger(dayIndex) || dayIndex < 0) {
      return NextResponse.json(
        { ok: false, error: "day_index requis (entier positif ou nul)." },
        { status: 400 }
      );
    }

    const days = await getDays(id);
    const day = days.find((d) => d.day_index === dayIndex);
    if (!day) {
      return NextResponse.json(
        { ok: false, error: "Jour introuvable. Calculez d'abord le découpage en jours." },
        { status: 404 }
      );
    }

    const points = await getTripPoints(id);
    const location = resolveDayWeatherLocation(day, points);
    if (!location) {
      return NextResponse.json(
        { ok: false, error: "Impossible de déterminer une localisation pour ce jour." },
        { status: 422 }
      );
    }

    const dateISO = computeDayDate(trip.start_date, dayIndex);
    if (!dateISO) {
      return NextResponse.json(
        { ok: false, error: "Impossible de déterminer la date de ce jour." },
        { status: 422 }
      );
    }
    const todayISO = new Date().toISOString().slice(0, 10);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
      let weather: DayWeather;
      try {
        weather = await fetchDayWeather(location, dayIndex, dateISO, todayISO, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
      return NextResponse.json({ ok: true, data: { weather } });
    } catch (weatherErr) {
      console.warn("[api/trips/[id]/weather] Open-Meteo indisponible:", (weatherErr as Error).message);
      return NextResponse.json(
        { ok: false, error: "Service météo indisponible pour le moment. Réessayez plus tard." },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("[api/trips/[id]/weather] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération de la météo." },
      { status: 500 }
    );
  }
}
