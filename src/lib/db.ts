/**
 * lib/db.ts
 * Client PostgreSQL partagé avec fallback en mémoire strictement réservé au développement local
 * (permet de tester l'application en dev si le conteneur Postgres n'est pas lancé).
 */
import { Pool } from "pg";
import { computeDayDate } from "@/modules/planning/dayBuilder";
import type { Trip, GpxPoint, Waypoint, TripDay, Poi, ChecklistItem, PaceParams } from "@/types";

declare global {
  var _pgPool: Pool | undefined;
  var _memoryStore: MemoryStore | undefined;
  var _cleanupInterval: ReturnType<typeof setInterval> | undefined;
  var _cleanupStarted: boolean | undefined;
}

// ── In-Memory Store Fallback (Dev Only) ───────────────────────────────────────

class MemoryStore {
  trips = new Map<string, Trip>();
  points = new Map<string, GpxPoint[]>();
  waypoints = new Map<string, Waypoint[]>();
  days = new Map<string, TripDay[]>();
  poi = new Map<string, Poi[]>();
  checklist = new Map<string, ChecklistItem[]>();
}

export const memoryStore: MemoryStore =
  globalThis._memoryStore ?? (globalThis._memoryStore = new MemoryStore());

const isDev = () => process.env.NODE_ENV !== "production";

// ── PostgreSQL Pool ────────────────────────────────────────────────────────────

function createPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL || "postgres://trailplanner:trailplanner@localhost:5432/trailplanner";
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });
}

const pool: Pool = globalThis._pgPool ?? createPool();
if (isDev()) {
  globalThis._pgPool = pool;
}

export { pool };

// ── Database Operations ────────────────────────────────────────────────────────

/**
 * Sauvegarde une nouvelle sortie et ses points GPX.
 */
export async function saveTrip(
  tripData: Omit<Trip, "id" | "share_token" | "created_at" | "last_accessed_at">,
  points: GpxPoint[]
): Promise<Trip> {
  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID();
  const now = new Date().toISOString();

  const trip: Trip = {
    id,
    session_id: tripData.session_id,
    share_token: shareToken,
    name: tripData.name,
    start_date: tripData.start_date ?? null,
    created_at: now,
    last_accessed_at: now,
    gpx_raw: tripData.gpx_raw,
    metadata: tripData.metadata,
  };

  try {
    const res = await pool.query<Trip>(
      `INSERT INTO trips (id, session_id, share_token, name, start_date, created_at, last_accessed_at, gpx_raw, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        trip.id,
        trip.session_id,
        trip.share_token,
        trip.name,
        trip.start_date,
        trip.created_at,
        trip.last_accessed_at,
        trip.gpx_raw,
        JSON.stringify(trip.metadata),
      ]
    );

    const CHUNK = 500;
    for (let i = 0; i < points.length; i += CHUNK) {
      const chunk = points.slice(i, i + CHUNK);
      const values = chunk
        .map((_, j) => {
          const b = j * 6;
          return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
        })
        .join(", ");

      const params: unknown[] = [];
      for (const pt of chunk) {
        params.push(trip.id, pt.lat, pt.lon, pt.ele, pt.dist_cumul, pt.order_index);
      }

      await pool.query(
        `INSERT INTO gpx_points (trip_id, lat, lon, ele, dist_cumul, order_index)
         VALUES ${values}`,
        params
      );
    }

    return res.rows[0];
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    console.warn("[DB] PostgreSQL non accessible, utilisation du mode mémoire local.", (err as Error).message);
    memoryStore.trips.set(id, trip);
    memoryStore.points.set(id, points);
    return trip;
  }
}

/**
 * Récupère une sortie par son ID.
 */
export async function getTrip(id: string): Promise<Trip | null> {
  try {
    const res = await pool.query<Trip>(
      `UPDATE trips SET last_accessed_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (res.rows.length > 0) return res.rows[0];
    return null;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    return memoryStore.trips.get(id) ?? null;
  }
}

/**
 * Met à jour la date de départ d'une sortie (nécessaire pour la météo et les
 * dates par jour) et répercute le changement sur trip_days.date pour les
 * jours déjà calculés, afin que les deux restent cohérents sans nécessiter un
 * recalcul complet du découpage. `null` efface la date (et celles des jours).
 */
export async function updateTripStartDate(id: string, startDate: string | null): Promise<Trip | null> {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query<Trip>(
        `UPDATE trips SET start_date = $2 WHERE id = $1 RETURNING *`,
        [id, startDate]
      );
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `UPDATE trip_days
         SET date = CASE WHEN $2::date IS NULL THEN NULL ELSE $2::date + (day_index * INTERVAL '1 day') END
         WHERE trip_id = $1`,
        [id, startDate]
      );
      await client.query("COMMIT");
      return res.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const trip = memoryStore.trips.get(id);
    if (!trip) return null;
    trip.start_date = startDate;
    const days = memoryStore.days.get(id);
    if (days) {
      memoryStore.days.set(
        id,
        days.map((d) => ({ ...d, date: computeDayDate(startDate, d.day_index) }))
      );
    }
    return trip;
  }
}

/**
 * Récupère les points GPX bruts d'une sortie.
 */
export async function getTripPoints(tripId: string): Promise<GpxPoint[]> {
  try {
    const res = await pool.query<GpxPoint>(
      `SELECT lat, lon, ele, dist_cumul, order_index FROM gpx_points WHERE trip_id = $1 ORDER BY order_index ASC`,
      [tripId]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    return memoryStore.points.get(tripId) ?? [];
  }
}

/**
 * Purge automatique des sorties inactives depuis > 90 jours.
 */
export async function purgeOldTrips(): Promise<number> {
  let deletedCount = 0;
  try {
    const res = await pool.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM trips WHERE last_accessed_at < NOW() - INTERVAL '90 days'
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM deleted`
    );
    deletedCount = parseInt(res.rows[0]?.count ?? "0", 10);
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const [id, trip] of memoryStore.trips.entries()) {
      const lastAccess = new Date(trip.last_accessed_at).getTime();
      if (lastAccess < cutoff) {
        memoryStore.trips.delete(id);
        memoryStore.points.delete(id);
        deletedCount++;
      }
    }
  }

  console.log(`[Purge] ${deletedCount} trip(s) inactif(s) depuis > 90 jours purgé(s).`);
  return deletedCount;
}

/**
 * Remplace intégralement le découpage en jours d'une sortie (transaction).
 */
export async function saveDays(tripId: string, days: TripDay[]): Promise<TripDay[]> {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM trip_days WHERE trip_id = $1`, [tripId]);
      const saved: TripDay[] = [];
      for (const d of days) {
        const res = await client.query<TripDay>(
          `INSERT INTO trip_days (trip_id, day_index, start_point_index, end_point_index, label, bivouac_lat, bivouac_lon, bivouac_ele, date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            tripId,
            d.day_index,
            d.start_point_index,
            d.end_point_index,
            d.label,
            d.bivouac_lat,
            d.bivouac_lon,
            d.bivouac_ele,
            d.date,
          ]
        );
        saved.push(res.rows[0]);
      }
      await client.query("COMMIT");
      return saved;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    console.warn("[DB] PostgreSQL non accessible, sauvegarde des jours en mémoire locale.", (err as Error).message);
    memoryStore.days.set(tripId, days);
    return days;
  }
}

/**
 * Récupère le découpage en jours d'une sortie (ordonné).
 */
export async function getDays(tripId: string): Promise<TripDay[]> {
  try {
    const res = await pool.query<TripDay>(
      `SELECT * FROM trip_days WHERE trip_id = $1 ORDER BY day_index ASC`,
      [tripId]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    return memoryStore.days.get(tripId) ?? [];
  }
}

/**
 * Met à jour un seul jour existant (ex. ajustement manuel d'un point de coupure).
 */
export async function updateDay(tripId: string, day: TripDay): Promise<TripDay> {
  try {
    const res = await pool.query<TripDay>(
      `UPDATE trip_days
       SET start_point_index = $3, end_point_index = $4, label = $5,
           bivouac_lat = $6, bivouac_lon = $7, bivouac_ele = $8, date = $9
       WHERE trip_id = $1 AND day_index = $2
       RETURNING *`,
      [
        tripId,
        day.day_index,
        day.start_point_index,
        day.end_point_index,
        day.label,
        day.bivouac_lat,
        day.bivouac_lon,
        day.bivouac_ele,
        day.date,
      ]
    );
    if (res.rows.length === 0) {
      throw new Error("Jour introuvable.");
    }
    return res.rows[0];
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const days = memoryStore.days.get(tripId) ?? [];
    const idx = days.findIndex((d) => d.day_index === day.day_index);
    if (idx === -1) {
      throw new Error("Jour introuvable (mode mémoire).");
    }
    days[idx] = { ...days[idx], ...day };
    memoryStore.days.set(tripId, days);
    return days[idx];
  }
}

/**
 * Enregistre les derniers paramètres de rythme utilisés sur le metadata JSONB du trip
 * (permet de recalculer les durées après un rechargement de page).
 */
export async function updateTripPaceParams(tripId: string, params: PaceParams): Promise<void> {
  try {
    await pool.query(
      `UPDATE trips SET metadata = metadata || $2::jsonb WHERE id = $1`,
      [tripId, JSON.stringify({ pace_params: params })]
    );
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const trip = memoryStore.trips.get(tripId);
    if (trip) {
      trip.metadata = { ...trip.metadata, pace_params: params };
    }
  }
}

/**
 * Crée un point d'étape (bivouac / ravitaillement / checkpoint), déjà snappé sur la trace.
 */
export async function saveWaypoint(
  tripId: string,
  data: Omit<Waypoint, "id" | "trip_id" | "created_at">
): Promise<Waypoint> {
  try {
    const res = await pool.query<Waypoint>(
      `INSERT INTO waypoints (trip_id, type, label, lat, lon, ele, point_index, dist_cumul, day_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tripId,
        data.type,
        data.label,
        data.lat,
        data.lon,
        data.ele,
        data.point_index,
        data.dist_cumul,
        data.day_index,
      ]
    );
    return res.rows[0];
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const waypoint: Waypoint = {
      id: Date.now(),
      trip_id: tripId,
      created_at: new Date().toISOString(),
      ...data,
    };
    const existing = memoryStore.waypoints.get(tripId) ?? [];
    existing.push(waypoint);
    memoryStore.waypoints.set(tripId, existing);
    return waypoint;
  }
}

/**
 * Liste les points d'étape d'une sortie, ordonnés le long de la trace.
 */
export async function getWaypoints(tripId: string): Promise<Waypoint[]> {
  try {
    const res = await pool.query<Waypoint>(
      `SELECT * FROM waypoints WHERE trip_id = $1 ORDER BY dist_cumul ASC NULLS LAST`,
      [tripId]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const waypoints = memoryStore.waypoints.get(tripId) ?? [];
    return [...waypoints].sort((a, b) => (a.dist_cumul ?? 0) - (b.dist_cumul ?? 0));
  }
}

/**
 * Supprime un point d'étape. Retourne true si une ligne a été supprimée.
 */
export async function deleteWaypoint(tripId: string, waypointId: number): Promise<Waypoint | null> {
  try {
    const res = await pool.query<Waypoint>(
      `DELETE FROM waypoints WHERE id = $1 AND trip_id = $2 RETURNING *`,
      [waypointId, tripId]
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const waypoints = memoryStore.waypoints.get(tripId) ?? [];
    const found = waypoints.find((w) => w.id === waypointId) ?? null;
    memoryStore.waypoints.set(
      tripId,
      waypoints.filter((w) => w.id !== waypointId)
    );
    return found;
  }
}

/**
 * Met à jour (ou efface) la localisation du bivouac d'un jour — utilisé par
 * la création/suppression d'un waypoint de type "bivouac" pour que la météo
 * (étape 5) dispose d'une localisation précise sans dupliquer la logique de
 * placement.
 */
export async function setDayBivouac(
  tripId: string,
  dayIndex: number,
  bivouac: { lat: number; lon: number; ele: number | null } | null
): Promise<TripDay | null> {
  try {
    const res = await pool.query<TripDay>(
      `UPDATE trip_days SET bivouac_lat = $3, bivouac_lon = $4, bivouac_ele = $5
       WHERE trip_id = $1 AND day_index = $2
       RETURNING *`,
      [tripId, dayIndex, bivouac?.lat ?? null, bivouac?.lon ?? null, bivouac?.ele ?? null]
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const days = memoryStore.days.get(tripId) ?? [];
    const idx = days.findIndex((d) => d.day_index === dayIndex);
    if (idx === -1) return null;
    days[idx] = {
      ...days[idx],
      bivouac_lat: bivouac?.lat ?? null,
      bivouac_lon: bivouac?.lon ?? null,
      bivouac_ele: bivouac?.ele ?? null,
    };
    memoryStore.days.set(tripId, days);
    return days[idx];
  }
}

/**
 * Définit (ou efface avec null) la cible manuelle de glucides/h d'un jour —
 * prime sur la recommandation automatique quand elle est définie.
 */
export async function setNutritionOverride(
  tripId: string,
  dayIndex: number,
  overrideGH: number | null
): Promise<TripDay | null> {
  try {
    const res = await pool.query<TripDay>(
      `UPDATE trip_days SET nutrition_override_g_h = $3
       WHERE trip_id = $1 AND day_index = $2
       RETURNING *`,
      [tripId, dayIndex, overrideGH]
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const days = memoryStore.days.get(tripId) ?? [];
    const idx = days.findIndex((d) => d.day_index === dayIndex);
    if (idx === -1) return null;
    days[idx] = { ...days[idx], nutrition_override_g_h: overrideGH };
    memoryStore.days.set(tripId, days);
    return days[idx];
  }
}

const POI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Récupère les POI en cache pour un jour donné, uniquement si le cache est
 * encore valide (TTL 24h). Retourne un tableau vide en cas d'absence ou
 * d'expiration — au caller de déclencher un refetch Overpass dans ce cas.
 */
export async function getCachedPoi(tripId: string, dayIndex: number): Promise<Poi[]> {
  try {
    const res = await pool.query<Poi>(
      `SELECT * FROM cached_poi
       WHERE trip_id = $1 AND day_index = $2 AND fetched_at > NOW() - INTERVAL '24 hours'
       ORDER BY type ASC, name ASC NULLS LAST`,
      [tripId, dayIndex]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const all = memoryStore.poi.get(tripId) ?? [];
    const cutoff = Date.now() - POI_CACHE_TTL_MS;
    return all.filter(
      (p) => p.day_index === dayIndex && new Date(p.fetched_at ?? 0).getTime() > cutoff
    );
  }
}

/**
 * Récupère les POI en cache pour un jour donné, même expirés (TTL ignoré).
 * Utilisé en dernier recours si Overpass est indisponible : mieux vaut des
 * données potentiellement périmées qu'une section vide.
 */
export async function getStalePoi(tripId: string, dayIndex: number): Promise<Poi[]> {
  try {
    const res = await pool.query<Poi>(
      `SELECT * FROM cached_poi WHERE trip_id = $1 AND day_index = $2 ORDER BY type ASC, name ASC NULLS LAST`,
      [tripId, dayIndex]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    return (memoryStore.poi.get(tripId) ?? []).filter((p) => p.day_index === dayIndex);
  }
}

/**
 * Remplace le cache POI d'un jour donné (purge puis insertion des résultats frais).
 */
export async function savePoi(
  tripId: string,
  dayIndex: number,
  poiList: Omit<Poi, "id" | "trip_id" | "day_index" | "fetched_at">[]
): Promise<Poi[]> {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM cached_poi WHERE trip_id = $1 AND day_index = $2`, [tripId, dayIndex]);
      const saved: Poi[] = [];
      for (const poi of poiList) {
        const res = await client.query<Poi>(
          `INSERT INTO cached_poi (trip_id, day_index, type, name, lat, lon, osm_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [tripId, dayIndex, poi.type, poi.name, poi.lat, poi.lon, poi.osm_id]
        );
        saved.push(res.rows[0]);
      }
      await client.query("COMMIT");
      return saved;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    console.warn("[DB] PostgreSQL non accessible, cache POI en mémoire locale.", (err as Error).message);
    const now = new Date().toISOString();
    const saved: Poi[] = poiList.map((poi, i) => ({
      id: Date.now() + i,
      trip_id: tripId,
      day_index: dayIndex,
      fetched_at: now,
      ...poi,
    }));
    const others = (memoryStore.poi.get(tripId) ?? []).filter((p) => p.day_index !== dayIndex);
    memoryStore.poi.set(tripId, [...others, ...saved]);
    return saved;
  }
}

/**
 * Liste les items de checklist d'une sortie, ordonnés.
 */
export async function getChecklistItems(tripId: string): Promise<ChecklistItem[]> {
  try {
    const res = await pool.query<ChecklistItem>(
      `SELECT * FROM checklist_items WHERE trip_id = $1 ORDER BY sort_order ASC`,
      [tripId]
    );
    return res.rows;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    return [...(memoryStore.checklist.get(tripId) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  }
}

/**
 * Ajoute un item personnalisé (custom = true), en fin de liste.
 */
export async function addChecklistItem(
  tripId: string,
  data: { label: string; category: ChecklistItem["category"] }
): Promise<ChecklistItem> {
  try {
    const res = await pool.query<ChecklistItem>(
      `INSERT INTO checklist_items (trip_id, label, category, checked, custom, sort_order)
       VALUES ($1, $2, $3, FALSE, TRUE, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM checklist_items WHERE trip_id = $1))
       RETURNING *`,
      [tripId, data.label, data.category]
    );
    return res.rows[0];
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const items = memoryStore.checklist.get(tripId) ?? [];
    const nextSortOrder = items.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1;
    const item: ChecklistItem = {
      id: Date.now(),
      trip_id: tripId,
      label: data.label,
      category: data.category,
      checked: false,
      custom: true,
      sort_order: nextSortOrder,
    };
    memoryStore.checklist.set(tripId, [...items, item]);
    return item;
  }
}

/**
 * Coche/décoche un item (custom ou généré, peu importe).
 */
export async function setChecklistItemChecked(
  tripId: string,
  itemId: number,
  checked: boolean
): Promise<ChecklistItem | null> {
  try {
    const res = await pool.query<ChecklistItem>(
      `UPDATE checklist_items SET checked = $3 WHERE id = $1 AND trip_id = $2 RETURNING *`,
      [itemId, tripId, checked]
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const items = memoryStore.checklist.get(tripId) ?? [];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], checked };
    memoryStore.checklist.set(tripId, items);
    return items[idx];
  }
}

/**
 * Supprime un item, custom ou généré (l'utilisateur peut toujours écarter
 * une suggestion qui ne lui convient pas).
 */
export async function deleteChecklistItem(tripId: string, itemId: number): Promise<boolean> {
  try {
    const res = await pool.query(`DELETE FROM checklist_items WHERE id = $1 AND trip_id = $2`, [
      itemId,
      tripId,
    ]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const items = memoryStore.checklist.get(tripId) ?? [];
    const nextLength = items.filter((i) => i.id !== itemId).length;
    const changed = nextLength !== items.length;
    memoryStore.checklist.set(tripId, items.filter((i) => i.id !== itemId));
    return changed;
  }
}

/**
 * Régénère les items non personnalisés (custom = false) à partir des règles
 * contextuelles : remplace entièrement l'ancien jeu généré, mais préserve
 * l'état coché des items dont le libellé persiste d'une génération à
 * l'autre, et ne touche jamais aux items personnalisés de l'utilisateur.
 */
export async function regenerateChecklist(
  tripId: string,
  items: { label: string; category: ChecklistItem["category"] }[]
): Promise<ChecklistItem[]> {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<ChecklistItem>(
        `SELECT label, checked FROM checklist_items WHERE trip_id = $1 AND custom = FALSE`,
        [tripId]
      );
      const checkedByLabel = new Map(previous.rows.map((r) => [r.label, r.checked]));

      await client.query(`DELETE FROM checklist_items WHERE trip_id = $1 AND custom = FALSE`, [tripId]);

      for (let i = 0; i < items.length; i++) {
        await client.query(
          `INSERT INTO checklist_items (trip_id, label, category, checked, custom, sort_order)
           VALUES ($1, $2, $3, $4, FALSE, $5)`,
          [tripId, items[i].label, items[i].category, checkedByLabel.get(items[i].label) ?? false, i]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (!isDev()) {
      throw err;
    }
    const existing = memoryStore.checklist.get(tripId) ?? [];
    const checkedByLabel = new Map(existing.filter((i) => !i.custom).map((i) => [i.label, i.checked]));
    const customItems = existing.filter((i) => i.custom);
    const generated: ChecklistItem[] = items.map((it, i) => ({
      id: Date.now() + i,
      trip_id: tripId,
      label: it.label,
      category: it.category,
      checked: checkedByLabel.get(it.label) ?? false,
      custom: false,
      sort_order: i,
    }));
    memoryStore.checklist.set(tripId, [...generated, ...customItems]);
  }
  return getChecklistItems(tripId);
}

/**
 * Initialise le scheduler in-process pour la purge automatique (24h)
 * avec exécution immédiate au démarrage.
 */
export function initCleanupScheduler(): void {
  if (globalThis._cleanupStarted) return;
  globalThis._cleanupStarted = true;

  // Exécution immédiate au démarrage
  purgeOldTrips().catch((err) => {
    console.error("[Purge] Erreur lors de la purge initiale:", err);
  });

  // Exécution périodique toutes les 24 heures
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  if (globalThis._cleanupInterval) {
    clearInterval(globalThis._cleanupInterval);
  }
  globalThis._cleanupInterval = setInterval(() => {
    purgeOldTrips().catch((err) => {
      console.error("[Purge] Erreur lors de la purge automatique:", err);
    });
  }, TWENTY_FOUR_HOURS_MS);
}

// Initialisation au démarrage du serveur
initCleanupScheduler();
