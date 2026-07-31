"use client";

/**
 * components/planning/WaypointList.tsx
 * Liste des points d'étape placés, avec suppression.
 */
import { usePlanStore } from "@/lib/planStore";
import { waypointStyle } from "@/lib/utils";
import { fr } from "@/i18n/fr";

const TYPE_LABEL = {
  bivouac: fr.waypoints.typeBivouac,
  ravitaillement: fr.waypoints.typeResupply,
  checkpoint: fr.waypoints.typeCheckpoint,
} as const;

export default function WaypointList() {
  const waypoints = usePlanStore((s) => s.waypoints);
  const removeWaypoint = usePlanStore((s) => s.removeWaypoint);

  if (waypoints.length === 0) return null;

  return (
    <div className="tp-card p-4">
      <ul className="flex flex-col divide-y" style={{ borderColor: "var(--tp-border)" }}>
        {waypoints.map((w) => {
          const style = waypointStyle(w.type);
          return (
            <li key={w.id} className="flex items-center justify-between py-2 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden="true">{style.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--tp-text)" }}>
                    {w.label || TYPE_LABEL[w.type]}
                  </p>
                  <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
                    {TYPE_LABEL[w.type]}
                    {w.dist_cumul !== null ? ` · ${fr.planning.distLabel(w.dist_cumul / 1000)}` : ""}
                    {w.day_index !== null ? ` · ${fr.planning.dayLabel(w.day_index + 1)}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => w.id !== undefined && removeWaypoint(w.id)}
                className="text-xs px-2 py-1 rounded shrink-0"
                style={{ color: "var(--tp-red)" }}
                aria-label={`${fr.waypoints.remove} ${w.label || TYPE_LABEL[w.type]}`}
              >
                {fr.waypoints.remove}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
