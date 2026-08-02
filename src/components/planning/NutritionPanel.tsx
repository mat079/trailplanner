"use client";

/**
 * components/planning/NutritionPanel.tsx
 * Besoins en glucides/heure par jour, avec override manuel possible.
 */
import { useState } from "react";
import { usePlanStore } from "@/lib/planStore";
import { Button } from "@/components/ui/button";
import { fr } from "@/i18n/fr";
import type { IntensityZone } from "@/types";

const INTENSITY_LABEL: Record<IntensityZone, string> = {
  endurance: fr.nutrition.intensityLow,
  tempo: fr.nutrition.intensityMid,
  threshold: fr.nutrition.intensityHigh,
};

function NutritionSection({ dayIndex }: { dayIndex: number }) {
  const nutrition = usePlanStore((s) => s.nutritionByDay[dayIndex]);
  const setOverride = usePlanStore((s) => s.setNutritionOverride);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  if (!nutrition) return null;

  const commit = () => {
    const value = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(value) || value <= 0) return;
    setEditing(false);
    void setOverride(dayIndex, value);
  };

  return (
    <div className="tp-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.planning.dayLabel(dayIndex + 1)}
        </span>
        <span className="tp-badge tp-badge-amber text-xs">{INTENSITY_LABEL[nutrition.intensity]}</span>
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-xs mb-3" style={{ color: "var(--tp-text-muted)" }}>
        <dt>{fr.nutrition.perHour}</dt>
        <dd className="text-right" style={{ color: "var(--tp-text)" }}>
          {nutrition.effective_g_h.toFixed(0)} g/h
        </dd>
        <dt>{fr.nutrition.perDay}</dt>
        <dd className="text-right" style={{ color: "var(--tp-text)" }}>
          {nutrition.total_carbs_g} g
        </dd>
      </dl>

      {nutrition.override_g_h !== null ? (
        <button
          type="button"
          className="text-xs underline"
          style={{ color: "var(--tp-sky)" }}
          onClick={() => void setOverride(dayIndex, null)}
        >
          {fr.nutrition.overrideReset}
        </button>
      ) : editing ? (
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            autoFocus
            className="tp-input"
            placeholder={fr.nutrition.overridePlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
          <Button type="button" size="sm" onClick={commit}>
            {fr.nutrition.overrideConfirm}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {fr.nutrition.overrideCancel}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs underline"
          style={{ color: "var(--tp-text-muted)" }}
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
        >
          {fr.nutrition.overrideLabel} ({fr.nutrition.overrideUnit})
        </button>
      )}
    </div>
  );
}

export default function NutritionPanel() {
  const days = usePlanStore((s) => s.days);
  const tripTotalG = usePlanStore((s) => s.nutritionTripTotalG);
  const error = usePlanStore((s) => s.nutritionError);

  if (days.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="tp-heading text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.nutrition.title}
        </h3>
        <span className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
          {fr.nutrition.tripTotal} : {tripTotalG} g
        </span>
      </div>

      {error && (
        <p className="text-xs mb-2" style={{ color: "var(--tp-red)" }} role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {days.map((d) => (
          <NutritionSection key={d.day_index} dayIndex={d.day_index} />
        ))}
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--tp-text-muted)" }}>
        {fr.nutrition.hint}
      </p>
    </div>
  );
}
