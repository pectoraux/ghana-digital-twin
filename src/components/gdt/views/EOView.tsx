"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchImagery,
  fetchIndices,
  fetchTimeSeries,
  fetchEOObservations,
  detectChanges,
  type EOScene,
  type EOIndex,
  type TimeSeriesPoint,
} from "@/lib/gdt/api";
import { useGDT } from "@/lib/gdt/store";
import { GHANA_BOUNDS, GHANA_OUTLINE, REGIONS, project, VIEW_W, VIEW_H, pathFromCoords, formatCoord } from "@/lib/gdt/geo";
import { geometryToSvgPaths, geometryCentroidXY } from "@/lib/gdt/geo-render";
import { cn } from "@/lib/utils";
import { SectionLabel, StatusDot, MetricStat, ConfidencePill } from "@/components/gdt/atoms";
import { fmtDateTime, timeAgo } from "@/lib/gdt/format";
import {
  Satellite,
  Cloud,
  Calendar,
  Activity,
  Layers,
  Crosshair,
  Play,
  TrendingDown,
  TrendingUp,
  Zap,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

const INDEX_COLORS: Record<string, string> = {
  NDVI: "#34d399",
  NDWI: "#22d3ee",
  NBR: "#fb923c",
  EVI: "#84cc16",
  BSI: "#f59e0b",
  MNDWI: "#2dd4bf",
  SAVI: "#a3e635",
};

export function EOView() {
  const [scenes, setScenes] = useState<EOScene[]>([]);
  const [totalScenes, setTotalScenes] = useState(0);
  const [indices, setIndices] = useState<EOIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState("NDVI");
  const [maxCloud, setMaxCloud] = useState(40);
  const [inspectPoint, setInspectPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [tsLoading, setTsLoading] = useState(false);
  const [observations, setObservations] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);

  // initial load: scenes + indices
  useEffect(() => {
    fetchIndices().then((r) => setIndices(r.indices)).catch(() => {});
    refreshScenes();
  }, [maxCloud]);

  function refreshScenes() {
    setLoading(true);
    fetchImagery({ maxCloud, limit: 120 })
      .then((r) => {
        setScenes(r.scenes);
        setTotalScenes(r.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  // when inspect point changes, fetch time series + observations
  useEffect(() => {
    if (!inspectPoint) {
      setTimeSeries([]);
      return;
    }
    setTsLoading(true);
    fetchTimeSeries(inspectPoint.lng, inspectPoint.lat, selectedIndex, { maxCloud })
      .then((r) => {
        setTimeSeries(r.points);
        setTsLoading(false);
      })
      .catch(() => setTsLoading(false));
  }, [inspectPoint, selectedIndex, maxCloud]);

  // load recent observations
  useEffect(() => {
    fetchEOObservations(undefined, 30).then((r) => setObservations(r.observations)).catch(() => {});
  }, []);

  const handleDetect = async () => {
    if (!inspectPoint) return;
    setDetecting(true);
    try {
      const r = await detectChanges(inspectPoint.lng, inspectPoint.lat, selectedIndex);
      setObservations(r.observations);
    } finally {
      setDetecting(false);
    }
  };

  // stats
  const cloudAvg = scenes.length
    ? scenes.reduce((a, s) => a + (s.cloudCover ?? 0), 0) / scenes.length
    : 0;
  const dateRange = useMemo(() => {
    if (scenes.length === 0) return null;
    const dates = scenes.map((s) => new Date(s.datetime).getTime()).sort();
    return { earliest: dates[0], latest: dates[dates.length - 1] };
  }, [scenes]);

  const selectedIdx = indices.find((i) => i.name === selectedIndex);

  return (
    <div className="flex h-full w-full">
      {/* Left: scene catalog map + list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Satellite className="size-4 text-primary" /> Earth Observation
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {totalScenes} Sentinel-2 scenes
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8">
                <Cloud className="size-3.5 text-muted-foreground" />
                <span className="text-[14px] text-muted-foreground">max cloud</span>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={maxCloud}
                  onChange={(e) => setMaxCloud(parseInt(e.target.value))}
                  className="w-20 accent-primary"
                />
                <span className="text-[14px] font-mono tnum w-7">{maxCloud}%</span>
              </div>
              <button
                onClick={refreshScenes}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <Layers className="size-3.5" /> Refresh
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Scenes" value={totalScenes} sub="in catalog" accent="#34d399" />
            <MetricStat label="Avg cloud" value={`${cloudAvg.toFixed(1)}%`} sub="filtered view" accent="#22d3ee" />
            <MetricStat
              label="Latest"
              value={dateRange ? new Date(dateRange.latest).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
              sub={dateRange ? timeAgo(new Date(dateRange.latest).toISOString()) : ""}
              accent="#fbbf24"
            />
            <MetricStat label="Indices" value={indices.length} sub="spectral formulas" accent="#fb923c" />
          </div>
        </div>

        {/* scene map + inspector */}
        <div className="flex min-h-0 flex-1">
          {/* scene footprint map */}
          <div className="relative w-[55%] min-w-[320px] border-r border-border bg-[oklch(0.135_0.006_165)]">
            <SceneMap
              scenes={scenes}
              loading={loading}
              inspectPoint={inspectPoint}
              onPick={(lng, lat) => setInspectPoint({ lng, lat })}
            />
            <div className="absolute left-3 top-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[14px] font-mono text-emerald-400 backdrop-blur">
              {scenes.length} SCENE FOOTPRINTS · CLICK TO INSPECT
            </div>
            {inspectPoint && (
              <div className="absolute left-3 bottom-3 rounded-md border border-border bg-card/85 px-2 py-1.5 text-[14px] font-mono backdrop-blur">
                <div className="text-muted-foreground">PIXEL INSPECTOR</div>
                <div className="text-foreground">{formatCoord([inspectPoint.lng, inspectPoint.lat])}</div>
              </div>
            )}
          </div>

          {/* time series panel */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border px-3 py-2 flex items-center gap-2">
              <Activity className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">Temporal Index Series</span>
              {selectedIdx && (
                <span className="text-[14px] font-mono text-muted-foreground ml-auto">{selectedIdx.name}: {selectedIdx.formula}</span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
              {!inspectPoint ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Crosshair className="size-8 opacity-30" />
                  <span className="text-xs">Click the map to inspect a pixel</span>
                  <span className="text-[14px]">Real NDVI/NDWI/NBR values computed from Sentinel-2 COGs</span>
                </div>
              ) : tsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground">Reading real Sentinel-2 pixels…</span>
                </div>
              ) : (
                <TimeSeriesChart points={timeSeries} indexName={selectedIndex} color={INDEX_COLORS[selectedIndex] ?? "#34d399"} />
              )}
            </div>
            {inspectPoint && (
              <div className="border-t border-border p-3 flex items-center gap-2">
                <button
                  onClick={handleDetect}
                  disabled={detecting}
                  className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {detecting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  Detect {selectedIndex} changes
                </button>
                <span className="text-[14px] text-muted-foreground">
                  Emits factual observations (Δ ≥ 0.15). No legal conclusions.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: index picker + observations */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Layers className="size-3.5 text-primary" /> Spectral Indices
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* index picker */}
          <div>
            <SectionLabel className="mb-2">Index Layer</SectionLabel>
            <div className="space-y-1">
              {indices.map((idx) => {
                const active = idx.name === selectedIndex;
                const col = INDEX_COLORS[idx.name] ?? "#a1a1aa";
                return (
                  <button
                    key={idx.name}
                    onClick={() => setSelectedIndex(idx.name)}
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/8" : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="mt-0.5 size-2.5 rounded-full" style={{ background: col, boxShadow: active ? `0 0 8px ${col}` : "none" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[16px] font-semibold", active && "text-primary")}>{idx.name}</span>
                        <span className="text-[13px] font-mono text-muted-foreground">[{idx.range[0]}, {idx.range[1]}]</span>
                      </div>
                      <div className="text-[14px] text-muted-foreground truncate">{idx.formula}</div>
                      <div className="text-[13px] text-muted-foreground/70 mt-0.5 line-clamp-2">{idx.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* observations */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Zap className="size-3" /> Factual Observations ({observations.length})
            </SectionLabel>
            {observations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[15px] text-muted-foreground">
                No observations yet. Pick a pixel and run detection.
              </div>
            ) : (
              <div className="space-y-1.5">
                {observations.slice(0, 15).map((o) => {
                  const isDrop = (o.delta ?? 0) < 0;
                  const col = INDEX_COLORS[o.indexName] ?? "#a1a1aa";
                  return (
                    <div key={o.id} className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: col }} />
                        <span className="text-[14px] font-mono text-muted-foreground">{o.indexName}</span>
                        {isDrop ? (
                          <TrendingDown className="size-3 text-rose-400" />
                        ) : (
                          <TrendingUp className="size-3 text-emerald-400" />
                        )}
                        <span className={cn("text-[14px] font-mono tnum", isDrop ? "text-rose-400" : "text-emerald-400")}>
                          {(o.delta ?? 0) >= 0 ? "+" : ""}{(o.delta ?? 0).toFixed(3)}
                        </span>
                        <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(o.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-[14px] text-foreground/80 leading-snug line-clamp-3">{o.summary}</div>
                      <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground font-mono">
                        <span>{(o.beforeValue ?? 0).toFixed(3)} → {(o.afterValue ?? 0).toFixed(3)}</span>
                        <span>·</span>
                        <span>{new Date(o.afterDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Scene footprint map (SVG, click to inspect) ----
function SceneMap({
  scenes,
  loading,
  inspectPoint,
  onPick,
}: {
  scenes: EOScene[];
  loading: boolean;
  inspectPoint: { lng: number; lat: number } | null;
  onPick: (lng: number, lat: number) => void;
}) {
  const outlinePath = pathFromCoords(GHANA_OUTLINE, VIEW_W, VIEW_H, true);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const lng = (p.x / VIEW_W) * (GHANA_BOUNDS.maxLng - GHANA_BOUNDS.minLng) + GHANA_BOUNDS.minLng;
    const lat = GHANA_BOUNDS.maxLat - (p.y / VIEW_H) * (GHANA_BOUNDS.maxLat - GHANA_BOUNDS.minLat);
    onPick(lng, lat);
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 gdt-grid-bg opacity-40" />
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="eoOutlineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0.01 160)" />
            <stop offset="100%" stopColor="oklch(0.17 0.008 160)" />
          </linearGradient>
        </defs>
        {/* Ghana outline */}
        <path d={outlinePath} fill="url(#eoOutlineFill)" stroke="oklch(0.5 0.03 160)" strokeWidth={1.2} opacity={0.85} />
        {/* scene footprints */}
        {scenes.map((s) => {
          const paths = geometryToSvgPaths(s.geometry);
          const cloud = s.cloudCover ?? 0;
          const opacity = Math.max(0.12, 0.5 - cloud / 200);
          return paths.map((d, i) => (
            <path
              key={`${s.id}-${i}`}
              d={d}
              fill={cloud < 20 ? "#34d39922" : cloud < 40 ? "#fbbf2422" : "#fb923c22"}
              stroke={cloud < 20 ? "#34d39988" : cloud < 40 ? "#fbbf2488" : "#fb923c88"}
              strokeWidth={0.5}
              opacity={opacity}
            />
          ));
        })}
        {/* inspect point */}
        {inspectPoint &&
          (() => {
            const [x, y] = project([inspectPoint.lng, inspectPoint.lat], VIEW_W, VIEW_H);
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r={6} fill="none" stroke="#f43f5e" strokeWidth={1.5} className="gdt-ping" style={{ transformOrigin: `${x}px ${y}px` }} />
                <circle cx={x} cy={y} r={3} fill="#f43f5e" stroke="#0a0a0a" strokeWidth={0.6} />
                <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke="#f43f5e" strokeWidth={0.6} opacity={0.7} />
                <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke="#f43f5e" strokeWidth={0.6} opacity={0.7} />
              </g>
            );
          })()}
      </svg>
    </div>
  );
}

// ---- Time-series chart ----
function TimeSeriesChart({
  points,
  indexName,
  color,
}: {
  points: TimeSeriesPoint[];
  indexName: string;
  color: string;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[15px] text-muted-foreground">
        No cloud-free scenes at this point in the selected range.
      </div>
    );
  }
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  const values = valid.map((p) => p.value as number);
  if (values.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[15px] text-muted-foreground">
        No valid {indexName} values (all scenes cloud-covered or nodata at this point).
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 460;
  const H = 180;
  const pad = { l: 36, r: 12, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const dates = points.map((p) => new Date(p.datetime).getTime());
  const tMin = Math.min(...dates);
  const tMax = Math.max(...dates);
  const tRange = tMax - tMin || 1;
  const x = (t: number) => pad.l + ((t - tMin) / tRange) * iw;
  const y = (v: number) => pad.t + ih - ((v - min) / range) * ih;

  const pathD = valid
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(new Date(p.datetime).getTime()).toFixed(1)},${y(p.value as number).toFixed(1)}`)
    .join(" ");

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[14px] font-mono">
        <span className="text-muted-foreground">{indexName} @ pixel</span>
        <span style={{ color }}>min {min.toFixed(3)}</span>
        <span style={{ color }}>max {max.toFixed(3)}</span>
        <span style={{ color }}>mean {mean.toFixed(3)}</span>
        <span className="text-muted-foreground ml-auto">{valid.length} points</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + ih * t;
          const vv = max - t * range;
          return (
            <g key={t}>
              <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke="oklch(1 0 0 / 0.06)" strokeWidth={0.5} />
              <text x={pad.l - 4} y={yy + 3} fill="#71717a" fontSize={8} textAnchor="end" className="font-mono">
                {vv.toFixed(2)}
              </text>
            </g>
          );
        })}
        {/* mean line */}
        <line x1={pad.l} y1={y(mean)} x2={W - pad.r} y2={y(mean)} stroke={color} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.5} />
        <text x={W - pad.r} y={y(mean) - 3} fill={color} fontSize={7} textAnchor="end" className="font-mono opacity-70">
          mean {mean.toFixed(2)}
        </text>
        {/* path */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {/* points */}
        {valid.map((p, i) => {
          const cx = x(new Date(p.datetime).getTime());
          const cy = y(p.value as number);
          const cloud = p.cloudCover ?? 0;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="#0a0a0a" strokeWidth={0.5} />
              <title>{`${new Date(p.datetime).toISOString().slice(0, 10)}\n${indexName}: ${(p.value as number).toFixed(3)}\ncloud: ${cloud.toFixed(1)}%`}</title>
            </g>
          );
        })}
        {/* x axis labels */}
        {valid.length > 0 && (
          <>
            <text x={pad.l} y={H - 8} fill="#71717a" fontSize={8} className="font-mono">
              {new Date(tMin).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </text>
            <text x={W - pad.r} y={H - 8} fill="#71717a" fontSize={8} textAnchor="end" className="font-mono">
              {new Date(tMax).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </text>
          </>
        )}
      </svg>
      {/* scene list */}
      <div className="mt-3 space-y-0.5 max-h-40 overflow-y-auto gdt-scroll">
        {points.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[14px] py-0.5 px-1 rounded hover:bg-accent">
            <span className="text-muted-foreground font-mono w-20">{new Date(p.datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</span>
            <Cloud className="size-2.5 text-muted-foreground" />
            <span className="font-mono tnum text-muted-foreground w-12">{(p.cloudCover ?? 0).toFixed(1)}%</span>
            <span className="font-mono text-[13px] text-muted-foreground/60 truncate flex-1">{p.stacId}</span>
            <span className="font-mono tnum font-semibold w-14 text-right" style={{ color: p.value != null ? color : "#71717a" }}>
              {p.value != null ? (p.value as number).toFixed(3) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
