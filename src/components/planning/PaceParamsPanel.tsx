"use client";

/**
 * components/planning/PaceParamsPanel.tsx
 * Paramètres du modèle de rythme (Option C) — valeurs pré-remplies, override utilisateur.
 */
import { usePlanStore } from "@/lib/planStore";
import { Button } from "@/components/ui/button";
import { fr } from "@/i18n/fr";

export default function PaceParamsPanel() {
  const paceParams = usePlanStore((s) => s.paceParams);
  const setPaceParams = usePlanStore((s) => s.setPaceParams);
  const computeDays = usePlanStore((s) => s.computeDays);
  const computing = usePlanStore((s) => s.computing);
  const error = usePlanStore((s) => s.error);

  return (
    <div className="tp-card p-4">
      <h3 className="tp-heading text-sm mb-3" style={{ color: "var(--tp-text)" }}>
        {fr.planning.title}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="tp-label block mb-1">
            {fr.planning.paceSpeed} ({fr.planning.paceSpeedUnit})
          </span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className="tp-input"
            value={paceParams.speed_kmh}
            onChange={(e) => setPaceParams({ speed_kmh: Number(e.target.value) })}
          />
        </label>

        <label className="block">
          <span className="tp-label block mb-1">
            {fr.planning.paceElevCoeff} ({fr.planning.paceElevUnit})
          </span>
          <input
            type="number"
            min={0}
            step={1}
            className="tp-input"
            value={paceParams.elev_coeff_min_per_100m}
            onChange={(e) => setPaceParams({ elev_coeff_min_per_100m: Number(e.target.value) })}
          />
        </label>

        <label className="block">
          <span className="tp-label block mb-1">{fr.planning.hoursPerDay}</span>
          <input
            type="number"
            min={1}
            max={24}
            step={0.5}
            className="tp-input"
            value={paceParams.hours_per_day}
            onChange={(e) => setPaceParams({ hours_per_day: Number(e.target.value) })}
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--tp-red)" }} role="alert">
          {error}
        </p>
      )}

      <Button className="mt-4 w-full sm:w-auto" onClick={() => computeDays()} disabled={computing}>
        {computing ? fr.planning.computing : fr.planning.compute}
      </Button>
    </div>
  );
}
