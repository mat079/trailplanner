import { describe, it, expect } from "vitest";
import { estimateDurationHours, validatePaceParams, DEFAULT_PACE_PARAMS } from "@/modules/planning/paceModel";
import { buildDays, findNearestPointIndex, computeDayDate } from "@/modules/planning/dayBuilder";
import type { GpxPoint, PaceParams } from "@/types";

function makePoint(order_index: number, dist_cumul: number, ele: number): GpxPoint {
  return { lat: 45, lon: 6, ele, dist_cumul, order_index };
}

describe("estimateDurationHours", () => {
  it("ne compte que la distance sur une trace plate (D+ nul)", () => {
    const h = estimateDurationHours(20_000, 0, { speed_kmh: 5, elev_coeff_min_per_100m: 12, hours_per_day: 8 });
    expect(h).toBeCloseTo(4, 5); // 20 km / 5 km/h
  });

  it("ajoute le temps de montée proportionnellement au D+", () => {
    const h = estimateDurationHours(0, 1000, { speed_kmh: 5, elev_coeff_min_per_100m: 12, hours_per_day: 8 });
    expect(h).toBeCloseTo((1000 / 100) * (12 / 60), 5); // 2h pour 1000m D+ à 12 min/100m
  });
});

describe("validatePaceParams", () => {
  it("rejette une vitesse nulle ou négative", () => {
    expect(() => validatePaceParams({ speed_kmh: 0, elev_coeff_min_per_100m: 10, hours_per_day: 8 })).toThrow();
    expect(() => validatePaceParams({ speed_kmh: -1, elev_coeff_min_per_100m: 10, hours_per_day: 8 })).toThrow();
  });

  it("rejette un budget horaire nul ou négatif", () => {
    expect(() => validatePaceParams({ speed_kmh: 4, elev_coeff_min_per_100m: 10, hours_per_day: 0 })).toThrow();
  });

  it("rejette un coefficient D+ négatif", () => {
    expect(() => validatePaceParams({ speed_kmh: 4, elev_coeff_min_per_100m: -1, hours_per_day: 8 })).toThrow();
  });

  it("accepte les valeurs par défaut", () => {
    expect(() => validatePaceParams(DEFAULT_PACE_PARAMS)).not.toThrow();
  });
});

describe("buildDays — cas limites", () => {
  it("trace plate : découpe uniquement selon la distance/vitesse", () => {
    // 40 km plats, 5 km/h, budget 8h/j → 1 jour de 4h (tient dans le budget), pas de découpage
    const points: GpxPoint[] = [];
    for (let i = 0; i <= 40; i++) {
      points.push(makePoint(i, i * 1000, 1000)); // altitude constante
    }
    const params: PaceParams = { speed_kmh: 5, elev_coeff_min_per_100m: 12, hours_per_day: 8 };
    const days = buildDays(points, params);

    expect(days.length).toBe(1);
    expect(days[0].elev_gain_m).toBe(0);
    expect(days[0].distance_m).toBe(40_000);
    expect(days[0].duration_h).toBeCloseTo(8, 5);
  });

  it("D+ élevé : le dénivelé domine et force plusieurs jours même sur une courte distance", () => {
    // 6 km au total mais 3000m D+ : à 12 min/100m ça fait 6h de montée pure,
    // largement au-dessus d'un budget de 3h/jour → doit forcer un découpage.
    const points: GpxPoint[] = [];
    for (let i = 0; i <= 60; i++) {
      points.push(makePoint(i, i * 100, i * 50)); // 100m par pas, +50m D+ par pas
    }
    const params: PaceParams = { speed_kmh: 5, elev_coeff_min_per_100m: 12, hours_per_day: 3 };
    const days = buildDays(points, params);

    expect(days.length).toBeGreaterThan(1);
    for (const d of days) {
      expect(d.duration_h).toBeLessThanOrEqual(3.5); // tolérance : un segment peut légèrement dépasser
    }
    // Continuité : chaque jour reprend exactement où le précédent s'est arrêté
    for (let i = 1; i < days.length; i++) {
      expect(days[i].start_point_index).toBe(days[i - 1].end_point_index);
    }
    expect(days[days.length - 1].end_point_index).toBe(points.length - 1);
  });

  it("budget très court : progresse toujours d'au moins un point par jour et termine", () => {
    const points: GpxPoint[] = [];
    for (let i = 0; i <= 20; i++) {
      points.push(makePoint(i, i * 1000, 1000));
    }
    const params: PaceParams = { speed_kmh: 5, elev_coeff_min_per_100m: 12, hours_per_day: 0.001 };
    const days = buildDays(points, params);

    // Chaque segment dépasse le budget à lui seul → un jour par segment
    expect(days.length).toBe(points.length - 1);
    for (const d of days) {
      expect(d.end_point_index).toBe(d.start_point_index + 1);
    }
    expect(days[days.length - 1].end_point_index).toBe(points.length - 1);
  });

  it("rejette une trace de moins de 2 points", () => {
    expect(() => buildDays([makePoint(0, 0, 1000)], DEFAULT_PACE_PARAMS)).toThrow();
  });

  it("rejette des paramètres invalides", () => {
    const points = [makePoint(0, 0, 1000), makePoint(1, 1000, 1000)];
    expect(() => buildDays(points, { speed_kmh: 0, elev_coeff_min_per_100m: 12, hours_per_day: 8 })).toThrow();
  });
});

describe("findNearestPointIndex", () => {
  const points: GpxPoint[] = [0, 1000, 2000, 3000, 4000].map((d, i) => makePoint(i, d, 1000));

  it("trouve le point exact quand la distance correspond", () => {
    expect(findNearestPointIndex(points, 2000)).toBe(2);
  });

  it("arrondit au point le plus proche", () => {
    expect(findNearestPointIndex(points, 2400)).toBe(2);
    expect(findNearestPointIndex(points, 2600)).toBe(3);
  });

  it("gère les bornes (avant le premier, après le dernier)", () => {
    expect(findNearestPointIndex(points, -500)).toBe(0);
    expect(findNearestPointIndex(points, 10_000)).toBe(4);
  });
});

describe("computeDayDate", () => {
  it("retourne null si pas de date de départ", () => {
    expect(computeDayDate(null, 2)).toBeNull();
  });

  it("additionne day_index jours à la date de départ", () => {
    expect(computeDayDate("2026-08-01", 0)).toBe("2026-08-01");
    expect(computeDayDate("2026-08-01", 3)).toBe("2026-08-04");
  });

  it("traverse correctement un changement de mois", () => {
    expect(computeDayDate("2026-08-30", 3)).toBe("2026-09-02");
  });
});
