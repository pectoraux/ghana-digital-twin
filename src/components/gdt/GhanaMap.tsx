"use client";

import { useCallback, useRef, useState, useMemo } from "react";
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
import { ENTITIES } from "@/lib/gdt/entities";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { entityColor, obsColor, OBS_META, ENTITY_META } from "@/lib/gdt/format";
import { useGDT, type LayerKey } from "@/lib/gdt/store";
import type { TwinEntity, Observation } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";

const KIND_LAYER: Record<string, LayerKey> = {
  river: "rivers",
  lake: "lakes",
  wetland: "lakes",
  forest: "forests",
  protected_area: "protected",
  vegetation: "forests",
  settlement: "settlements",
  road: "roads",
  railway: "roads",
  dam: "dams",
  powerline: "dams",
  quarry: "mining",
  excavation: "mining",
  waterbody_mined: "mining",
  agriculture: "forests",
  watershed: "rivers",
};

export function GhanaMap() {
  const layers = useGDT((s) => s.layers);
  const selectedEntityId = useGDT((s) => s.selectedEntityId);
  const selectedObservationId = useGDT((s) => s.selectedObservationId);
  const hoveredEntityId = useGDT((s) => s.hoveredEntityId);
  const hoveredObservationId = useGDT((s) => s.hoveredObservationId);
  const setHoveredEntity = useGDT((s) => s.setHoveredEntity);
  const setHoveredObservation = useGDT((s) => s.setHoveredObservation);
  const selectEntity = useGDT((s) => s.selectEntity);
  const selectObservation = useGDT((s) => s.selectObservation);
  const setCursorCoord = useGDT((s) => s.setCursorCoord);
  const obsFilter = useGDT((s) => s.obsFilter);

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
        const newScale = Math.max(1, Math.min(8, s.scale * factor));
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
      // cursor coord readout (base viewBox space → lng/lat)
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

  // Reset view
  const reset = useCallback(() => setVp({ scale: 1, tx: 0, ty: 0 }), []);
  const zoomBtn = useCallback(
    (dir: number) => {
      setVp((s) => {
        const cx = VIEW_W / 2;
        const cy = VIEW_H / 2;
        const factor = dir > 0 ? 1.3 : 1 / 1.3;
        const newScale = Math.max(1, Math.min(8, s.scale * factor));
        const Lx = (cx - s.tx) / s.scale;
        const Ly = (cy - s.ty) / s.scale;
        return { scale: newScale, tx: cx - Lx * newScale, ty: cy - Ly * newScale };
      });
    },
    []
  );

  // Filter entities by visible layers
  const visibleEntities = useMemo(
    () => ENTITIES.filter((e) => layers[KIND_LAYER[e.kind] ?? "settlements"]),
    [layers]
  );

  // Filter observations
  const visibleObservations = useMemo(() => {
    return OBSERVATIONS.filter((o) => {
      if (!layers.observations) return false;
      if (obsFilter.regionId !== "all" && o.regionId !== obsFilter.regionId) return false;
      if (obsFilter.types.length && !obsFilter.types.includes(o.type)) return false;
      if (obsFilter.statuses.length && !obsFilter.statuses.includes(o.status)) return false;
      if (o.confidence < obsFilter.minConfidence) return false;
      return true;
    });
  }, [layers.observations, obsFilter]);

  const outlinePath = pathFromCoords(GHANA_OUTLINE, VIEW_W, VIEW_H, true);
  const lakePath = pathFromCoords(LAKE_VOLTA, VIEW_W, VIEW_H, true);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.135_0.006_165)]">
      {/* grid + radial glow background */}
      <div className="absolute inset-0 gdt-grid-bg opacity-60" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, oklch(0.2 0.02 160 / 0.5), transparent 60%)",
        }}
      />

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

          {/* Graticule (light) */}
          {layers.grid &&
            [-3, -2, -1, 0, 1].map((lng) => {
              const [x] = project([lng, 8], VIEW_W, VIEW_H);
              return (
                <line key={`g${lng}`} x1={x} y1={0} x2={x} y2={VIEW_H} stroke="oklch(1 0 0 / 0.04)" strokeWidth={0.5} />
              );
            })}
          {layers.grid &&
            [5, 6, 7, 8, 9, 10].map((lat) => {
              const [, y] = project([0, lat], VIEW_W, VIEW_H);
              return (
                <line key={`l${lat}`} x1={0} y1={y} x2={VIEW_W} y2={y} stroke="oklch(1 0 0 / 0.04)" strokeWidth={0.5} />
              );
            })}

          {/* Region labels */}
          {layers.regions && layers.labels &&
            REGIONS.map((r) => {
              const [x, y] = project(r.centroid, VIEW_W, VIEW_H);
              return (
                <g key={r.id} className="pointer-events-none">
                  <circle cx={x} cy={y} r={2.5} fill="oklch(0.6 0.01 160)" opacity={0.4} />
                  <text
                    x={x + 5}
                    y={y + 2}
                    fill="oklch(0.62 0.01 160)"
                    fontSize={9}
                    fontFamily="var(--font-geist-sans)"
                    className="uppercase tracking-wider"
                    opacity={0.7}
                  >
                    {r.name}
                  </text>
                </g>
              );
            })}

          {/* Lake Volta */}
          {layers.lakes && (
            <path
              d={lakePath}
              fill="oklch(0.4 0.06 200 / 0.55)"
              stroke="#22d3ee"
              strokeWidth={1}
              opacity={0.9}
              filter="url(#glow)"
            />
          )}

          {/* Rivers */}
          {layers.rivers &&
            visibleEntities
              .filter((e) => e.kind === "river" && e.geometry)
              .map((e) => (
                <FeaturePath
                  key={e.id}
                  entity={e}
                  path={pathFromCoords(e.geometry!, VIEW_W, VIEW_H, false)}
                  selected={selectedEntityId === e.id}
                  hovered={hoveredEntityId === e.id}
                  onEnter={() => setHoveredEntity(e.id)}
                  onLeave={() => setHoveredEntity(null)}
                  onClick={() => selectEntity(e.id)}
                />
              ))}

          {/* Watersheds */}
          {layers.rivers &&
            visibleEntities
              .filter((e) => e.kind === "watershed")
              .map((e) => {
                const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
                return (
                  <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)}>
                    <circle cx={x} cy={y} r={26} fill="oklch(0.4 0.05 190 / 0.1)" stroke="#2dd4bf" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6} />
                    {layers.labels && (
                      <text x={x} y={y - 30} fill="#2dd4bf" fontSize={8} textAnchor="middle" opacity={0.7}>
                        {e.name}
                      </text>
                    )}
                  </g>
                );
              })}

          {/* Forests & protected areas */}
          {layers.forests &&
            visibleEntities
              .filter((e) => ["forest", "protected_area", "vegetation"].includes(e.kind))
              .map((e) => {
                const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
                const r = e.areaKm2 ? Math.max(6, Math.min(34, Math.sqrt(e.areaKm2) * 0.5)) : 10;
                const sel = selectedEntityId === e.id;
                const hov = hoveredEntityId === e.id;
                return (
                  <g
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => selectEntity(e.id)}
                    onPointerEnter={() => setHoveredEntity(e.id)}
                    onPointerLeave={() => setHoveredEntity(null)}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill="oklch(0.42 0.06 150 / 0.45)"
                      stroke={sel ? "#34d399" : hov ? "#6ee7b7" : "#34d39988"}
                      strokeWidth={sel ? 2 : 1}
                      opacity={hov || sel ? 0.8 : 0.6}
                    />
                    {layers.labels && (
                      <text x={x} y={y + 3} fill="#86efac" fontSize={7.5} textAnchor="middle" opacity={0.8}>
                        {e.name.length > 18 ? e.name.slice(0, 16) + "…" : e.name}
                      </text>
                    )}
                  </g>
                );
              })}

          {/* Roads */}
          {layers.roads &&
            visibleEntities
              .filter((e) => e.kind === "road" && e.geometry)
              .map((e) => (
                <FeaturePath
                  key={e.id}
                  entity={e}
                  path={pathFromCoords(e.geometry!, VIEW_W, VIEW_H, false)}
                  selected={selectedEntityId === e.id}
                  hovered={hoveredEntityId === e.id}
                  onEnter={() => setHoveredEntity(e.id)}
                  onLeave={() => setHoveredEntity(null)}
                  onClick={() => selectEntity(e.id)}
                  baseColor="#a1a1aa"
                  width={1.4}
                />
              ))}

          {/* Dams */}
          {layers.dams &&
            visibleEntities
              .filter((e) => e.kind === "dam")
              .map((e) => {
                const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
                const sel = selectedEntityId === e.id;
                return (
                  <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)} onPointerEnter={() => setHoveredEntity(e.id)} onPointerLeave={() => setHoveredEntity(null)}>
                    <rect x={x - 4} y={y - 4} width={8} height={8} transform={`rotate(45 ${x} ${y})`} fill={sel ? "#fbbf24" : "#f59e0b"} stroke="#fde68a" strokeWidth={sel ? 1.5 : 0.8} />
                  </g>
                );
              })}

          {/* Mining / excavation */}
          {layers.mining &&
            visibleEntities
              .filter((e) => ["quarry", "excavation", "waterbody_mined"].includes(e.kind))
              .map((e) => {
                const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
                const sel = selectedEntityId === e.id;
                const hov = hoveredEntityId === e.id;
                const r = e.areaKm2 ? Math.max(5, Math.min(20, Math.sqrt(e.areaKm2) * 1.4)) : 8;
                const col = entityColor(e.kind);
                const isMinedWater = e.kind === "waterbody_mined";
                return (
                  <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)} onPointerEnter={() => setHoveredEntity(e.id)} onPointerLeave={() => setHoveredEntity(null)}>
                    {e.geometry ? (
                      <path
                        d={pathFromCoords(e.geometry, VIEW_W, VIEW_H, true)}
                        fill={isMinedWater ? "#f59e0b55" : "url(#miningHatch)"}
                        stroke={col}
                        strokeWidth={sel ? 2 : 1}
                        opacity={hov || sel ? 1 : 0.85}
                      />
                    ) : (
                      <circle cx={x} cy={y} r={r} fill={isMinedWater ? "#f59e0b55" : "url(#miningHatch)"} stroke={col} strokeWidth={sel ? 2 : 1} />
                    )}
                    <circle cx={x} cy={y} r={2} fill={col} />
                  </g>
                );
              })}

          {/* Settlements */}
          {layers.settlements &&
            visibleEntities
              .filter((e) => e.kind === "settlement")
              .map((e) => {
                const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
                const sel = selectedEntityId === e.id;
                const hov = hoveredEntityId === e.id;
                const big = (e.attributes.population as number) > 500000;
                const r = big ? 4 : 2.6;
                return (
                  <g key={e.id} className="cursor-pointer" onClick={() => selectEntity(e.id)} onPointerEnter={() => setHoveredEntity(e.id)} onPointerLeave={() => setHoveredEntity(null)}>
                    <circle cx={x} cy={y} r={r + 2} fill="#fbbf2422" />
                    <circle cx={x} cy={y} r={r} fill={sel ? "#fde68a" : "#fbbf24"} stroke="#fff8e1" strokeWidth={sel ? 1.2 : 0.5} />
                    {layers.labels && (big || hov || sel) && (
                      <text x={x + r + 3} y={y + 3} fill="#fde68a" fontSize={8.5} fontWeight={big ? 600 : 400} opacity={0.95}>
                        {e.name}
                      </text>
                    )}
                  </g>
                );
              })}

          {/* Observations */}
          {visibleObservations.map((o) => (
            <ObservationMarker
              key={o.id}
              obs={o}
              selected={selectedObservationId === o.id}
              hovered={hoveredObservationId === o.id}
              onEnter={() => setHoveredObservation(o.id)}
              onLeave={() => setHoveredObservation(null)}
              onClick={() => selectObservation(o.id)}
            />
          ))}

          {/* Hover label */}
          {hoveredEntityId &&
            (() => {
              const e = ENTITIES.find((x) => x.id === hoveredEntityId);
              if (!e) return null;
              const [x, y] = project(e.centroid, VIEW_W, VIEW_H);
              return <HoverLabel x={x} y={y - 14} text={e.name} sub={ENTITY_META[e.kind].label} color={entityColor(e.kind)} />;
            })()}
          {hoveredObservationId &&
            (() => {
              const o = OBSERVATIONS.find((x) => x.id === hoveredObservationId);
              if (!o) return null;
              const [x, y] = project(o.location, VIEW_W, VIEW_H);
              return <HoverLabel x={x} y={y - 16} text={o.title} sub={OBS_META[o.type].label} color={obsColor(o.type)} />;
            })()}
        </g>

        {/* Scanline sweep (outside transform so it covers viewport) */}
        <rect x={0} y={-20} width={VIEW_W} height={2} fill="oklch(0.72 0.16 155 / 0.5)" className="gdt-scanline" />
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
        </div>
      </div>
    </div>
  );
}

function FeaturePath({
  entity,
  path,
  selected,
  hovered,
  onEnter,
  onLeave,
  onClick,
  baseColor,
  width,
}: {
  entity: TwinEntity;
  path: string;
  selected: boolean;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  baseColor?: string;
  width?: number;
}) {
  const col = baseColor ?? entityColor(entity.kind);
  const w = width ?? (entity.kind === "road" ? 1.4 : 2);
  return (
    <path
      d={path}
      fill="none"
      stroke={col}
      strokeWidth={selected ? w + 1.5 : hovered ? w + 0.8 : w}
      opacity={hovered || selected ? 1 : 0.85}
      strokeLinejoin="round"
      strokeLinecap="round"
      filter={selected || hovered ? "url(#glow)" : undefined}
      className="cursor-pointer"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
    />
  );
}

function ObservationMarker({
  obs,
  selected,
  hovered,
  onEnter,
  onLeave,
  onClick,
}: {
  obs: Observation;
  selected: boolean;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const [x, y] = project(obs.location, VIEW_W, VIEW_H);
  const col = obsColor(obs.type);
  const r = selected ? 6 : hovered ? 5 : 4;
  return (
    <g
      className="cursor-pointer"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* pulsing ring */}
      {(obs.status === "active" || selected) && (
        <circle cx={x} cy={y} r={r} fill="none" stroke={col} strokeWidth={1.5} className="gdt-ping" style={{ transformOrigin: `${x}px ${y}px` }} />
      )}
      <circle cx={x} cy={y} r={r + 4} fill={`${col}22`} />
      <circle cx={x} cy={y} r={r} fill={col} stroke="#0a0a0a" strokeWidth={0.8} />
      {selected && <circle cx={x} cy={y} r={r + 7} fill="none" stroke={col} strokeWidth={1} strokeDasharray="2 2" />}
    </g>
  );
}

function HoverLabel({
  x,
  y,
  text,
  sub,
  color,
}: {
  x: number;
  y: number;
  text: string;
  sub: string;
  color: string;
}) {
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

function ZoomBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
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
