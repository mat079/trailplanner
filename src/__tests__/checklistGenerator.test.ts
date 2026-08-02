import { describe, it, expect } from "vitest";
import {
  generateChecklist,
  COLD_THRESHOLD_C,
  HIGH_ALTITUDE_THRESHOLD_M,
  type ChecklistContext,
} from "@/modules/checklist/generator";

const BASE_CTX: ChecklistContext = {
  maxEleM: 1000,
  nights: 0,
  hasRain: false,
  hasSnow: false,
  hasCold: false,
};

function labelsOf(ctx: ChecklistContext): string[] {
  return generateChecklist(ctx).map((i) => i.label);
}

describe("generateChecklist", () => {
  it("inclut toujours les items de base (navigation, sécurité, admin, etc.)", () => {
    const items = generateChecklist(BASE_CTX);
    expect(items.some((i) => i.category === "navigation")).toBe(true);
    expect(items.some((i) => i.category === "safety")).toBe(true);
    expect(items.some((i) => i.category === "admin")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("n'inclut aucun item de catégorie bivouac pour une sortie à la journée (0 nuit)", () => {
    const items = generateChecklist({ ...BASE_CTX, nights: 0 });
    expect(items.some((i) => i.category === "bivouac")).toBe(false);
  });

  it("inclut les items de bivouac dès 1 nuit", () => {
    const items = generateChecklist({ ...BASE_CTX, nights: 1 });
    expect(items.some((i) => i.category === "bivouac")).toBe(true);
    expect(labelsOf({ ...BASE_CTX, nights: 1 })).toContain("Réchaud + gaz");
  });

  it("ajoute les items pluie uniquement si hasRain", () => {
    expect(labelsOf({ ...BASE_CTX, hasRain: true })).toContain("Guêtres");
    expect(labelsOf({ ...BASE_CTX, hasRain: false })).not.toContain("Guêtres");
  });

  it("ajoute les items neige uniquement si hasSnow", () => {
    expect(labelsOf({ ...BASE_CTX, hasSnow: true })).toContain("Microspikes");
    expect(labelsOf({ ...BASE_CTX, hasSnow: false })).not.toContain("Microspikes");
  });

  it("ajoute les items froid uniquement si hasCold", () => {
    expect(labelsOf({ ...BASE_CTX, hasCold: true })).toContain("Bonnet");
    expect(labelsOf({ ...BASE_CTX, hasCold: false })).not.toContain("Bonnet");
  });

  it("ajoute les items haute altitude au seuil, pas en dessous", () => {
    const below = labelsOf({ ...BASE_CTX, maxEleM: HIGH_ALTITUDE_THRESHOLD_M - 1 });
    const at = labelsOf({ ...BASE_CTX, maxEleM: HIGH_ALTITUDE_THRESHOLD_M });
    expect(below).not.toContain("Crème solaire indice élevé");
    expect(at).toContain("Crème solaire indice élevé");
  });

  it("cumule plusieurs règles simultanément (pluie + neige + froid + altitude + nuits)", () => {
    const items = generateChecklist({
      maxEleM: 3200,
      nights: 2,
      hasRain: true,
      hasSnow: true,
      hasCold: true,
    });
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Réchaud + gaz");
    expect(labels).toContain("Guêtres");
    expect(labels).toContain("Microspikes");
    expect(labels).toContain("Bonnet");
    expect(labels).toContain("Lunettes de soleil catégorie 3 minimum (exposition UV altitude)");
  });

  it("ne génère jamais de doublon de label", () => {
    const items = generateChecklist({
      maxEleM: 3200,
      nights: 2,
      hasRain: true,
      hasSnow: true,
      hasCold: true,
    });
    const labels = items.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("est déterministe pour un même contexte", () => {
    expect(generateChecklist(BASE_CTX)).toEqual(generateChecklist(BASE_CTX));
  });

  it(`COLD_THRESHOLD_C vaut ${COLD_THRESHOLD_C}`, () => {
    expect(COLD_THRESHOLD_C).toBe(5);
  });
});
