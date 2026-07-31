/**
 * lib/planStore.ts
 * État partagé de la page /plan/[id] (carte, profil, paramètres de rythme, jours).
 */
import { create } from "zustand";
import { DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import type { ApiResponse, DayWithStats, GpxPointSimplified, PaceParams, Trip, Waypoint, WaypointType } from "@/types";

interface PlanState {
  tripId: string | null;
  trip: Trip | null;
  simplifiedPoints: GpxPointSimplified[];
  days: DayWithStats[];
  paceParams: PaceParams;
  loading: boolean;
  computing: boolean;
  error: string | null;
  hoveredDayIndex: number | null;
  waypoints: Waypoint[];
  placingType: WaypointType | null;

  init: (tripId: string, trip: Trip, simplifiedPoints: GpxPointSimplified[]) => void;
  setPaceParams: (p: Partial<PaceParams>) => void;
  computeDays: () => Promise<void>;
  loadDays: () => Promise<void>;
  adjustBoundary: (boundaryIndex: number, newDistCumulM: number) => Promise<void>;
  setHoveredDay: (i: number | null) => void;
  loadWaypoints: () => Promise<void>;
  setPlacingType: (t: WaypointType | null) => void;
  addWaypointAt: (lat: number, lon: number) => Promise<void>;
  removeWaypoint: (waypointId: number) => Promise<void>;
}

async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  tripId: null,
  trip: null,
  simplifiedPoints: [],
  days: [],
  paceParams: DEFAULT_PACE_PARAMS,
  loading: false,
  computing: false,
  error: null,
  hoveredDayIndex: null,
  waypoints: [],
  placingType: null,

  init: (tripId, trip, simplifiedPoints) => {
    if (get().tripId === tripId) return;
    set({
      tripId,
      trip,
      simplifiedPoints,
      days: [],
      waypoints: [],
      placingType: null,
      paceParams: trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS,
      error: null,
    });
    void get().loadDays();
    void get().loadWaypoints();
  },

  setPaceParams: (p) => set((s) => ({ paceParams: { ...s.paceParams, ...p } })),

  computeDays: async () => {
    const { tripId, paceParams } = get();
    if (!tripId) return;
    set({ computing: true, error: null });
    try {
      const data = await callApi<{ days: DayWithStats[] }>(`/api/trips/${tripId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pace_params: paceParams }),
      });
      set({ days: data.days });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Erreur lors du calcul du découpage." });
    } finally {
      set({ computing: false });
    }
  },

  loadDays: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ loading: true, error: null });
    try {
      const data = await callApi<{ days: DayWithStats[]; pace_params: PaceParams }>(
        `/api/trips/${tripId}/days`
      );
      set({ days: data.days, paceParams: data.pace_params });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Erreur lors du chargement du découpage." });
    } finally {
      set({ loading: false });
    }
  },

  adjustBoundary: async (boundaryIndex, newDistCumulM) => {
    const { tripId, days } = get();
    if (!tripId) return;
    const previousDays = days;
    set({ error: null });
    try {
      const data = await callApi<{ days: DayWithStats[] }>(`/api/trips/${tripId}/days`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boundary_index: boundaryIndex, new_dist_cumul_m: newDistCumulM }),
      });
      set({ days: data.days });
    } catch (e) {
      set({ days: previousDays, error: e instanceof Error ? e.message : "Erreur lors de l'ajustement." });
    }
  },

  setHoveredDay: (i) => set({ hoveredDayIndex: i }),

  loadWaypoints: async () => {
    const { tripId } = get();
    if (!tripId) return;
    try {
      const data = await callApi<{ waypoints: Waypoint[] }>(`/api/trips/${tripId}/waypoints`);
      set({ waypoints: data.waypoints });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Erreur lors du chargement des points d'étape." });
    }
  },

  setPlacingType: (t) => set({ placingType: t }),

  addWaypointAt: async (lat, lon) => {
    const { tripId, placingType, waypoints } = get();
    if (!tripId || !placingType) return;
    set({ error: null });
    try {
      const data = await callApi<{ waypoint: Waypoint }>(`/api/trips/${tripId}/waypoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: placingType, lat, lon }),
      });
      set({ waypoints: [...waypoints, data.waypoint], placingType: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Erreur lors de la création du point d'étape." });
    }
  },

  removeWaypoint: async (waypointId) => {
    const { tripId, waypoints } = get();
    if (!tripId) return;
    const previous = waypoints;
    set({ waypoints: waypoints.filter((w) => w.id !== waypointId), error: null });
    try {
      await callApi<{ deleted: true }>(`/api/trips/${tripId}/waypoints/${waypointId}`, { method: "DELETE" });
    } catch (e) {
      set({ waypoints: previous, error: e instanceof Error ? e.message : "Erreur lors de la suppression." });
    }
  },
}));
