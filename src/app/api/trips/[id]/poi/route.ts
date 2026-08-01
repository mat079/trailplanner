/**
 * app/api/trips/[id]/poi/route.ts
 * Points d'intérêt (boulangerie, épicerie/supermarché, eau) via Overpass — étape 4.
 *
 * GET ?day_index=N        : cache-first (TTL 24h), sinon requête Overpass live.
 * GET ?day_index=N&refresh=true : bypass le cache, force une requête Overpass fraîche.
 *
 * Résilience : si Overpass est indisponible (le service public est parfois
 * surchargé), on retombe sur le cache même expiré plutôt que de renvoyer une
 * section vide ou une erreur bloquante.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrip, getTripPoints, getDays, getCachedPoi, getStalePoi, savePoi } from "@/lib/db";
import { fetchOverpassPoi, DEFAULT_BUFFER_M, type ParsedPoi } from "@/modules/poi/overpass";
import type { ApiResponse, Poi } from "@/types";

const OVERPASS_TIMEOUT_MS = 20_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ poi: Poi[]; cached: boolean; stale: boolean }>>> {
  try {
    const { id } = await params;
    const trip = await getTrip(id);
    if (!trip) {
      return NextResponse.json({ ok: false, error: "Sortie introuvable." }, { status: 404 });
    }

    const dayIndexParam = req.nextUrl.searchParams.get("day_index");
    const dayIndex = Number(dayIndexParam);
    if (dayIndexParam === null || !Number.isInteger(dayIndex) || dayIndex < 0) {
      return NextResponse.json(
        { ok: false, error: "day_index requis (entier positif ou nul)." },
        { status: 400 }
      );
    }

    const days = await getDays(id);
    const day = days.find((d) => d.day_index === dayIndex);
    if (!day) {
      return NextResponse.json(
        { ok: false, error: "Jour introuvable. Calculez d'abord le découpage en jours." },
        { status: 404 }
      );
    }

    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

    if (!forceRefresh) {
      const cached = await getCachedPoi(id, dayIndex);
      if (cached.length > 0) {
        return NextResponse.json({ ok: true, data: { poi: cached, cached: true, stale: false } });
      }
    }

    const points = await getTripPoints(id);
    const slice = points.slice(day.start_point_index, day.end_point_index + 1);
    if (slice.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Section de trace introuvable pour ce jour." },
        { status: 422 }
      );
    }

    let parsed: ParsedPoi[];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
      try {
        parsed = await fetchOverpassPoi(slice, DEFAULT_BUFFER_M, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
    } catch (overpassErr) {
      console.warn(
        "[api/trips/[id]/poi] Overpass indisponible, tentative de repli sur le cache expiré:",
        (overpassErr as Error).message
      );
      const stale = await getStalePoi(id, dayIndex);
      if (stale.length > 0) {
        return NextResponse.json({ ok: true, data: { poi: stale, cached: true, stale: true } });
      }
      return NextResponse.json(
        { ok: false, error: "Service de points d'intérêt indisponible pour le moment. Réessayez plus tard." },
        { status: 503 }
      );
    }

    try {
      const saved = await savePoi(id, dayIndex, parsed);
      return NextResponse.json({ ok: true, data: { poi: saved, cached: false, stale: false } });
    } catch (saveErr) {
      // Overpass a répondu, seule la mise en cache (Postgres) a échoué : la
      // requête est un succès pour l'utilisateur, la mise en cache n'est
      // qu'une optimisation. Log distinct pour ne pas pointer vers Overpass
      // en cas de débogage d'un problème DB.
      console.error(
        "[api/trips/[id]/poi] Échec de la mise en cache POI (DB), résultats Overpass servis sans cache:",
        (saveErr as Error).message
      );
      const uncached: Poi[] = parsed.map((p) => ({
        ...p,
        trip_id: id,
        day_index: dayIndex,
        fetched_at: new Date().toISOString(),
      }));
      return NextResponse.json({ ok: true, data: { poi: uncached, cached: false, stale: false } });
    }
  } catch (err) {
    console.error("[api/trips/[id]/poi] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération des points d'intérêt." },
      { status: 500 }
    );
  }
}
