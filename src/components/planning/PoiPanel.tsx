"use client";

/**
 * components/planning/PoiPanel.tsx
 * Commerces et points d'eau par section (jour), via Overpass API.
 */
import { usePlanStore } from "@/lib/planStore";
import { Button } from "@/components/ui/button";
import { poiStyle } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { DEFAULT_BUFFER_M } from "@/modules/poi/overpass";
import type { Poi } from "@/types";

function PoiSection({ dayIndex }: { dayIndex: number }) {
  const poi = usePlanStore((s) => s.poiByDay[dayIndex]) ?? [];
  const loading = usePlanStore((s) => s.poiLoading[dayIndex]) ?? false;
  const stale = usePlanStore((s) => s.poiStale[dayIndex]) ?? false;
  const error = usePlanStore((s) => s.poiError[dayIndex]);
  const loadPoi = usePlanStore((s) => s.loadPoi);
  const isTrail = usePlanStore((s) => s.trip?.activity_type) === "trail";

  // En trail, seuls les points d'eau sont pertinents : les commerces (boulangerie,
  // supermarché, épicerie) supposent un accès en cours de course qui n'a pas de sens
  // sur ce type d'activité — seul le besoin en glucides/gels compte (cf. NutritionPanel).
  const visiblePoi = isTrail ? poi.filter((p) => p.type === "water") : poi;

  const grouped = visiblePoi.reduce<Record<string, Poi[]>>((acc, p) => {
    (acc[p.type] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="tp-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.poi.sectionLabel(dayIndex + 1)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => loadPoi(dayIndex, true)}
          disabled={loading}
        >
          {fr.poi.refresh}
        </Button>
      </div>

      {stale && (
        <p className="text-xs mb-2" style={{ color: "var(--tp-amber)" }}>
          {fr.poi.staleNotice}
        </p>
      )}

      {loading && visiblePoi.length === 0 && (
        <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.poi.loading}
        </p>
      )}

      {error && !loading && (
        <p className="text-xs" style={{ color: "var(--tp-red)" }} role="alert">
          {error}
        </p>
      )}

      {!loading && !error && visiblePoi.length === 0 && (
        <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.poi.noResult}
        </p>
      )}

      {Object.entries(grouped).length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-1">
          {Object.entries(grouped).map(([type, items]) => {
            const style = poiStyle(type as Poi["type"]);
            return (
              <li key={type} className="flex items-start gap-2 text-xs">
                <span aria-hidden="true">{style.icon}</span>
                <span style={{ color: "var(--tp-text)" }}>
                  {items.length > 1 ? `${items.length} × ` : ""}
                  {fr.poi[type as Poi["type"]]}
                  {items[0].name ? ` — ${items[0].name}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PoiPanel() {
  const days = usePlanStore((s) => s.days);
  const isTrail = usePlanStore((s) => s.trip?.activity_type) === "trail";

  if (days.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="tp-heading text-sm" style={{ color: "var(--tp-text)" }}>
          {isTrail ? fr.poi.titleWaterOnly : fr.poi.title}
        </h3>
        <span className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.poi.bufferLabel} : {DEFAULT_BUFFER_M} {fr.poi.bufferUnit}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {days.map((d) => (
          <PoiSection key={d.day_index} dayIndex={d.day_index} />
        ))}
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--tp-text-muted)" }}>
        {fr.poi.attribution}
      </p>
    </div>
  );
}
