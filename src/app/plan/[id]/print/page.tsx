/**
 * app/plan/[id]/print/page.tsx
 * Fiche de sortie imprimable — étape 8. CSS print (@media print dans
 * globals.css), pas de dépendance de génération PDF côté serveur.
 *
 * Toutes les données sont agrégées côté serveur pour un rendu immédiat :
 * - météo en best-effort (timeout global, ignorée silencieusement si
 *   indisponible ou si aucune date de départ n'est définie) ;
 * - POI depuis le cache uniquement (pas d'appel Overpass live ici, pour
 *   garder l'export rapide et fiable).
 */
import { notFound } from "next/navigation";
import { getTrip, getTripPoints, getDays, getWaypoints, getCachedPoi, getChecklistItems } from "@/lib/db";
import { computeDayStats, computeDayDate } from "@/modules/planning/dayBuilder";
import { DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import { computeAllDayNutrition } from "@/lib/nutritionSummary";
import { resolveDayWeatherLocation } from "@/lib/weatherLocation";
import { fetchDayWeather } from "@/modules/weather/openMeteo";
import { waypointStyle, poiStyle, waterSubtypeStyle, weatherIcon } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import PrintButton from "@/components/planning/PrintButton";
import type { ChecklistCategory, DayWeather, Poi, TripDay, Waypoint } from "@/types";

const WEATHER_TIMEOUT_MS = 8_000;
const CHECKLIST_CATEGORY_ORDER: ChecklistCategory[] = [
  "navigation",
  "clothing",
  "bivouac",
  "nutrition",
  "safety",
  "admin",
];

export const metadata = { title: fr.pdf.title };

async function loadWeatherByDay(
  trip: { start_date: string | null },
  days: TripDay[],
  points: Awaited<ReturnType<typeof getTripPoints>>
): Promise<Map<number, DayWeather>> {
  const weatherByDay = new Map<number, DayWeather>();
  if (!trip.start_date) return weatherByDay;

  const startDate = trip.start_date;
  const todayISO = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const results = await Promise.allSettled(
      days.map((d) => {
        const location = resolveDayWeatherLocation(d, points);
        const dateISO = computeDayDate(startDate, d.day_index);
        if (!location || !dateISO) return Promise.reject(new Error("Localisation ou date indisponible"));
        return fetchDayWeather(location, d.day_index, dateISO, todayISO, controller.signal);
      })
    );
    results.forEach((r, i) => {
      if (r.status === "fulfilled") weatherByDay.set(days[i].day_index, r.value);
    });
  } finally {
    clearTimeout(timeout);
  }
  return weatherByDay;
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) {
    notFound();
  }

  const [points, days, waypoints, checklist, nutritionDays] = await Promise.all([
    getTripPoints(id),
    getDays(id),
    getWaypoints(id),
    getChecklistItems(id),
    computeAllDayNutrition(id, trip),
  ]);

  const paceParams = trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS;
  const nutritionByDay = new Map(nutritionDays.map((n) => [n.day_index, n]));
  const tripTotalCarbsG = nutritionDays.reduce((sum, n) => sum + n.total_carbs_g, 0);

  const poiByDay = new Map<number, Poi[]>();
  await Promise.all(
    days.map(async (d) => {
      poiByDay.set(d.day_index, await getCachedPoi(id, d.day_index));
    })
  );

  const waypointsByDay = new Map<number, Waypoint[]>();
  for (const w of waypoints) {
    if (w.day_index === null) continue;
    const list = waypointsByDay.get(w.day_index) ?? [];
    list.push(w);
    waypointsByDay.set(w.day_index, list);
  }

  const weatherByDay = await loadWeatherByDay(trip, days, points);

  const checklistByCategory = new Map<ChecklistCategory, typeof checklist>();
  for (const item of checklist) {
    const list = checklistByCategory.get(item.category) ?? [];
    list.push(item);
    checklistByCategory.set(item.category, list);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--tp-slate)" }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PrintButton />

        <header className="mb-6" style={{ borderBottom: "2px solid var(--tp-border)", paddingBottom: "1rem" }}>
          <h1 className="tp-heading text-2xl" style={{ color: "var(--tp-text)" }}>
            {trip.name || fr.trip.unnamed}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--tp-text-muted)" }}>
            {fr.planning.distLabel(trip.metadata.distance_m / 1000)} · {fr.planning.elevLabel(trip.metadata.elev_gain_m)}{" "}
            {fr.trip.elevGain.toLowerCase()} · {fr.planning.elevLabel(-trip.metadata.elev_loss_m)}{" "}
            {fr.trip.elevLoss.toLowerCase()}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--tp-text-muted)" }}>
            {trip.start_date ? `${fr.trip.startDate} : ${trip.start_date}` : fr.trip.noDate}
            {nutritionDays.length > 0 && ` · ${fr.nutrition.tripTotal} : ${tripTotalCarbsG} g`}
          </p>
        </header>

        {days.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--tp-text-muted)" }}>
            {fr.trip.noDate}
          </p>
        ) : (
          <section className="flex flex-col gap-4 mb-8">
            {days.map((day) => {
              const stats = computeDayStats(points, day.start_point_index, day.end_point_index, paceParams);
              const weather = weatherByDay.get(day.day_index);
              const poi = poiByDay.get(day.day_index) ?? [];
              const dayWaypoints = waypointsByDay.get(day.day_index) ?? [];
              const nutrition = nutritionByDay.get(day.day_index);

              return (
                <article key={day.day_index} className="tp-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="tp-heading text-lg" style={{ color: "var(--tp-text)" }}>
                      {fr.planning.dayLabel(day.day_index + 1)}
                    </h2>
                    <span className="text-sm" style={{ color: "var(--tp-text-muted)" }}>
                      {day.date ?? fr.trip.noDate}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-1 text-sm mb-3" style={{ color: "var(--tp-text-muted)" }}>
                    <dt>{fr.trip.distance}</dt>
                    <dd style={{ color: "var(--tp-text)" }}>{fr.planning.distLabel(stats.distance_m / 1000)}</dd>
                    <dt>{fr.trip.elevGain}</dt>
                    <dd style={{ color: "var(--tp-text)" }}>{fr.planning.elevLabel(stats.elev_gain_m)}</dd>
                    <dt>{fr.trip.elevLoss}</dt>
                    <dd style={{ color: "var(--tp-text)" }}>{fr.planning.elevLabel(-stats.elev_loss_m)}</dd>
                    <dt>{fr.trip.duration}</dt>
                    <dd style={{ color: "var(--tp-text)" }}>{fr.planning.timeLabel(stats.duration_h)}</dd>
                  </dl>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="tp-label mb-1">{fr.weather.title}</p>
                      {weather ? (
                        <p style={{ color: "var(--tp-text)" }}>
                          <span aria-hidden="true">{weatherIcon(weather.condition)}</span>{" "}
                          {weather.temp_c.toFixed(0)}°C
                          {weather.feels_like_c !== null && ` (${fr.weather.feelsLike} ${weather.feels_like_c.toFixed(0)}°C)`}
                          {" · "}
                          {weather.wind_speed_kmh.toFixed(0)} {fr.weather.windUnit}
                          {" · "}
                          {weather.rain_mm.toFixed(1)} {fr.weather.rainUnit}
                          {weather.mode === "climatology" && ` — ${fr.weather.climatology}`}
                        </p>
                      ) : (
                        <p style={{ color: "var(--tp-text-muted)" }}>
                          {trip.start_date ? fr.pdf.weatherUnavailable : fr.weather.noDate}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="tp-label mb-1">{fr.nutrition.title}</p>
                      {nutrition ? (
                        <p style={{ color: "var(--tp-text)" }}>
                          {nutrition.effective_g_h.toFixed(0)} {fr.nutrition.perHour} · {nutrition.total_carbs_g}{" "}
                          {fr.nutrition.perDay}
                        </p>
                      ) : (
                        <p style={{ color: "var(--tp-text-muted)" }}>—</p>
                      )}
                    </div>

                    <div>
                      <p className="tp-label mb-1">{fr.waypoints.title}</p>
                      {dayWaypoints.length > 0 ? (
                        <ul style={{ color: "var(--tp-text)" }}>
                          {dayWaypoints.map((w) => (
                            <li key={w.id}>
                              <span aria-hidden="true">{waypointStyle(w.type).icon}</span>{" "}
                              {w.label ||
                                (w.type === "bivouac"
                                  ? fr.waypoints.typeBivouac
                                  : w.type === "ravitaillement"
                                    ? fr.waypoints.typeResupply
                                    : fr.waypoints.typeCheckpoint)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: "var(--tp-text-muted)" }}>{fr.pdf.noWaypoints}</p>
                      )}
                    </div>

                    <div>
                      <p className="tp-label mb-1">{fr.poi.title}</p>
                      {poi.length > 0 ? (
                        <ul style={{ color: "var(--tp-text)" }}>
                          {poi.map((p) => {
                            const isWater = p.type === "water";
                            const style = isWater ? waterSubtypeStyle(p.water_subtype ?? "indetermine") : poiStyle(p.type);
                            const label = isWater ? fr.poi.waterSubtype[p.water_subtype ?? "indetermine"] : fr.poi[p.type];
                            return (
                              <li key={p.id}>
                                <span aria-hidden="true">{style.icon}</span> {label}
                                {p.name ? ` — ${p.name}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p style={{ color: "var(--tp-text-muted)" }}>{fr.pdf.poiNotCached}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {checklist.length > 0 && (
          <section>
            <h2 className="tp-heading text-lg mb-3" style={{ color: "var(--tp-text)" }}>
              {fr.pdf.checklistTitle}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CHECKLIST_CATEGORY_ORDER.map((cat) => {
                const items = checklistByCategory.get(cat);
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat} className="tp-card p-4">
                    <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--tp-text)" }}>
                      {fr.checklist.categories[cat]}
                    </h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {items.map((item) => (
                        <li key={item.id} style={{ color: "var(--tp-text)" }}>
                          <span aria-hidden="true">{item.checked ? "☑" : "☐"}</span> {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-8 pt-4 text-xs" style={{ borderTop: "1px solid var(--tp-border)", color: "var(--tp-text-muted)" }}>
          <p>
            {fr.attribution.osm} · {fr.attribution.meteo}
          </p>
          <p>
            {fr.pdf.generated} — {new Date().toLocaleDateString("fr-FR")}
          </p>
        </footer>
      </div>
    </div>
  );
}
