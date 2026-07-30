import { describe, it, expect } from "vitest";
import { douglasPeucker, adaptiveEpsilon } from "@/modules/gpx/simplify";

describe("douglasPeucker", () => {
  it("conserves les 2 points limites pour une ligne droite", () => {
    const points = [
      { lat: 45.0, lon: 6.0, ele: 1000, dist_cumul: 0 },
      { lat: 45.01, lon: 6.01, ele: 1005, dist_cumul: 1000 },
      { lat: 45.02, lon: 6.02, ele: 1010, dist_cumul: 2000 },
    ];
    const simplified = douglasPeucker(points, 100);
    expect(simplified.length).toBe(2);
    expect(simplified[0].lat).toBe(45.0);
    expect(simplified[1].lat).toBe(45.02);
  });

  it("calcule un epsilon adaptatif selon la taille de la trace", () => {
    expect(adaptiveEpsilon(500)).toBe(5);
    expect(adaptiveEpsilon(3000)).toBe(10);
    expect(adaptiveEpsilon(20000)).toBe(25);
  });
});
