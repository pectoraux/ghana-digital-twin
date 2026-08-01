"use client";

import { useCallback, useRef, useState, useMemo, useEffect } from "react";
import {
  GHANA_OUTLINE,
  LAKE_VOLTA,
  REGIONS,
  VIEW_W,
  VIEW_H,
  project,
  pathFromCoords,
  unproject,
  type LngLat,
} from "@/lib/gdt/geo";
import { geometryToSvgPaths, geometryCentroidXY } from "@/lib/gdt/geo-render";
import { fetchEntities } from "@/lib/gdt/api";
import { useGDT, type LayerKey } from "@/lib/gdt/store";
import type { EntityRecord } from "@/lib/worldmodel/types";
import { entityColor, ENTITY_META } from "@/lib/gdt/format";
import { cn } from "@/lib/utils";

const KIND_LAYER: Record<string, LayerKey> = {
  river: "rivers",
  lake: "lakes",
  wetland: "lakes",
  water_body: "lakes",
  forest: "forests",
  protected_area: "protected",
  vegetation: "forests",
  settlement: "settlements",
  road: "roads",
  railway: "roads",
  bridge: "roads",
  dam: "dams",
  quarry: "mining",
  excavation: "mining",
  waterbody_mined: "mining",
  agriculture: "forests",
  watershed: "rivers",
  administrative_boundary: "regions",
  land_cover_region: "forests",
  terrain_feature: "forests",
};

export function GhanaMap() {
  const layers = useGDT((s) => s.layers);
  const selectedEntityId = useGDT((s) => s.selectedEntityId);
  const hoveredEntityId = useGDT((s) => s.hoveredEntityId);
  const setHoveredEntity = useGDT((s) => s.setHoveredEntity);
  const selectEntity = useGDT((s) => s.selectEntity);
  const setCursorCoord = useGDT((s) => s.setCursorCoord);
  const obsFilter = useGDT((s) => s.obsFilter);

  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // fetch real entities from the world model
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEntities({ limit: 2000 })
      .then((res) => {
        if (active) {
          setEntities(res.entities);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);
  const [vp, setVp] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const P = clientToSvg(e.clientX, e.clientY);
      setVp((s) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.max(1, Math.min(10, s.scale * factor));
        if (newScale === s.scale) return s;
        const Lx = (P.x - s.tx) / s.scale;
        const Ly = (P.y - s.ty) / s.scale;
        return { scale: newScale, tx: P.x - Lx * newScale, ty: P.y - Ly * newScale };
      });
    },
    [clientToSvg]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const P = clientToSvg(e.clientX, e.clientY);
      dragStart.current = { x: P.x, y: P.y, tx: vp.tx, ty: vp.ty };
      setDragging(true);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [clientToSvg, vp]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const P = clientToSvg(e.clientX, e.clientY);
      const lngLat = unproject([P.x, P.y], VIEW_W, VIEW_H);
      setCursorCoord(lngLat);
      if (dragging && dragStart.current) {
        const dx = P.x - dragStart.current.x;
        const dy = P.y - dragStart.current.y;
        setVp((s) => ({ ...s, tx: dragStart.current!.tx + dx, ty: dragStart.current!.ty + dy }));
      }
    },
    [clientToSvg, dragging, setCursorCoord]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  const onPointerLeave = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
    setCursorCoord(null);
  }, [setCursorCoord]);

  const reset = useCallback(() => setVp({ scale: 1, tx: 0, ty: 0 }), []);
  const zoomBtn = useCallback((dir: number) => {
    setVp((s) => {
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const factor = dir > 0 ? 1.3 : 1 / 1.3;
      const newScale = Math.max(1, Math.min(10, s.scale * factor));
      const Lx = (cx - s.tx) / s.scale;
      const Ly = (cy - s.ty) / s.scale;
      return { scale: newScale, tx: cx - Lx * newScale, ty: cy - Ly * newScale };
    });
  }, []);

  // group entities by kind for layered rendering
  const byKind = useMemo(() => {
    const m: Record<string, EntityRecord[]> = {};
    for (const e of entities) {
      const layer = KIND_LAYER[e.kind] ?? "settlements";
      if (!layers[layer]) continue;
      (m[e.kind] ??= []).push(e);
    }
    return m;
  }, [entities, layers]);

  const outlinePath = pathFromCoords(GHANA_OUTLINE, VIEW_W, VIEW_H, true);
  const lakePath = pathFromCoords(LAKE_VOLTA, VIEW_W, VIEW_H, true);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.135_0.006_165)]">
      <div className="absolute inset-0 gdt-grid-bg opacity-60" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, oklch(0.2 0.02 160 / 0.5), transparent 60%)",
        }}
      />

      {/* live data source badge */}
      <div className="absolute left-3 bottom-12 z-10 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-400 backdrop-blur">
        <span className="size-1.5 rounded-full bg-emerald-400 gdt-blink" />
        WORLD MODEL · {entities.length} REAL ENTITIES
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-[11px] font-mono text-muted-foreground">Loading world model…</span>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("absolute inset-0 h-full w-full touch-none", dragging ? "cursor-grabbing" : "cursor-grab")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <defs>
          <pattern id="miningHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#f43f5e22" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="1" opacity="0.5" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="outlineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0.01 160)" />
            <stop offset="100%" stopColor="oklch(0.17 0.008 160)" />
          </linearGradient>
        </defs>

        <g transform={`translate(${vp.tx} ${vp.ty}) scale(${vp.scale})`}>
          {/* Country outline */}
          <path d={outlinePath} fill="url(#outlineFill)" stroke="oklch(0.5 0.03 160)" strokeWidth={1.5} opacity={0.95} />
          <path d={outlinePath} fill="none" stroke="oklch(0.7 0.05 160 / 0.25)" strokeWidth={0.6} />

          {/* Graticule */}
          {layers.grid &&
            [-3, -2, -1, 0, 1].map((lng) => {
              const [x] = project([lng, 8], VIEW_W, VIEW_H);
              return <line key={`g${lng}`} x1={x} y1={0} x2={x} y2={VIEW_H} stroke="oklch(1 0 0 / 0.04)" strokeWidth={0.5} />;
            })}
          {layers.grid &&
            [5, 6, 7, 8, 9, 10].map((lat) => {
              const [, y] = project([0, lat], VIEW_W, VIEW_H);
              return <line key={`l${lat}`} x1={0} y1={y} x2={VIEW_W} y2={y} stroke="oklch(1 0 0 / 0.04)" strokeWidth={0.5} />;
            })}

          {/* Administrative boundaries (real polygons from geoBoundaries) */}
          {layers.regions &&
            (byKind["administrative_boundary"] ?? []).map((e) => {
              const paths = geometryToSvgPaths(e.geometry);
              const sel = selectedEntityId === e.id;
              const hov = hoveredEntityId === e.id;
              return paths.map((d, i) => (
                <path
                  key={`${e.id}-${i}`}
                  d={d}
                  fill={sel ? "oklch(0.3 0.04 155 / 0.35)" : hov ? "oklch(0.28 0.03 155 / 0.25)" : "oklch(0.26 0.02 155 / 0.18)"}
                  stroke={sel ? "#34d399" : hov ? "#6ee7b7" : "oklch(0.55 0.03 160 / 0.5)"}
                  strokeWidth={sel ? 1.8 : 1}
                  className="cursor-pointer transition-all"
                  onPointerEnter={() => setHoveredEntity(e.id)}
                  onPointerLeave={() => setHoveredEntity(null)}
                  onClick={() => selectEntity(e.id)}
                />
              ));
            })}

          {/* Region labels */}
          {layers.regions && layers.labels &&
            REGIONS.map((r) => {
              const [x, y] = project(r.centroid, VIEW_W, VIEW_H);
              return (
                <g key={r.id} className="pointer-events-none">
                  <text x={x} y={y} fill="oklch(0.62 0.01 160)" fontSize={9} textAnchor="middle" className="uppercase tracking-wider" opacity={0.6}>
                    {r.name}
                  </text>
                </g>
              );
            })}

          {/* Rivers (real OSM waterways) */}
          {layers.rivers &&
            (byKind["river"] ?? []).map((e) => {
              const paths = geometryToSvgPaths(e.geometry);
              const sel = selectedEntityId === e.id;
              const hov = hoveredEntityId === e.id;
              const col = entityColor(e.kind);
              return paths.map((d, i) => (
                <path
                  key={`${e.id}-${i}`}
                  d={d}
                  fill="none"
                  stroke={col}
                  strokeWidth={sel ? 2.4 : hov ? 1.8 : 0.9}
                  opacity={hov || sel ? 1 : 0.7}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={sel || hov ? "url(#glow)" : undefined}
                  className="cursor-pointer"
                  onPointerEnter={() => setHoveredEntity(e.id)}
                  onPointerLeave={() => setHoveredEntity(null)}
                  onClick={() => selectEntity(e.id)}
                />
              ));
            })}

          {/* Roads (real OSM highways) */}
          {layers.roads &&
            [...(byKind["road"] ?? []), ...(byKind["railway"] ?? []), ...(byKind["bridge"] ?? [])].map((e) => {
              const paths = geometryToSvgPaths(e.geometry);
              const sel = selectedEntityId === e.id;
              const hov = hoveredEntityId === e.id;
              const col = entityColor(e.kind);
              return paths.map((d, i) => (
                <path
                  key={`${e.id}-${i}`}
                  d={d}
                  fill="none"
                  stroke={col}
                  strokeWidth={sel ? 2 : hov ? 1.6 : 0.8}
                  opacity={hov || sel ? 1 : 0.65}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onPointerEnter={() => setHoveredEntity(e.id)}
                  onPointerLeave={() => setHoveredEntity(null)}
                  onClick={() => selectEntity(e.id)}
                />
              ));
            })}

          {/* Dams */}
          {layers.dams &&
            (byKind["dam"] ?? []).map((e) => {
              const [x, y] = e.geometry.type === "Point" ? geometryCentroidXY(e.geometry) : geometryCentroidXY(e.geometry);
              const sel = selectedEntityId === e.id;
              return (
                <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)} onPointerEnter={() => setHoveredEntity(e.id)} onPointerLeave={() => setHoveredEntity(null)}>
                  <rect x={x - 4} y={y - 4} width={8} height={8} transform={`rotate(45 ${x} ${y})`} fill={sel ? "#fde68a" : "#f59e0b"} stroke="#fde68a" strokeWidth={sel ? 1.5 : 0.8} />
                </g>
              );
            })}

          {/* Settlements (real OSM places) */}
          {layers.settlements &&
            (byKind["settlement"] ?? []).map((e) => {
              const [x, y] = geometryCentroidXY(e.geometry);
              const sel = selectedEntityId === e.id;
              const hov = hoveredEntityId === e.id;
              const pop = e.attributes.population as number | undefined;
              const big = !!pop && pop > 50000;
              const r = big ? 3.2 : 1.8;
              return (
                <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)} onPointerEnter={() => setHoveredEntity(e.id)} onPointerLeave={() => setHoveredEntity(null)}>
                  {big && <circle cx={x} cy={y} r={r + 2.5} fill="#fbbf2422" />}
                  <circle cx={x} cy={y} r={r} fill={sel ? "#fde68a" : "#fbbf24"} stroke="#fff8e1" strokeWidth={sel ? 1.2 : 0.4} />
                  {layers.labels && (big || hov || sel) && (
                    <text x={x + r + 2} y={y + 2.5} fill="#fde68a" fontSize={7.5} opacity={0.9}>
                      {e.name.length > 20 ? e.name.slice(0, 18) + "…" : e.name}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Hover label */}
          {hoveredEntityId &&
            (() => {
              const e = entities.find((x) => x.id === hoveredEntityId);
              if (!e) return null;
              const [x, y] = geometryCentroidXY(e.geometry);
              return <HoverLabel x={x} y={y - 14} text={e.name} sub={ENTITY_META[e.kind as keyof typeof ENTITY_META]?.label ?? e.kind} color={entityColor(e.kind as any)} />;
            })()}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <ZoomBtn onClick={() => zoomBtn(1)}>+</ZoomBtn>
        <ZoomBtn onClick={() => zoomBtn(-1)}>−</ZoomBtn>
        <ZoomBtn onClick={reset} title="Reset view">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9M3 12V4M3 12h8" />
          </svg>
        </ZoomBtn>
      </div>

      {/* Scale + zoom readout */}
      <div className="absolute bottom-3 left-3 rounded-md border border-border bg-card/70 px-2 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur">
        <div className="flex items-center gap-2">
          <span>ZOOM {vp.scale.toFixed(1)}×</span>
          <span className="text-border">│</span>
          <span>SCALE 1:{Math.round(620000 / vp.scale).toLocaleString()}</span>
          <span className="text-border">│</span>
          <span className="text-emerald-400">{entities.length} entities</span>
        </div>
      </div>
    </div>
  );
}

function HoverLabel({ x, y, text, sub, color }: { x: number; y: number; text: string; sub: string; color: string }) {
  const w = Math.max(text.length, sub.length) * 5.6 + 16;
  return (
    <g className="pointer-events-none">
      <rect x={x - w / 2} y={y - 16} width={w} height={22} rx={3} fill="oklch(0.16 0.005 165 / 0.95)" stroke={color} strokeWidth={0.7} />
      <text x={x} y={y - 7} fill="#fafafa" fontSize={8.5} fontWeight={600} textAnchor="middle">
        {text.length > 28 ? text.slice(0, 26) + "…" : text}
      </text>
      <text x={x} y={y - 0.5} fill={color} fontSize={6.5} textAnchor="middle" opacity={0.85}>
        {sub}
      </text>
    </g>
  );
}

function ZoomBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 backdrop-blur transition-colors hover:border-primary/40 hover:text-primary hover:bg-card"
    >
      {typeof children === "string" ? <span className="text-lg leading-none">{children}</span> : children}
    </button>
  );
}
