import { describe, it, expect } from "vitest";
import { snapToTrace, resolveDayIndex } from "@/modules/gpx/snap";
import type { GpxPoint, TripDay } from "@/types";

function makePoint(order_index: number, lat: number, lon: number, ele = 1000): GpxPoint {
  return { lat, lon, ele, dist_cumul: order_index * 20, order_index };
}

function makeDay(day_index: number, start_point_index: number, end_point_index: number): TripDay {
  return {
    trip_id: "trip-1",
    day_index,
    start_point_index,
    end_point_index,
    label: null,
    bivouac_lat: null,
    bivouac_lon: null,
    bivouac_ele: null,
    date: null,
  };
}

describe("snapToTrace", () => {
  const points: GpxPoint[] = [
    makePoint(0, 45.0, 6.0),
    makePoint(1, 45.001, 6.0),
    makePoint(2, 45.002, 6.0),
  ];

  it("snappe sur le point exact quand le clic tombe dessus", () => {
    const snapped = snapToTrace(points, 45.001, 6.0);
    expect(snapped.point_index).toBe(1);
    expect(snapped.distance_to_click_m).toBeCloseTo(0, 3);
  });

  it("snappe sur le point géographiquement le plus proche d'un clic approximatif", () => {
    const snapped = snapToTrace(points, 45.0021, 6.0001);
    expect(snapped.point_index).toBe(2);
  });

  it("lève une erreur si la trace est vide", () => {
    expect(() => snapToTrace([], 45, 6)).toThrow();
  });

  describe("aller-retour / boucle (deux passages proches)", () => {
    // L'aller (index 0-4) et le retour (index 5-9) longent la même zone à
    // ~10-25m l'un de l'autre (dérive GPS/tracé réaliste). Les distances au
    // clic ci-dessous ont été calculées à la main (haversine) pour ce jeu de
    // points précis — ne pas modifier les coordonnées sans revérifier.
    const loopPoints: GpxPoint[] = [
      makePoint(0, 45.0, 6.0), // aller
      makePoint(1, 45.0001, 6.0),
      makePoint(2, 45.0002, 6.0),
      makePoint(3, 45.0003, 6.0),
      makePoint(4, 45.0004, 6.0), // point de retournement
      makePoint(5, 45.0004, 6.0003), // retour
      makePoint(6, 45.0003, 6.0003),
      makePoint(7, 45.0002, 6.0003),
      makePoint(8, 45.0001, 6.0003),
      makePoint(9, 45.0, 6.0003),
    ];

    it("en cas d'ambiguïté réelle, privilégie le passage le plus précoce plutôt que le plus proche au mètre près", () => {
      // Clic à mi-chemin entre le passage aller (index 2, ~15.7m) et le
      // passage retour (index 7, ~7.9m) : le retour est géométriquement plus
      // proche, mais l'écart (~7.9m) est dans SNAP_AMBIGUITY_TOLERANCE_M
      // (15m) — les deux passages sont donc traités comme des candidats
      // concurrents. La convention documentée (premier passage rencontré)
      // fait gagner l'aller (index 2), pas le retour (index 7).
      const snapped = snapToTrace(loopPoints, 45.0002, 6.0002);
      expect(snapped.point_index).toBe(2);
      expect(snapped.point_index).not.toBe(7);
    });

    it("n'active pas la préférence \"premier passage\" quand un seul passage est réellement proche", () => {
      // Clic quasiment sur le passage aller (index 1, <1m) ; le passage
      // retour le plus proche (index 8) est à plus de 20m, largement hors
      // tolérance. Pas d'ambiguïté ici : le point réellement le plus proche
      // doit gagner, sans interférence de l'autre passage.
      const snapped = snapToTrace(loopPoints, 45.0001, 6.00001);
      expect(snapped.point_index).toBe(1);
      expect(snapped.distance_to_click_m).toBeLessThan(5);
    });
  });
});

describe("resolveDayIndex", () => {
  const days: TripDay[] = [makeDay(0, 0, 10), makeDay(1, 10, 20)];

  it("résout un point strictement à l'intérieur du jour 0", () => {
    expect(resolveDayIndex(days, 5)).toBe(0);
  });

  it("résout un point strictement à l'intérieur du jour 1", () => {
    expect(resolveDayIndex(days, 15)).toBe(1);
  });

  it("convention verrouillée : un point exactement à la frontière est attribué au jour qui se termine, pas à celui qui commence", () => {
    // end_point_index du jour 0 (10) == start_point_index du jour 1 (10),
    // contiguïté du découpage (étape 2). .find() retourne le premier match,
    // donc le jour 0 gagne. Choix défendable mais arbitraire : ce test le
    // verrouille pour qu'un futur refactor de resolveDayIndex ne l'inverse
    // pas silencieusement.
    expect(resolveDayIndex(days, 10)).toBe(0);
  });

  it("retourne null pour un point avant le premier jour ou après le dernier", () => {
    expect(resolveDayIndex(days, -1)).toBeNull();
    expect(resolveDayIndex(days, 21)).toBeNull();
  });

  it("retourne null si aucun jour n'est encore calculé", () => {
    expect(resolveDayIndex([], 5)).toBeNull();
  });
});
