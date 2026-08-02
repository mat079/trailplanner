"use client";

/**
 * components/planning/ChecklistPanel.tsx
 * Checklist matériel générée par contexte (altitude, météo, nuits), groupée
 * par catégorie, avec ajout d'items personnalisés.
 */
import { useState } from "react";
import { usePlanStore } from "@/lib/planStore";
import { Button } from "@/components/ui/button";
import { fr } from "@/i18n/fr";
import type { ChecklistCategory } from "@/types";

const CATEGORY_ORDER: ChecklistCategory[] = [
  "navigation",
  "clothing",
  "bivouac",
  "nutrition",
  "safety",
  "admin",
];

function AddItemForm() {
  const addItem = usePlanStore((s) => s.addChecklistItem);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("navigation");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    void addItem(trimmed, category);
    setLabel("");
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
      <input
        type="text"
        className="tp-input"
        style={{ flex: "1 1 200px" }}
        placeholder={fr.checklist.addPlaceholder}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label={fr.checklist.addItem}
      />
      <select
        className="tp-input"
        style={{ width: "auto" }}
        value={category}
        onChange={(e) => setCategory(e.target.value as ChecklistCategory)}
        aria-label={fr.checklist.addCategory}
      >
        {CATEGORY_ORDER.map((cat) => (
          <option key={cat} value={cat}>
            {fr.checklist.categories[cat]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={!label.trim()}>
        {fr.checklist.addBtn}
      </Button>
    </form>
  );
}

export default function ChecklistPanel() {
  const days = usePlanStore((s) => s.days);
  const items = usePlanStore((s) => s.checklistItems);
  const loading = usePlanStore((s) => s.checklistLoading);
  const error = usePlanStore((s) => s.checklistError);
  const toggleItem = usePlanStore((s) => s.toggleChecklistItem);
  const removeItem = usePlanStore((s) => s.removeChecklistItem);
  const generate = usePlanStore((s) => s.generateChecklist);

  if (days.length === 0) return null;

  const done = items.filter((i) => i.checked).length;
  const total = items.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h3 className="tp-heading text-sm" style={{ color: "var(--tp-text)" }}>
            {fr.checklist.title}
          </h3>
          <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
            {fr.checklist.generated}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs" style={{ color: done === total ? "var(--tp-sage)" : "var(--tp-text-muted)" }}>
              {done === total ? fr.checklist.allChecked : fr.checklist.progress(done, total)}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => void generate()} disabled={loading}>
            {loading ? fr.checklist.regenerating : fr.checklist.regenerate}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs mb-2" style={{ color: "var(--tp-red)" }} role="alert">
          {error}
        </p>
      )}

      {total === 0 && !loading && (
        <p className="text-xs mb-3" style={{ color: "var(--tp-text-muted)" }}>
          {fr.checklist.empty}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        {CATEGORY_ORDER.map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat} className="tp-card p-4">
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--tp-text)" }}>
                {fr.checklist.categories[cat]}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {catItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.id !== undefined && void toggleItem(item.id, e.target.checked)}
                      id={`checklist-item-${item.id}`}
                    />
                    <label
                      htmlFor={`checklist-item-${item.id}`}
                      className="flex-1"
                      style={{
                        color: item.checked ? "var(--tp-text-muted)" : "var(--tp-text)",
                        textDecoration: item.checked ? "line-through" : "none",
                      }}
                    >
                      {item.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => item.id !== undefined && void removeItem(item.id)}
                      aria-label={`${fr.checklist.removeItem} ${item.label}`}
                      className="text-xs shrink-0"
                      style={{ color: "var(--tp-text-muted)" }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="tp-card p-4">
        <p className="tp-label mb-2">{fr.checklist.addItem}</p>
        <AddItemForm />
      </div>
    </div>
  );
}
