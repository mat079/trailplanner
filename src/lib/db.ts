/**
 * lib/db.ts
 * Client PostgreSQL partagé avec fallback en mémoire pour le développement local
 * (permet de tester l'application immédiatement même si le conteneur Postgres n'est pas lancé).
 */
import { Pool } from "pg";
import type { Trip, GpxPoint, Waypoint, TripDay, Poi, ChecklistItem } from "@/types";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _memoryStore: MemoryStore | undefined;
}

// ── In-Memory Store Fallback ──────────────────────────────────────────────────

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

// ── PostgreSQL Pool ────────────────────────────────────────────────────────────

function createPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL || "postgres://trailplanner:trailplanner@localhost:5432/trailplanner";
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000, // 3 sec timeout
  });
}

const pool: Pool = globalThis._pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool;
}

export { pool };

// ── Database Operations with Memory Fallback ──────────────────────────────────

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
    // Essai Postgres
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

    // Points GPX par batch
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

    // Toujours alimenter le fallback en mémoire aussi
    memoryStore.trips.set(id, trip);
    memoryStore.points.set(id, points);

    return res.rows[0];
  } catch (err) {
    console.warn("[DB] PostgreSQL non accessible, utilisation du mode mémoire local.", (err as Error).message);

    // Fallback mémoire
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
  } catch {
    // Fallback mémoire
  }
  return memoryStore.trips.get(id) ?? null;
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
    if (res.rows.length > 0) return res.rows;
  } catch {
    // Fallback mémoire
  }
  return memoryStore.points.get(tripId) ?? [];
}
