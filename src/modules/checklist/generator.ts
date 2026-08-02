/**
 * modules/checklist/generator.ts
 * Génération de checklist matériel contextuelle — règles sur l'altitude max,
 * la météo (pluie, neige, froid) et le nombre de nuits en bivouac.
 */
import type { ChecklistCategory } from "@/types";

export const COLD_THRESHOLD_C = 5;
export const HIGH_ALTITUDE_THRESHOLD_M = 2500;

export interface ChecklistContext {
  maxEleM: number;
  nights: number;
  hasRain: boolean;
  hasSnow: boolean;
  hasCold: boolean;
}

export interface GeneratedChecklistItem {
  label: string;
  category: ChecklistCategory;
}

const BASE_ITEMS: GeneratedChecklistItem[] = [
  { label: "Carte et/ou trace GPS de l'itinéraire", category: "navigation" },
  { label: "Boussole", category: "navigation" },
  { label: "Téléphone chargé + batterie externe", category: "navigation" },
  { label: "Chaussures de randonnée", category: "clothing" },
  { label: "Chaussettes de rechange", category: "clothing" },
  { label: "Veste imperméable / coupe-vent", category: "clothing" },
  { label: "Gourde ou poche à eau", category: "nutrition" },
  { label: "Barres / en-cas énergétiques", category: "nutrition" },
  { label: "Trousse de premiers secours", category: "safety" },
  { label: "Couverture de survie", category: "safety" },
  { label: "Lampe frontale", category: "safety" },
  { label: "Sifflet", category: "safety" },
  { label: "Pièce d'identité", category: "admin" },
  { label: "Carte vitale / assurance rapatriement", category: "admin" },
];

const BIVOUAC_ITEMS: GeneratedChecklistItem[] = [
  { label: "Sac de couchage adapté aux températures nocturnes", category: "bivouac" },
  { label: "Tapis de sol / matelas gonflable", category: "bivouac" },
  { label: "Tente ou tarp", category: "bivouac" },
  { label: "Réchaud + gaz", category: "bivouac" },
  { label: "Popote / gamelle + couverts", category: "bivouac" },
  { label: "Repas lyophilisés", category: "nutrition" },
];

const RAIN_ITEMS: GeneratedChecklistItem[] = [
  { label: "Sur-pantalon imperméable", category: "clothing" },
  { label: "Guêtres", category: "clothing" },
  { label: "Housse imperméable pour le sac à dos", category: "clothing" },
  { label: "Sacs plastiques étanches pour les affaires sensibles", category: "bivouac" },
];

const SNOW_ITEMS: GeneratedChecklistItem[] = [
  { label: "Crampons ou microspikes", category: "clothing" },
  { label: "Guêtres hautes", category: "clothing" },
  { label: "Lunettes de soleil catégorie 4", category: "clothing" },
  { label: "Crème solaire haute protection (réverbération neige)", category: "clothing" },
];

const COLD_ITEMS: GeneratedChecklistItem[] = [
  { label: "Bonnet", category: "clothing" },
  { label: "Gants", category: "clothing" },
  { label: "Doudoune ou polaire chaude", category: "clothing" },
  { label: "Sous-vêtements thermiques", category: "clothing" },
];

const ALTITUDE_ITEMS: GeneratedChecklistItem[] = [
  { label: "Lunettes de soleil catégorie 3 minimum (exposition UV altitude)", category: "clothing" },
  { label: "Crème solaire indice élevé", category: "clothing" },
];

/** Génère la checklist contextuelle. Toujours déterministe pour un contexte donné. */
export function generateChecklist(ctx: ChecklistContext): GeneratedChecklistItem[] {
  const items: GeneratedChecklistItem[] = [...BASE_ITEMS];
  if (ctx.nights >= 1) items.push(...BIVOUAC_ITEMS);
  if (ctx.hasRain) items.push(...RAIN_ITEMS);
  if (ctx.hasSnow) items.push(...SNOW_ITEMS);
  if (ctx.hasCold) items.push(...COLD_ITEMS);
  if (ctx.maxEleM >= HIGH_ALTITUDE_THRESHOLD_M) items.push(...ALTITUDE_ITEMS);

  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.label)) return false;
    seen.add(it.label);
    return true;
  });
}
