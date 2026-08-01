"use client";

/**
 * components/map/TrailMap.tsx
 * Carte MapLibre GL — tuiles OSM raster (gratuites, pas de clé API requise).
 * Affiche la trace colorée par jour, les marqueurs de coupure et les points d'étape.
 * Si placingType est défini, un clic sur la carte déclenche onMapClick(lat, lon).
 */
import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  Marker,
  Popup,
  LngLatBounds,
  type MapMouseEvent,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { dayColor, nearestIndexByDistance, waypointStyle, poiStyle } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import type { DayWithStats, GpxPointSimplified, Poi, Waypoint, WaypointType } from "@/types";

interface TrailMapProps {
  points: GpxPointSimplified[];
  days: DayWithStats[];
  hoveredDayIndex: number | null;
  waypoints?: Waypoint[];
  placingType?: WaypointType | null;
  onMapClick?: (lat: number, lon: number) => void;
  poi?: Poi[];
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

export default function TrailMap({
  points,
  days,
  hoveredDayIndex,
  waypoints = [],
  placingType = null,
  onMapClick,
  poi = [],
}: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dayMarkersRef = useRef<Marker[]>([]);
  const waypointMarkersRef = useRef<Marker[]>([]);
  const poiMarkersRef = useRef<Marker[]>([]);
  // "load" ne se déclenche qu'une seule fois par instance de carte : on le capture
  // dans un état partagé plutôt que de laisser chaque effet enregistrer son propre
  // map.once("load", ...), qui ne se déclencherait jamais si isStyleLoaded() est
  // momentanément false (rechargement de tuiles) au moment où l'effet s'exécute.
  const [styleLoaded, setStyleLoaded] = useState(false);

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
    map.once("load", () => setStyleLoaded(true));
    mapRef.current = map;

    // Le ResizeObserver interne de MapLibre peut manquer la taille finale du
    // conteneur (layout React/Tailwind qui se stabilise après le montage) :
    // on force explicitement resize() à chaque changement de taille observé.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Trace + couleurs par jour + marqueurs de coupure
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded || points.length < 2) return;

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

    dayMarkersRef.current.forEach((m) => m.remove());
    dayMarkersRef.current = [];
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
      dayMarkersRef.current.push(marker);
    }

    const bounds = points.reduce(
      (b, p) => b.extend([p.lon, p.lat]),
      new LngLatBounds([points[0].lon, points[0].lat], [points[0].lon, points[0].lat])
    );
    map.fitBounds(bounds, { padding: 40, duration: 0 });
  }, [points, days, styleLoaded]);

  // Marqueurs des points d'étape
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];
    for (const w of waypoints) {
      const style = waypointStyle(w.type);
      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.borderRadius = "50%";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "14px";
      el.style.background = "var(--tp-slate)";
      el.style.border = `2px solid ${style.color}`;
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.6)";
      el.textContent = style.icon;
      const marker = new Marker({ element: el })
        .setLngLat([w.lon, w.lat])
        .setPopup(new Popup({ offset: 14, closeButton: false }).setText(w.label || w.type))
        .addTo(map);
      waypointMarkersRef.current.push(marker);
    }
  }, [waypoints, styleLoaded]);

  // Marqueurs des POI (Overpass)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    poiMarkersRef.current.forEach((m) => m.remove());
    poiMarkersRef.current = [];
    for (const p of poi) {
      const style = poiStyle(p.type);
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "11px";
      el.style.background = "var(--tp-slate)";
      el.style.border = `1.5px solid ${style.color}`;
      el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5)";
      el.style.opacity = "0.9";
      el.textContent = style.icon;
      const marker = new Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(new Popup({ offset: 12, closeButton: false }).setText(p.name || fr.poi[p.type]))
        .addTo(map);
      poiMarkersRef.current.push(marker);
    }
  }, [poi, styleLoaded]);

  // Placement d'un point d'étape au clic
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = placingType ? "crosshair" : "";
    if (!placingType || !onMapClick) return;

    const handler = (e: MapMouseEvent) => onMapClick(e.lngLat.lat, e.lngLat.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [placingType, onMapClick]);

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
