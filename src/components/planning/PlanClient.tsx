"use client";

/**
 * components/planning/PlanClient.tsx
 * Orchestration client de la page /plan/[id] : carte, profil, paramètres, jours.
 */
import { useEffect } from "react";
import { usePlanStore } from "@/lib/planStore";
import TrailMap from "@/components/map/TrailMap";
import ElevationProfile from "@/components/elevation/ElevationProfile";
import PaceParamsPanel from "@/components/planning/PaceParamsPanel";
import DayList from "@/components/planning/DayList";
import { fr } from "@/i18n/fr";
import type { GpxPointSimplified, Trip } from "@/types";

interface PlanClientProps {
  trip: Trip;
  simplifiedPoints: GpxPointSimplified[];
}

export default function PlanClient({ trip, simplifiedPoints }: PlanClientProps) {
  const init = usePlanStore((s) => s.init);
  const days = usePlanStore((s) => s.days);
  const hoveredDayIndex = usePlanStore((s) => s.hoveredDayIndex);
  const setHoveredDay = usePlanStore((s) => s.setHoveredDay);
  const adjustBoundary = usePlanStore((s) => s.adjustBoundary);

  useEffect(() => {
    init(trip.id, trip, simplifiedPoints);
  }, [init, trip, simplifiedPoints]);

  return (
    <div className="tp-gradient-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--tp-border)" }}>
        <div>
          <h1 className="tp-heading text-xl" style={{ color: "var(--tp-text)" }}>
            {trip.name || fr.trip.unnamed}
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--tp-text-muted)" }}>
            {fr.planning.distLabel(trip.metadata.distance_m / 1000)} · {fr.planning.elevLabel(trip.metadata.elev_gain_m)} {fr.trip.elevGain.toLowerCase()}
          </p>
        </div>
        <span className="tp-badge tp-badge-green text-xs">V1 · Bêta</span>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl w-full mx-auto flex flex-col gap-4">
        <PaceParamsPanel />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div style={{ height: 360 }}>
            <TrailMap points={simplifiedPoints} days={days} hoveredDayIndex={hoveredDayIndex} />
          </div>
          <ElevationProfile
            points={simplifiedPoints}
            days={days}
            hoveredDayIndex={hoveredDayIndex}
            onHoverDay={setHoveredDay}
            onAdjustBoundary={adjustBoundary}
          />
        </div>

        <DayList />
      </main>

      <footer
        className="text-center py-4 px-6 text-xs"
        style={{ color: "var(--tp-text-muted)", borderTop: "1px solid var(--tp-border)" }}
      >
        <p>
          {fr.attribution.osm} · {fr.attribution.tiles}
        </p>
      </footer>
    </div>
  );
}
