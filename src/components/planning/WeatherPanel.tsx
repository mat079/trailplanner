"use client";

/**
 * components/planning/WeatherPanel.tsx
 * Météo par jour — prévision (≤ J+16) ou estimation climatique au-delà.
 */
import { usePlanStore } from "@/lib/planStore";
import { weatherIcon } from "@/lib/utils";
import { fr } from "@/i18n/fr";

function WeatherSection({ dayIndex }: { dayIndex: number }) {
  const weather = usePlanStore((s) => s.weatherByDay[dayIndex]);
  const loading = usePlanStore((s) => s.weatherLoading[dayIndex]) ?? false;
  const error = usePlanStore((s) => s.weatherError[dayIndex]);

  return (
    <div className="tp-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.planning.dayLabel(dayIndex + 1)}
        </span>
        {weather && <span aria-hidden="true" className="text-lg">{weatherIcon(weather.condition)}</span>}
      </div>

      {loading && !weather && (
        <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.weather.loading}
        </p>
      )}

      {error && !loading && (
        <p className="text-xs" style={{ color: "var(--tp-red)" }} role="alert">
          {error}
        </p>
      )}

      {weather && (
        <>
          {weather.mode === "climatology" && (
            <p className="text-xs mb-2 px-2 py-1 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "var(--tp-amber)" }}>
              {fr.weather.climatologyNote}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-y-1 text-xs" style={{ color: "var(--tp-text-muted)" }}>
            <dt>{fr.weather.feelsLikeRaw}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {weather.temp_c.toFixed(1)} °C
            </dd>

            {weather.feels_like_c !== null && (
              <>
                <dt>{fr.weather.feelsLike}</dt>
                <dd className="text-right" style={{ color: "var(--tp-sky)" }}>
                  {weather.feels_like_c.toFixed(1)} °C
                </dd>
              </>
            )}

            <dt>{fr.weather.wind}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {weather.wind_speed_kmh.toFixed(0)} {fr.weather.windUnit}
            </dd>

            <dt>{fr.weather.rain}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {weather.rain_mm.toFixed(1)} {fr.weather.rainUnit}
            </dd>

            {weather.snow_cm !== null && (
              <>
                <dt>{fr.weather.snow}</dt>
                <dd className="text-right" style={{ color: "var(--tp-text)" }}>
                  {weather.snow_cm.toFixed(1)} cm
                </dd>
              </>
            )}

            <dt>{fr.weather.cloudCover}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {weather.cloud_cover_pct}%
            </dd>
          </dl>

          <p className="text-xs mt-2" style={{ color: "var(--tp-text-muted)" }}>
            {fr.weather.condition[weather.condition]}
          </p>
        </>
      )}
    </div>
  );
}

export default function WeatherPanel() {
  const days = usePlanStore((s) => s.days);
  const trip = usePlanStore((s) => s.trip);

  if (days.length === 0) return null;

  return (
    <div>
      <h3 className="tp-heading text-sm mb-2" style={{ color: "var(--tp-text)" }}>
        {fr.weather.title}
      </h3>

      {!trip?.start_date ? (
        <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.weather.noDate}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {days.map((d) => (
              <WeatherSection key={d.day_index} dayIndex={d.day_index} />
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--tp-text-muted)" }}>
            {fr.weather.attribution}
          </p>
        </>
      )}
    </div>
  );
}
