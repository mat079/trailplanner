"use client";

/**
 * components/planning/DayList.tsx
 * Liste des jours calculés avec leurs stats (distance, D+/D-, durée, date).
 */
import { usePlanStore } from "@/lib/planStore";
import { dayColor, cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

export default function DayList() {
  const days = usePlanStore((s) => s.days);
  const hoveredDayIndex = usePlanStore((s) => s.hoveredDayIndex);
  const setHoveredDay = usePlanStore((s) => s.setHoveredDay);

  if (days.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {days.map((d) => (
        <div
          key={d.day_index}
          className={cn(
            "tp-card p-4 transition-all cursor-default",
            hoveredDayIndex === d.day_index && "tp-card-hover"
          )}
          style={{ borderLeft: `3px solid ${dayColor(d.day_index)}` }}
          onMouseEnter={() => setHoveredDay(d.day_index)}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm" style={{ color: "var(--tp-text)" }}>
              {fr.planning.dayLabel(d.day_index + 1)}
            </span>
            <span className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
              {d.date ?? fr.trip.noDate}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-xs" style={{ color: "var(--tp-text-muted)" }}>
            <dt>{fr.trip.distance}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {fr.planning.distLabel(d.distance_m / 1000)}
            </dd>
            <dt>{fr.trip.elevGain}</dt>
            <dd className="text-right" style={{ color: "var(--tp-sage)" }}>
              {fr.planning.elevLabel(d.elev_gain_m)}
            </dd>
            <dt>{fr.trip.elevLoss}</dt>
            <dd className="text-right" style={{ color: "var(--tp-sky)" }}>
              {fr.planning.elevLabel(-d.elev_loss_m)}
            </dd>
            <dt>{fr.trip.duration}</dt>
            <dd className="text-right" style={{ color: "var(--tp-text)" }}>
              {fr.planning.timeLabel(d.duration_h)}
            </dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
