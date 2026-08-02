/**
 * app/api/trips/[id]/nutrition/route.ts
 * Besoins en glucides/heure par jour — étape 6.
 *
 * GET   : calcule les besoins de tous les jours (aucun calcul externe, pas
 *         de cache nécessaire) + le total sortie.
 * PATCH : définit (ou efface avec null) l'override manuel d'un jour.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, setNutritionOverride } from "@/lib/db";
import { computeAllDayNutrition } from "@/lib/nutritionSummary";
import { computeTripTotalCarbsG } from "@/modules/nutrition/carbsCalc";
import type { ApiResponse, DayNutrition } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ days: DayNutrition[]; trip_total_g: number }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const days = await computeAllDayNutrition(id, trip);
    return NextResponse.json({ ok: true, data: { days, trip_total_g: computeTripTotalCarbsG(days) } });
  } catch (err) {
    console.error("[api/trips/[id]/nutrition][GET] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors du calcul des besoins en glucides." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ days: DayNutrition[]; trip_total_g: number }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const dayIndex = Number(body?.day_index);
    if (!Number.isInteger(dayIndex) || dayIndex < 0) {
      return NextResponse.json(
        { ok: false, error: "day_index requis (entier positif ou nul)." },
        { status: 400 }
      );
    }

    const overrideRaw = body?.override_g_h;
    let overrideGH: number | null;
    if (overrideRaw === null) {
      overrideGH = null;
    } else if (typeof overrideRaw === "number" && overrideRaw > 0 && Number.isFinite(overrideRaw)) {
      overrideGH = overrideRaw;
    } else {
      return NextResponse.json(
        { ok: false, error: "override_g_h doit être un nombre strictement positif, ou null pour l'effacer." },
        { status: 400 }
      );
    }

    const updated = await setNutritionOverride(id, dayIndex, overrideGH);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Jour introuvable. Calculez d'abord le découpage en jours." },
        { status: 404 }
      );
    }

    const days = await computeAllDayNutrition(id, trip);
    return NextResponse.json({ ok: true, data: { days, trip_total_g: computeTripTotalCarbsG(days) } });
  } catch (err) {
    console.error("[api/trips/[id]/nutrition][PATCH] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la mise à jour de l'override." },
      { status: 500 }
    );
  }
}
