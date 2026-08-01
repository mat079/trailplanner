import { describe, it, expect, vi, afterEach } from "vitest";
import {
  decimatePoints,
  buildOverpassQuery,
  classifyElement,
  parseOverpassResponse,
  fetchOverpassPoi,
  DEFAULT_BUFFER_M,
  MAX_QUERY_POINTS,
} from "@/modules/poi/overpass";

describe("decimatePoints", () => {
  it("retourne la liste telle quelle si déjà sous le maximum", () => {
    const points = [1, 2, 3];
    expect(decimatePoints(points, 10)).toEqual([1, 2, 3]);
  });

  it("sous-échantillonne au nombre max demandé", () => {
    const points = Array.from({ length: 1000 }, (_, i) => i);
    const result = decimatePoints(points, 50);
    expect(result.length).toBeLessThanOrEqual(51); // +1 pour le dernier point garanti
  });

  it("conserve toujours le dernier point (fin de section)", () => {
    const points = Array.from({ length: 250 }, (_, i) => i);
    const result = decimatePoints(points, 10);
    expect(result[result.length - 1]).toBe(249);
  });
});

describe("buildOverpassQuery", () => {
  it("inclut les 4 catégories de POI (bakery, supermarket, grocery, water)", () => {
    const q = buildOverpassQuery([{ lat: 45.05, lon: 6.03 }]);
    expect(q).toContain('"shop"="bakery"');
    expect(q).toContain('"shop"="supermarket"');
    expect(q).toContain('"shop"="convenience"');
    expect(q).toContain('"amenity"="drinking_water"');
    expect(q).toContain('"natural"="spring"');
    expect(q).toContain('"amenity"="fountain"');
  });

  it("utilise le buffer par défaut (200m) si non précisé", () => {
    const q = buildOverpassQuery([{ lat: 45.05, lon: 6.03 }]);
    expect(q).toContain(`around:${DEFAULT_BUFFER_M},`);
  });

  it("respecte un buffer personnalisé", () => {
    const q = buildOverpassQuery([{ lat: 45.05, lon: 6.03 }], 500);
    expect(q).toContain("around:500,");
  });

  it("rejette une liste de points vide", () => {
    expect(() => buildOverpassQuery([])).toThrow();
  });

  it("rejette un buffer nul ou négatif", () => {
    expect(() => buildOverpassQuery([{ lat: 45, lon: 6 }], 0)).toThrow();
    expect(() => buildOverpassQuery([{ lat: 45, lon: 6 }], -10)).toThrow();
  });

  it("décime les traces très longues avant de construire la requête", () => {
    // Les mêmes coordonnées sont répétées une fois par clause de filtre (une
    // par catégorie de POI) : on n'inspecte donc que la première occurrence
    // du bloc "around:...)" pour compter les points réellement envoyés.
    const points = Array.from({ length: 5000 }, (_, i) => ({ lat: 45 + i * 0.00001, lon: 6 }));
    const q = buildOverpassQuery(points);
    const firstAroundBlock = q.match(/around:\d+,([^)]+)\)/);
    expect(firstAroundBlock).not.toBeNull();
    const coordPairsInQuery = firstAroundBlock![1].split(",").length / 2;
    expect(coordPairsInQuery).toBeLessThanOrEqual(MAX_QUERY_POINTS + 1);
  });
});

describe("classifyElement", () => {
  it("reconnaît une boulangerie", () => {
    expect(classifyElement({ shop: "bakery" })).toBe("bakery");
  });

  it("reconnaît un supermarché", () => {
    expect(classifyElement({ shop: "supermarket" })).toBe("supermarket");
  });

  it("reconnaît une épicerie (convenience ou grocery)", () => {
    expect(classifyElement({ shop: "convenience" })).toBe("grocery");
    expect(classifyElement({ shop: "grocery" })).toBe("grocery");
  });

  it("reconnaît les différents points d'eau", () => {
    expect(classifyElement({ amenity: "drinking_water" })).toBe("water");
    expect(classifyElement({ natural: "spring" })).toBe("water");
    expect(classifyElement({ amenity: "fountain" })).toBe("water");
  });

  it("retourne null pour un tag non pertinent", () => {
    expect(classifyElement({ shop: "furniture" })).toBeNull();
    expect(classifyElement({ amenity: "restaurant" })).toBeNull();
    expect(classifyElement({})).toBeNull();
  });
});

describe("parseOverpassResponse", () => {
  it("parse les nodes avec tags reconnus et ignore le reste", () => {
    const parsed = parseOverpassResponse({
      elements: [
        { type: "node", id: 1, lat: 45.05, lon: 6.03, tags: { shop: "bakery", name: "Boulangerie du Col" } },
        { type: "node", id: 2, lat: 45.06, lon: 6.04, tags: { amenity: "restaurant" } }, // non pertinent
        { type: "way", id: 3, tags: { shop: "bakery" } }, // pas un node
        { type: "node", id: 4, lat: 45.07, lon: 6.05, tags: { natural: "spring" } }, // pas de name
      ],
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ type: "bakery", name: "Boulangerie du Col", lat: 45.05, lon: 6.03, osm_id: 1 });
    expect(parsed[1]).toEqual({ type: "water", name: null, lat: 45.07, lon: 6.05, osm_id: 4 });
  });

  it("gère une réponse sans éléments", () => {
    expect(parseOverpassResponse({ elements: [] })).toEqual([]);
  });
});

describe("fetchOverpassPoi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne les POI parsés quand Overpass répond 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [{ type: "node", id: 42, lat: 45.05, lon: 6.03, tags: { shop: "bakery" } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchOverpassPoi([{ lat: 45.05, lon: 6.03 }]);
    expect(result).toEqual([{ type: "bakery", name: null, lat: 45.05, lon: 6.03, osm_id: 42 }]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("overpass-api.de"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("lève une erreur explicite quand Overpass répond en erreur (503/504)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 504 })
    );
    await expect(fetchOverpassPoi([{ lat: 45.05, lon: 6.03 }])).rejects.toThrow(/504/);
  });
});
