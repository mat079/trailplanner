/**
 * lib/db.ts
 * Client PostgreSQL partagé avec fallback en mémoire strictement réservé au développement local
 * (permet de tester l'application en dev si le conteneur Postgres n'est pas lancé).
 */
import { Pool } from "pg";
import type { Trip, GpxPoint, Waypoint, TripDay, Poi, ChecklistItem } from "@/types";

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
