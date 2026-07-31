"use client";

/**
 * components/map/TrailMap.tsx
 * Carte MapLibre GL — tuiles OSM raster (gratuites, pas de clé API requise).
 * Affiche la trace colorée par jour + marqueurs de coupure.
 */
import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  Marker,
  Popup,
  LngLatBounds,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { dayColor, nearestIndexByDistance } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import type { DayWithStats, GpxPointSimplified } from "@/types";

interface TrailMapProps {
  points: GpxPointSimplified[];
  days: DayWithStats[];
  hoveredDayIndex: number | null;
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function TrailMap({ points, days, hoveredDayIndex }: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // Init carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Trace + couleurs par jour
  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;

    const applyData = () => {
      const segments =
        days.length > 0
          ? days.map((d) => {
              const startIdx = nearestIndexByDistance(points, d.start_dist_m);
              const endIdx = Math.max(startIdx + 1, nearestIndexByDistance(points, d.end_dist_m));
              return { dayIndex: d.day_index, slice: points.slice(startIdx, endIdx + 1) };
            })
          : [{ dayIndex: 0, slice: points }];

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: segments
          .filter((s) => s.slice.length >= 2)
          .map((s) => ({
            type: "Feature",
            properties: { day_index: s.dayIndex },
            geometry: {
              type: "LineString",
              coordinates: s.slice.map((p) => [p.lon, p.lat]),
            },
          })),
      };

      const source = map.getSource("trace") as GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else {
        map.addSource("trace", { type: "geojson", data: geojson });
        map.addLayer({
          id: "trace-line",
          type: "line",
          source: "trace",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "match",
              ["%", ["get", "day_index"], 8],
              0, dayColor(0), 1, dayColor(1), 2, dayColor(2), 3, dayColor(3),
              4, dayColor(4), 5, dayColor(5), 6, dayColor(6), 7, dayColor(7),
              dayColor(0),
            ],
            "line-width": 4,
          },
        });
      }

      // Marqueurs de coupure (entre jours)
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      for (let i = 0; i < days.length - 1; i++) {
        const idx = nearestIndexByDistance(points, days[i].end_dist_m);
        const p = points[idx];
        if (!p) continue;
        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.background = "var(--tp-slate)";
        el.style.border = `2px solid ${dayColor(i + 1)}`;
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.5)";
        const marker = new Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .setPopup(new Popup({ offset: 10, closeButton: false }).setText(fr.planning.dayLabel(i + 2)))
          .addTo(map);
        markersRef.current.push(marker);
      }

      const bounds = points.reduce(
        (b, p) => b.extend([p.lon, p.lat]),
        new LngLatBounds([points[0].lon, points[0].lat], [points[0].lon, points[0].lat])
      );
      map.fitBounds(bounds, { padding: 40, duration: 0 });
    };

    if (map.isStyleLoaded()) {
      applyData();
    } else {
      map.once("load", applyData);
    }
  }, [points, days]);

  // Mise en avant du jour survolé
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("trace-line")) return;
    map.setPaintProperty(
      "trace-line",
      "line-width",
      hoveredDayIndex === null
        ? 4
        : (["case", ["==", ["get", "day_index"], hoveredDayIndex], 6, 3] as unknown as number),
    );
  }, [hoveredDayIndex]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{ border: "1px solid var(--tp-border)" }}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
        aria-label={fr.map.loading}
        role="img"
      />
    </div>
  );
}
