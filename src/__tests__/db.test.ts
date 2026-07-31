import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { saveTrip, getTrip, memoryStore } from "@/lib/db";
import type { TripMetadata } from "@/types";

describe("lib/db.ts fallback logic", () => {
  const dummyMetadata: TripMetadata = {
    distance_m: 1000,
    elev_gain_m: 100,
    elev_loss_m: 50,
    max_ele_m: 1200,
    min_ele_m: 1100,
    point_count: 2,
    bbox: { min_lat: 45, max_lat: 45.1, min_lon: 6, max_lon: 6.1 },
  };

  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    memoryStore.trips.clear();
    memoryStore.points.clear();
  });

  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = origEnv;
  });

  it("utilise le fallback mémoire en mode développement si Postgres est indisponible", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const trip = await saveTrip(
      {
        session_id: "test-sess",
        name: "Dev Trip",
        start_date: null,
        gpx_raw: "<gpx></gpx>",
        metadata: dummyMetadata,
      },
      [
        { lat: 45, lon: 6, ele: 1100, dist_cumul: 0, order_index: 0 },
        { lat: 45.1, lon: 6.1, ele: 1200, dist_cumul: 1000, order_index: 1 },
      ]
    );

    expect(trip.name).toBe("Dev Trip");
    const retrieved = await getTrip(trip.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(trip.id);
  });

  it("lève une erreur en production au lieu d'utiliser le fallback mémoire", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    await expect(
      saveTrip(
        {
          session_id: "prod-sess",
          name: "Prod Trip",
          start_date: null,
          gpx_raw: "<gpx></gpx>",
          metadata: dummyMetadata,
        },
        []
      )
    ).rejects.toThrow();
  });

  it("purges localement les sorties inactives de plus de 90 jours", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { purgeOldTrips } = await import("@/lib/db");

    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    memoryStore.trips.set("old-id", {
      id: "old-id",
      session_id: "s1",
      share_token: "t1",
      name: "Old Trip",
      start_date: null,
      created_at: oldDate,
      last_accessed_at: oldDate,
      gpx_raw: "<gpx></gpx>",
      metadata: dummyMetadata,
    });

    memoryStore.trips.set("recent-id", {
      id: "recent-id",
      session_id: "s2",
      share_token: "t2",
      name: "Recent Trip",
      start_date: null,
      created_at: recentDate,
      last_accessed_at: recentDate,
      gpx_raw: "<gpx></gpx>",
      metadata: dummyMetadata,
    });

    const purged = await purgeOldTrips();
    expect(purged).toBe(1);
    expect(memoryStore.trips.has("old-id")).toBe(false);
    expect(memoryStore.trips.has("recent-id")).toBe(true);
  });
});

