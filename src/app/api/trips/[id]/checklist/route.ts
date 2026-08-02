/**
 * app/api/trips/[id]/checklist/route.ts
 * Checklist matériel — étape 7.
 *
 * GET  : liste tous les items (générés + personnalisés).
 * POST : ajoute un item personnalisé (custom = true).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getChecklistItems, addChecklistItem } from "@/lib/db";
import type { ApiResponse, ChecklistCategory, ChecklistItem } from "@/types";

const CATEGORIES: ChecklistCategory[] = ["navigation", "clothing", "bivouac", "nutrition", "safety", "admin"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ items: ChecklistItem[] }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }
    const items = await getChecklistItems(id);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (err) {
    console.error("[api/trips/[id]/checklist][GET] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération de la checklist." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ item: ChecklistItem }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    const category = body?.category;

    if (!label) {
      return NextResponse.json({ ok: false, error: "Le libellé de l'item est requis." }, { status: 400 });
    }
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { ok: false, error: `Catégorie invalide (${CATEGORIES.join(", ")}).` },
        { status: 400 }
      );
    }

    const item = await addChecklistItem(id, { label, category });
    return NextResponse.json({ ok: true, data: { item } });
  } catch (err) {
    console.error("[api/trips/[id]/checklist][POST] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de l'ajout de l'item." },
      { status: 500 }
    );
  }
}
