import { describe, it, expect } from "vitest";
import {
  estimateIntensityZone,
  computeDayNutrition,
  computeTripTotalCarbsG,
  CARBS_PER_HOUR_BY_ZONE,
  CLIMB_RATE_TEMPO_M_H,
  CLIMB_RATE_THRESHOLD_M_H,
  FLAT_SPEED_TEMPO_KMH,
  FLAT_SPEED_THRESHOLD_KMH,
} from "@/modules/nutrition/carbsCalc";

describe("estimateIntensityZone", () => {
  it("classe en endurance une journée plate et tranquille", () => {
    expect(estimateIntensityZone({ elevGainM: 200, durationH: 5, flatSpeedKmh: 4 })).toBe("endurance");
  });

  it("classe en tempo dès le seuil de D+/h atteint", () => {
    // 250 m sur 1h = 250 m/h = pile le seuil tempo
    expect(estimateIntensityZone({ elevGainM: CLIMB_RATE_TEMPO_M_H, durationH: 1, flatSpeedKmh: 4 })).toBe("tempo");
  });

  it("reste en endurance juste sous le seuil de D+/h tempo", () => {
    expect(estimateIntensityZone({ elevGainM: CLIMB_RATE_TEMPO_M_H - 1, durationH: 1, flatSpeedKmh: 4 })).toBe(
      "endurance"
    );
  });

  it("classe en seuil dès le seuil de D+/h atteint", () => {
    expect(estimateIntensityZone({ elevGainM: CLIMB_RATE_THRESHOLD_M_H, durationH: 1, flatSpeedKmh: 4 })).toBe(
      "threshold"
    );
  });

  it("reste en tempo juste sous le seuil de D+/h seuil", () => {
    expect(estimateIntensityZone({ elevGainM: CLIMB_RATE_THRESHOLD_M_H - 1, durationH: 1, flatSpeedKmh: 4 })).toBe(
      "tempo"
    );
  });

  it("bascule en tempo via une vitesse à plat élevée même sans dénivelé", () => {
    expect(estimateIntensityZone({ elevGainM: 0, durationH: 3, flatSpeedKmh: FLAT_SPEED_TEMPO_KMH })).toBe("tempo");
  });

  it("bascule en seuil via une vitesse à plat très élevée même sans dénivelé", () => {
    expect(estimateIntensityZone({ elevGainM: 0, durationH: 3, flatSpeedKmh: FLAT_SPEED_THRESHOLD_KMH })).toBe(
      "threshold"
    );
  });

  it("ne divise pas par zéro pour une durée nulle", () => {
    expect(estimateIntensityZone({ elevGainM: 500, durationH: 0, flatSpeedKmh: 4 })).toBe("endurance");
  });
});

describe("computeDayNutrition", () => {
  const enduranceEffort = { elevGainM: 100, durationH: 4, flatSpeedKmh: 4 };

  it("utilise la recommandation automatique en l'absence d'override", () => {
    const dn = computeDayNutrition(0, enduranceEffort, null);
    expect(dn.intensity).toBe("endurance");
    expect(dn.carbs_per_hour_g).toBe(CARBS_PER_HOUR_BY_ZONE.endurance);
    expect(dn.effective_g_h).toBe(CARBS_PER_HOUR_BY_ZONE.endurance);
    expect(dn.override_g_h).toBeNull();
    expect(dn.total_carbs_g).toBe(CARBS_PER_HOUR_BY_ZONE.endurance * 4);
  });

  it("l'override manuel prime toujours sur la recommandation automatique", () => {
    const dn = computeDayNutrition(0, enduranceEffort, 90);
    expect(dn.carbs_per_hour_g).toBe(CARBS_PER_HOUR_BY_ZONE.endurance); // la reco reste affichée
    expect(dn.effective_g_h).toBe(90); // mais le calcul utilise l'override
    expect(dn.override_g_h).toBe(90);
    expect(dn.total_carbs_g).toBe(90 * 4);
  });

  it("conserve le day_index et la durée fournis", () => {
    const dn = computeDayNutrition(3, { elevGainM: 500, durationH: 6, flatSpeedKmh: 4 }, null);
    expect(dn.day_index).toBe(3);
    expect(dn.hours_estimated).toBe(6);
  });
});

describe("computeTripTotalCarbsG", () => {
  it("additionne le total de glucides sur tous les jours", () => {
    const days = [
      computeDayNutrition(0, { elevGainM: 100, durationH: 4, flatSpeedKmh: 4 }, null),
      computeDayNutrition(1, { elevGainM: 800, durationH: 6, flatSpeedKmh: 4 }, null),
    ];
    expect(computeTripTotalCarbsG(days)).toBe(days[0].total_carbs_g + days[1].total_carbs_g);
  });

  it("retourne 0 pour une sortie sans jour", () => {
    expect(computeTripTotalCarbsG([])).toBe(0);
  });
});
