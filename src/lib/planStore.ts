/**
 * lib/planStore.ts
 * État partagé de la page /plan/[id] (carte, profil, paramètres de rythme, jours).
 */
import { create } from "zustand";
import { DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import type { ApiResponse, ChecklistCategory, ChecklistItem, DayNutrition, DayWeather, DayWithStats, GpxPointSimplified, PaceParams, Poi, PublicTrip, Waypoint, WaypointType } from "@/types";

interface PlanState {
  tripId: string | null;
  trip: PublicTrip | null;
  simplifiedPoints: GpxPointSimplified[];
  days: DayWithStats[];
  paceParams: PaceParams;
  loading: boolean;
  computing: boolean;
  error: string | null;
  hoveredDayIndex: number | null;
  hoveredPointDistM: number | null;
  waypoints: Waypoint[];
  placingType: WaypointType | null;
  poiByDay: Record<number, Poi[]>;
  poiLoading: Record<number, boolean>;
  poiStale: Record<number, boolean>;
  poiError: Record<number, string | null>;
  weatherByDay: Record<number, DayWeather>;
  weatherLoading: Record<number, boolean>;
  weatherError: Record<number, string | null>;
  savingStartDate: boolean;
  nutritionByDay: Record<number, DayNutrition>;
  nutritionTripTotalG: number;
  nutritionLoading: boolean;
  nutritionError: string | null;
  checklistItems: ChecklistItem[];
  checklistLoaded: boolean;
  checklistLoading: boolean;
  checklistError: string | null;

  init: (tripId: string, trip: PublicTrip, simplifiedPoints: GpxPointSimplified[]) => void;
  setPaceParams: (p: Partial<PaceParams>) => void;
  computeDays: () => Promise<void>;
  loadDays: () => Promise<void>;
  adjustBoundary: (boundaryIndex: number, newDistCumulM: number) => Promise<void>;
  setHoveredDay: (i: number | null) => void;
  setHoveredPoint: (distM: number | null) => void;
  loadWaypoints: () => Promise<void>;
  setPlacingType: (t: WaypointType | null) => void;
  addWaypointAt: (lat: number, lon: number) => Promise<void>;
  removeWaypoint: (waypointId: number) => Promise<void>;
  loadPoi: (dayIndex: number, refresh?: boolean) => Promise<void>;
  loadAllPoi: () => Promise<void>;
  loadWeather: (dayIndex: number) => Promise<void>;
  loadAllWeather: () => Promise<void>;
  setStartDate: (dateISO: string | null) => Promise<void>;
  loadNutrition: () => Promise<void>;
  setNutritionOverride: (dayIndex: number, overrideGH: number | null) => Promise<void>;
  loadChecklist: () => Promise<void>;
  generateChecklist: () => Promise<void>;
  ensureChecklistGenerated: () => Promise<void>;
  toggleChecklistItem: (itemId: number, checked: boolean) => Promise<void>;
  addChecklistItem: (label: string, category: ChecklistCategory) => Promise<void>;
  removeChecklistItem: (itemId: number) => Promise<void>;
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
  hoveredPointDistM: null,
  waypoints: [],
  placingType: null,
  poiByDay: {},
  poiLoading: {},
  poiStale: {},
  poiError: {},
  weatherByDay: {},
  weatherLoading: {},
  weatherError: {},
  savingStartDate: false,
  nutritionByDay: {},
  nutritionTripTotalG: 0,
  nutritionLoading: false,
  nutritionError: null,
  checklistItems: [],
  checklistLoaded: false,
  checklistLoading: false,
  checklistError: null,

  init: (tripId, trip, simplifiedPoints) => {
    if (get().tripId === tripId) return;
    set({
      tripId,
      trip,
      simplifiedPoints,
      days: [],
      waypoints: [],
      placingType: null,
      poiByDay: {},
      poiLoading: {},
      poiStale: {},
      poiError: {},
      weatherByDay: {},
      weatherLoading: {},
      weatherError: {},
      nutritionByDay: {},
      nutritionTripTotalG: 0,
      nutritionError: null,
      checklistItems: [],
      checklistLoaded: false,
      checklistError: null,
      paceParams: trip.metadata.pace_params ?? DEFAULT_PACE_PARAMS,
      error: null,
    });
    void get().loadDays();
    void get().loadWaypoints();
    void get().loadChecklist();
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
      void get().loadAllPoi();
      void get().loadAllWeather();
      void get().loadNutrition();
      void get().ensureChecklistGenerated();
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
      void get().loadAllPoi();
      void get().loadAllWeather();
      void get().loadNutrition();
      void get().ensureChecklistGenerated();
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
  setHoveredPoint: (distM) => set({ hoveredPointDistM: distM }),

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
      const data = await callApi<{ waypoint: Waypoint; days?: DayWithStats[] }>(`/api/trips/${tripId}/waypoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: placingType, lat, lon }),
      });
      set({ waypoints: [...waypoints, data.waypoint], placingType: null });
      // Un bivouac fraîchement posé peut avoir redécoupé les journées (cf. API) :
      // on réaligne le reste (POI/météo/nutrition/checklist), comme après un
      // recalcul manuel du découpage.
      if (data.days) {
        set({ days: data.days });
        void get().loadAllPoi();
        void get().loadAllWeather();
        void get().loadNutrition();
        void get().ensureChecklistGenerated();
      }
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
      const data = await callApi<{ deleted: true; days?: DayWithStats[] }>(
        `/api/trips/${tripId}/waypoints/${waypointId}`,
        { method: "DELETE" }
      );
      if (data.days) {
        set({ days: data.days });
        void get().loadAllPoi();
        void get().loadAllWeather();
        void get().loadNutrition();
        void get().ensureChecklistGenerated();
      }
    } catch (e) {
      set({ waypoints: previous, error: e instanceof Error ? e.message : "Erreur lors de la suppression." });
    }
  },

  loadPoi: async (dayIndex, refresh = false) => {
    const { tripId } = get();
    if (!tripId) return;
    set((s) => ({
      poiLoading: { ...s.poiLoading, [dayIndex]: true },
      poiError: { ...s.poiError, [dayIndex]: null },
    }));
    try {
      const qs = new URLSearchParams({ day_index: String(dayIndex) });
      if (refresh) qs.set("refresh", "true");
      const data = await callApi<{ poi: Poi[]; cached: boolean; stale: boolean }>(
        `/api/trips/${tripId}/poi?${qs.toString()}`
      );
      set((s) => ({
        poiByDay: { ...s.poiByDay, [dayIndex]: data.poi },
        poiStale: { ...s.poiStale, [dayIndex]: data.stale },
      }));
    } catch (e) {
      set((s) => ({
        poiError: {
          ...s.poiError,
          [dayIndex]: e instanceof Error ? e.message : "Erreur lors du chargement des points d'intérêt.",
        },
      }));
    } finally {
      set((s) => ({ poiLoading: { ...s.poiLoading, [dayIndex]: false } }));
    }
  },

  loadAllPoi: async () => {
    const { days } = get();
    await Promise.all(days.map((d) => get().loadPoi(d.day_index)));
  },

  loadWeather: async (dayIndex) => {
    const { tripId } = get();
    if (!tripId) return;
    set((s) => ({
      weatherLoading: { ...s.weatherLoading, [dayIndex]: true },
      weatherError: { ...s.weatherError, [dayIndex]: null },
    }));
    try {
      const data = await callApi<{ weather: DayWeather }>(
        `/api/trips/${tripId}/weather?day_index=${dayIndex}`
      );
      set((s) => ({ weatherByDay: { ...s.weatherByDay, [dayIndex]: data.weather } }));
    } catch (e) {
      set((s) => ({
        weatherError: {
          ...s.weatherError,
          [dayIndex]: e instanceof Error ? e.message : "Erreur lors du chargement de la météo.",
        },
      }));
    } finally {
      set((s) => ({ weatherLoading: { ...s.weatherLoading, [dayIndex]: false } }));
    }
  },

  loadAllWeather: async () => {
    const { days, trip } = get();
    if (!trip?.start_date) return;
    await Promise.all(days.map((d) => get().loadWeather(d.day_index)));
  },

  setStartDate: async (dateISO) => {
    const { tripId, trip } = get();
    if (!tripId || !trip) return;
    set({ savingStartDate: true, error: null });
    try {
      const data = await callApi<{ trip: PublicTrip }>(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: dateISO }),
      });
      set({ trip: data.trip });
      await get().loadDays();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Erreur lors de la mise à jour de la date de départ." });
    } finally {
      set({ savingStartDate: false });
    }
  },

  loadNutrition: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ nutritionLoading: true, nutritionError: null });
    try {
      const data = await callApi<{ days: DayNutrition[]; trip_total_g: number }>(
        `/api/trips/${tripId}/nutrition`
      );
      set({
        nutritionByDay: Object.fromEntries(data.days.map((d) => [d.day_index, d])),
        nutritionTripTotalG: data.trip_total_g,
      });
    } catch (e) {
      set({ nutritionError: e instanceof Error ? e.message : "Erreur lors du calcul des besoins en glucides." });
    } finally {
      set({ nutritionLoading: false });
    }
  },

  setNutritionOverride: async (dayIndex, overrideGH) => {
    const { tripId } = get();
    if (!tripId) return;
    set({ nutritionError: null });
    try {
      const data = await callApi<{ days: DayNutrition[]; trip_total_g: number }>(
        `/api/trips/${tripId}/nutrition`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_index: dayIndex, override_g_h: overrideGH }),
        }
      );
      set({
        nutritionByDay: Object.fromEntries(data.days.map((d) => [d.day_index, d])),
        nutritionTripTotalG: data.trip_total_g,
      });
    } catch (e) {
      set({ nutritionError: e instanceof Error ? e.message : "Erreur lors de la mise à jour de l'override." });
    }
  },

  loadChecklist: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ checklistLoading: true, checklistError: null });
    try {
      const data = await callApi<{ items: ChecklistItem[] }>(`/api/trips/${tripId}/checklist`);
      set({ checklistItems: data.items, checklistLoaded: true });
    } catch (e) {
      set({ checklistError: e instanceof Error ? e.message : "Erreur lors du chargement de la checklist." });
    } finally {
      set({ checklistLoading: false });
    }
  },

  generateChecklist: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ checklistLoading: true, checklistError: null });
    try {
      const data = await callApi<{ items: ChecklistItem[] }>(`/api/trips/${tripId}/checklist/generate`, {
        method: "POST",
      });
      set({ checklistItems: data.items, checklistLoaded: true });
    } catch (e) {
      set({ checklistError: e instanceof Error ? e.message : "Erreur lors de la génération de la checklist." });
    } finally {
      set({ checklistLoading: false });
    }
  },

  ensureChecklistGenerated: async () => {
    const { tripId, checklistLoaded } = get();
    if (!tripId) return;
    if (!checklistLoaded) {
      await get().loadChecklist();
    }
    // Ne régénère que si aucun item n'existe encore : une régénération
    // automatique à chaque recalcul de jours écraserait la progression de
    // l'utilisateur. Le bouton "Régénérer" reste disponible pour un refresh explicite.
    if (get().checklistItems.length === 0) {
      await get().generateChecklist();
    }
  },

  toggleChecklistItem: async (itemId, checked) => {
    const { tripId, checklistItems } = get();
    if (!tripId) return;
    const previous = checklistItems;
    set({ checklistItems: checklistItems.map((i) => (i.id === itemId ? { ...i, checked } : i)) });
    try {
      await callApi(`/api/trips/${tripId}/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
    } catch (e) {
      set({
        checklistItems: previous,
        checklistError: e instanceof Error ? e.message : "Erreur lors de la mise à jour de l'item.",
      });
    }
  },

  addChecklistItem: async (label, category) => {
    const { tripId, checklistItems } = get();
    if (!tripId) return;
    set({ checklistError: null });
    try {
      const data = await callApi<{ item: ChecklistItem }>(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, category }),
      });
      set({ checklistItems: [...checklistItems, data.item] });
    } catch (e) {
      set({ checklistError: e instanceof Error ? e.message : "Erreur lors de l'ajout de l'item." });
    }
  },

  removeChecklistItem: async (itemId) => {
    const { tripId, checklistItems } = get();
    if (!tripId) return;
    const previous = checklistItems;
    set({ checklistItems: checklistItems.filter((i) => i.id !== itemId) });
    try {
      await callApi(`/api/trips/${tripId}/checklist/${itemId}`, { method: "DELETE" });
    } catch (e) {
      set({
        checklistItems: previous,
        checklistError: e instanceof Error ? e.message : "Erreur lors de la suppression de l'item.",
      });
    }
  },
}));
