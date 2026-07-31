"use client";

/**
 * components/planning/WaypointToolbar.tsx
 * Sélection du type de point d'étape à placer, puis clic sur la carte pour le poser.
 */
import { usePlanStore } from "@/lib/planStore";
import { Button } from "@/components/ui/button";
import { waypointStyle } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import type { WaypointType } from "@/types";

const OPTIONS: { type: WaypointType; label: string }[] = [
  { type: "bivouac", label: fr.waypoints.addBivouac },
  { type: "ravitaillement", label: fr.waypoints.addResupply },
  { type: "checkpoint", label: fr.waypoints.addCheckpoint },
];

export default function WaypointToolbar() {
  const placingType = usePlanStore((s) => s.placingType);
  const setPlacingType = usePlanStore((s) => s.setPlacingType);

  return (
    <div className="tp-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="tp-heading text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.waypoints.title}
        </h3>
        {placingType && (
          <p className="text-xs" style={{ color: "var(--tp-amber)" }}>
            {fr.waypoints.clickOnMap}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = placingType === opt.type;
          const style = waypointStyle(opt.type);
          return (
            <Button
              key={opt.type}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setPlacingType(active ? null : opt.type)}
              style={active ? undefined : { borderColor: style.color }}
            >
              <span aria-hidden="true">{style.icon}</span> {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
