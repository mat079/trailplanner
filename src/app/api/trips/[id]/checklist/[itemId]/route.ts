/**
 * app/api/trips/[id]/checklist/[itemId]/route.ts
 * PATCH : coche/décoche un item. DELETE : supprime un item (généré ou personnalisé).
 */
import { NextRequest, NextResponse } from "next/server";
import { setChecklistItemChecked, deleteChecklistItem } from "@/lib/db";
import type { ApiResponse, ChecklistItem } from "@/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse<ApiResponse<{ item: ChecklistItem }>>> {
  try {
    const { id, itemId } = await params;
    const numericId = Number(itemId);
    if (!Number.isInteger(numericId)) {
      return NextResponse.json({ ok: false, error: "Identifiant d'item invalide." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (typeof body?.checked !== "boolean") {
      return NextResponse.json({ ok: false, error: "checked (booléen) requis." }, { status: 400 });
    }

    const item = await setChecklistItemChecked(id, numericId, body.checked);
    if (!item) {
      return NextResponse.json({ ok: false, error: "Item introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { item } });
  } catch (err) {
    console.error("[api/trips/[id]/checklist/[itemId]][PATCH] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la mise à jour de l'item." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const { id, itemId } = await params;
    const numericId = Number(itemId);
    if (!Number.isInteger(numericId)) {
      return NextResponse.json({ ok: false, error: "Identifiant d'item invalide." }, { status: 400 });
    }

    const deleted = await deleteChecklistItem(id, numericId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Item introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error("[api/trips/[id]/checklist/[itemId]][DELETE] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la suppression de l'item." },
      { status: 500 }
    );
  }
}
