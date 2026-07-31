"use client";

/**
 * components/planning/PlanClient.tsx
 * Orchestration client de la page /plan/[id] : carte, profil, paramètres, jours, points d'étape.
 */
import { useEffect } from "react";
import { usePlanStore } from "@/lib/planStore";
import TrailMap from "@/components/map/TrailMap";
import ElevationProfile from "@/components/elevation/ElevationProfile";
import PaceParamsPanel from "@/components/planning/PaceParamsPanel";
import DayList from "@/components/planning/DayList";
import WaypointToolbar from "@/components/planning/WaypointToolbar";
import WaypointList from "@/components/planning/WaypointList";
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
  const waypoints = usePlanStore((s) => s.waypoints);
  const placingType = usePlanStore((s) => s.placingType);
  const addWaypointAt = usePlanStore((s) => s.addWaypointAt);
  const error = usePlanStore((s) => s.error);

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
        <WaypointToolbar />

        {error && (
          <p className="text-sm px-1" style={{ color: "var(--tp-red)" }} role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div style={{ height: 360 }}>
            <TrailMap
              points={simplifiedPoints}
              days={days}
              hoveredDayIndex={hoveredDayIndex}
              waypoints={waypoints}
              placingType={placingType}
              onMapClick={addWaypointAt}
            />
          </div>
          <ElevationProfile
            points={simplifiedPoints}
            days={days}
            hoveredDayIndex={hoveredDayIndex}
            onHoverDay={setHoveredDay}
            onAdjustBoundary={adjustBoundary}
          />
        </div>

        <WaypointList />
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
