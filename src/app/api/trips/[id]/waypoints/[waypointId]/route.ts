/**
 * app/api/trips/[id]/waypoints/[waypointId]/route.ts
 * Suppression d'un point d'étape.
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteWaypoint, setDayBivouac } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; waypointId: string }> }
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const { id, waypointId } = await params;
    const numericId = Number(waypointId);
    if (!Number.isInteger(numericId)) {
      return NextResponse.json({ ok: false, error: "Identifiant de point d'étape invalide." }, { status: 400 });
    }

    const deleted = await deleteWaypoint(id, numericId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Point d'étape introuvable." }, { status: 404 });
    }

    if (deleted.type === "bivouac" && deleted.day_index !== null) {
      try {
        await setDayBivouac(id, deleted.day_index, null);
      } catch (bivouacErr) {
        console.warn(
          "[api/trips/[id]/waypoints/[waypointId]][DELETE] Échec effacement bivouac_* du jour:",
          (bivouacErr as Error).message
        );
      }
    }

    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error("[api/trips/[id]/waypoints/[waypointId]][DELETE] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la suppression du point d'étape." },
      { status: 500 }
    );
  }
}
