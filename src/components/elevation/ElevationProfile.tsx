"use client";

/**
 * components/elevation/ElevationProfile.tsx
 * Profil altimétrique (Recharts) coloré par jour, avec des marqueurs de coupure
 * déplaçables (glisser-déposer) pour ajuster manuellement le découpage.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer } from "recharts";
import { dayColor, nearestIndexByDistance } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import type { DayWithStats, GpxPointSimplified } from "@/types";

interface ElevationProfileProps {
  points: GpxPointSimplified[];
  days: DayWithStats[];
  hoveredDayIndex: number | null;
  onHoverDay: (i: number | null) => void;
  onAdjustBoundary: (boundaryIndex: number, newDistCumulM: number) => void;
  hoveredPointDistM: number | null;
  onHoverPoint: (distM: number | null) => void;
}

const MARGIN = { top: 10, right: 16, bottom: 24, left: 44 };
const MIN_GAP_KM = 0.1;

export default function ElevationProfile({
  points,
  days,
  hoveredDayIndex,
  onHoverDay,
  onAdjustBoundary,
  hoveredPointDistM,
  onHoverPoint,
}: ElevationProfileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragKm, setDragKm] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(
    () => points.map((p) => ({ distKm: p.dist_cumul / 1000, ele: Math.round(p.ele) })),
    [points]
  );
  const hoveredPoint = useMemo(() => {
    if (hoveredPointDistM === null || points.length === 0) return null;
    const idx = nearestIndexByDistance(points, hoveredPointDistM);
    const p = points[idx];
    return p ? { distKm: p.dist_cumul / 1000, ele: Math.round(p.ele) } : null;
  }, [hoveredPointDistM, points]);

  const totalKm = data.length > 0 ? data[data.length - 1].distKm : 0;
  const totalM = totalKm * 1000;

  const kmToPx = (km: number) => {
    const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    return MARGIN.left + (totalKm > 0 ? (km / totalKm) * plotWidth : 0);
  };

  const boundaries = days.slice(0, -1).map((d, i) => ({
    boundaryIndex: i,
    km: draggingIndex === i ? dragKm : d.end_dist_m / 1000,
    minKm: days[i].start_dist_m / 1000 + MIN_GAP_KM,
    maxKm: days[i + 1].end_dist_m / 1000 - MIN_GAP_KM,
  }));

  const handlePointerDown = (b: (typeof boundaries)[number]) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIndex(b.boundaryIndex);
    setDragKm(b.km);
  };

  const handlePointerMove = (b: (typeof boundaries)[number]) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex !== b.boundaryIndex || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
    const km = ((x - MARGIN.left) / plotWidth) * totalKm;
    setDragKm(Math.min(Math.max(km, b.minKm), b.maxKm));
  };

  const handlePointerUp = (b: (typeof boundaries)[number]) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex !== b.boundaryIndex) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onAdjustBoundary(b.boundaryIndex, Math.round(dragKm * 1000));
    setDraggingIndex(null);
  };

  return (
    <div className="tp-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="tp-heading text-sm" style={{ color: "var(--tp-text)" }}>
          {fr.elevation.title}
        </h3>
        {days.length > 1 && (
          <p className="text-xs" style={{ color: "var(--tp-text-muted)" }}>
            {fr.planning.adjustHint}
          </p>
        )}
      </div>

      <div ref={containerRef} className="relative w-full" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={MARGIN}
            onMouseMove={(state) => {
              if (typeof state?.activeLabel === "number") {
                onHoverPoint(state.activeLabel * 1000);
              }
            }}
            onMouseLeave={() => onHoverPoint(null)}
          >
            <defs>
              <linearGradient id="dayGradient" x1="0" y1="0" x2="1" y2="0">
                {days.length > 0 ? (
                  days.flatMap((d, i) => {
                    const from = totalM > 0 ? (d.start_dist_m / totalM) * 100 : 0;
                    const to = totalM > 0 ? (d.end_dist_m / totalM) * 100 : 100;
                    const opacity = hoveredDayIndex === null || hoveredDayIndex === d.day_index ? 1 : 0.35;
                    return [
                      <stop key={`${i}-a`} offset={`${from}%`} stopColor={dayColor(i)} stopOpacity={opacity} />,
                      <stop key={`${i}-b`} offset={`${to}%`} stopColor={dayColor(i)} stopOpacity={opacity} />,
                    ];
                  })
                ) : (
                  <stop offset="0%" stopColor="var(--tp-forest-light)" />
                )}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tp-border)" />
            <XAxis
              dataKey="distKm"
              type="number"
              domain={[0, "dataMax"]}
              tickFormatter={(v: number) => v.toFixed(0)}
              stroke="var(--tp-text-muted)"
              fontSize={11}
              label={{ value: fr.elevation.distance, position: "insideBottom", offset: -6, fill: "var(--tp-text-muted)", fontSize: 11 }}
            />
            <YAxis
              domain={["dataMin - 30", "dataMax + 30"]}
              stroke="var(--tp-text-muted)"
              fontSize={11}
              width={MARGIN.left}
              label={{ value: fr.elevation.altitude, angle: -90, position: "insideLeft", fill: "var(--tp-text-muted)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: "var(--tp-slate-mid)", border: "1px solid var(--tp-border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => fr.planning.distLabel(Number(v))}
              formatter={(v) => [`${v} m`, fr.elevation.altitude] as [string, string]}
            />
            <Area type="monotone" dataKey="ele" stroke="url(#dayGradient)" fill="url(#dayGradient)" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
            {hoveredPoint && (
              <ReferenceDot
                x={hoveredPoint.distKm}
                y={hoveredPoint.ele}
                r={5}
                fill="var(--tp-text)"
                stroke="var(--tp-slate)"
                strokeWidth={2}
                ifOverflow="visible"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {boundaries.map((b) => (
          <div
            key={b.boundaryIndex}
            role="slider"
            tabIndex={0}
            aria-label={`${fr.trip.day} ${b.boundaryIndex + 1} / ${fr.trip.day} ${b.boundaryIndex + 2}`}
            aria-valuemin={b.minKm}
            aria-valuemax={b.maxKm}
            aria-valuenow={b.km}
            onPointerDown={handlePointerDown(b)}
            onPointerMove={handlePointerMove(b)}
            onPointerUp={handlePointerUp(b)}
            onMouseEnter={() => onHoverDay(b.boundaryIndex)}
            onMouseLeave={() => onHoverDay(null)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 1 : 0.1;
              if (e.key === "ArrowLeft") onAdjustBoundary(b.boundaryIndex, Math.round(Math.max(b.km - step, b.minKm) * 1000));
              if (e.key === "ArrowRight") onAdjustBoundary(b.boundaryIndex, Math.round(Math.min(b.km + step, b.maxKm) * 1000));
            }}
            className="absolute top-0 cursor-ew-resize touch-none"
            style={{
              left: kmToPx(b.km) - 8,
              width: 16,
              height: "calc(100% - 24px)",
              outline: "none",
            }}
          >
            <div
              className="mx-auto h-full"
              style={{ width: 2, background: dayColor(b.boundaryIndex + 1), opacity: 0.8 }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: 2,
                top: "40%",
                width: 12,
                height: 12,
                background: "var(--tp-slate)",
                border: `2px solid ${dayColor(b.boundaryIndex + 1)}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
