"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchRasterProducts,
  fetchRasterProduct,
  fetchBaselines,
  type RasterProductMeta,
  type RasterProductDetail,
  type ProductTypeInfo,
  type BaselineInfo,
} from "@/lib/gdt/api";
import {
  GHANA_OUTLINE,
  GHANA_BOUNDS,
  project,
  VIEW_W,
  VIEW_H,
  pathFromCoords,
  formatCoord,
} from "@/lib/gdt/geo";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Grid3x3,
  Loader2,
  TrendingDown,
  TrendingUp,
  Sigma,
  Database,
  GitCommit,
  Layers,
  Zap,
  ChevronRight,
} from "lucide-react";

// Color scales per product type
function valueToColor(type: string, value: number, min: number, max: number): string {
  if (!Number.isFinite(value)) return "transparent";
  // normalize to 0..1
  const range = max - min || 1;
  const t = Math.max(0, Math.min(1, (value - min) / range));

  if (type.includes("anomaly") || type === "burn_severity" || type === "change_probability") {
    // diverging scale: negative=red, 0=neutral, positive=green/blue
    // for change_probability: 0=green, 1=red
    if (type === "change_probability") {
      // green → yellow → red
      if (t < 0.5) {
        const r = Math.round(t * 2 * 220);
        const g = 200;
        return `rgb(${r},${g},80)`;
      } else {
        const r = 220;
        const g = Math.round((1 - (t - 0.5) * 2) * 200);
        return `rgb(${r},${g},80)`;
      }
    }
    // z-score diverging: -5=red, 0=dark, +5=green
    const mid = (min + max) / 2;
    const d = value - mid;
    const intensity = Math.min(1, Math.abs(d) / Math.max(Math.abs(min), Math.abs(max)));
    if (d < 0) {
      // negative anomaly → red/orange (loss)
      return `rgba(244,63,94,${0.3 + intensity * 0.6})`;
    } else {
      // positive anomaly → emerald (gain)
      return `rgba(52,211,153,${0.3 + intensity * 0.6})`;
    }
  }
  if (type === "bare_soil") {
    // green → amber → red
    if (t < 0.5) return `rgba(52,211,153,${0.3 + (0.5 - t) * 0.8})`;
    return `rgba(245,158,11,${0.3 + t * 0.6})`;
  }
  if (type === "cloud_free_composite" || type === "temporal_variance") {
    // viridis-like: dark purple → teal → yellow
    const r = Math.round(t * 220);
    const g = Math.round(t * 200 + 20);
    const b = Math.round((1 - t) * 180 + 40);
    return `rgba(${r},${g},${b},0.7)`;
  }
  // default
  return `rgba(100,160,200,${0.2 + t * 0.6})`;
}

export function RasterIntelligenceView() {
  const [types, setTypes] = useState<ProductTypeInfo[]>([]);
  const [products, setProducts] = useState<RasterProductMeta[]>([]);
  const [baselines, setBaselines] = useState<BaselineInfo[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<RasterProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // initial load
  useEffect(() => {
    fetchRasterProducts().then((r) => {
      setTypes(r.types);
      setProducts(r.products);
      if (r.types.length > 0) setSelectedType(r.types[0].type);
      setLoading(false);
    }).catch(() => setLoading(false));
    fetchBaselines().then((r) => setBaselines(r.baselines)).catch(() => {});
  }, []);

  // when selected product changes, fetch its grid
  useEffect(() => {
    if (!selectedProductId) {
      Promise.resolve().then(() => setProductDetail(null));
      return;
    }
    let active = true;
    Promise.resolve().then(() => { if (active) setDetailLoading(true); });
    fetchRasterProduct(selectedProductId)
      .then((d) => {
        if (active) {
          setProductDetail(d);
          setDetailLoading(false);
        }
      })
      .catch(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedProductId]);

  // auto-select first product of the selected type (async to avoid sync setState in effect)
  useEffect(() => {
    if (!selectedType) return;
    const ofType = products.filter((p) => p.type === selectedType);
    if (ofType.length > 0 && !products.find((p) => p.id === selectedProductId && p.type === selectedType)) {
      Promise.resolve().then(() => setSelectedProductId(ofType[0].id));
    } else if (ofType.length === 0 && selectedProductId) {
      Promise.resolve().then(() => setSelectedProductId(null));
    }
  }, [selectedType, products, selectedProductId]);

  const selectedMeta = products.find((p) => p.id === selectedProductId);
  const selectedTypeInfo = types.find((t) => t.type === selectedType);

  return (
    <div className="flex h-full w-full">
      {/* Left: product types + list */}
      <div className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-card/20 md:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Grid3x3 className="size-3.5 text-primary" /> Raster Intelligence
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">Derived products with uncertainty</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* Product types */}
          <div>
            <SectionLabel className="mb-2">Product Types</SectionLabel>
            <div className="space-y-1">
              {types.map((t) => {
                const active = t.type === selectedType;
                const count = products.filter((p) => p.type === t.type).length;
                return (
                  <button
                    key={t.type}
                    onClick={() => setSelectedType(t.type)}
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/8" : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="mt-0.5 size-2.5 rounded-full" style={{ background: t.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[12px] font-semibold", active && "text-primary")}>{t.label}</span>
                        {count > 0 && <span className="text-[9px] font-mono text-muted-foreground">{count}</span>}
                      </div>
                      <div className="text-[9px] text-muted-foreground/70 line-clamp-2 mt-0.5">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products of selected type */}
          <div>
            <SectionLabel className="mb-2">
              {selectedTypeInfo?.label ?? "Products"} ({products.filter((p) => p.type === selectedType).length})
            </SectionLabel>
            <div className="space-y-1">
              {products.filter((p) => p.type === selectedType).map((p) => {
                const active = p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/8" : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="size-2 rounded-full" style={{ background: selectedTypeInfo?.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">
                        {p.mgrsTile ?? "—"} · {p.season ?? "—"}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono">
                        mean {p.meanValue?.toFixed(3) ?? "—"} · {(p.confidence * 100).toFixed(0)}% conf
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{timeAgo(p.computedAt)}</span>
                  </button>
                );
              })}
              {products.filter((p) => p.type === selectedType).length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[10px] text-muted-foreground">
                  No products yet. Generate via API.
                </div>
              )}
            </div>
          </div>

          {/* Baselines */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Sigma className="size-3" /> Seasonal Baselines ({baselines.length})
            </SectionLabel>
            <div className="space-y-1">
              {baselines.map((b) => (
                <div key={b.id} className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium">{b.indexName}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{b.mgrsTile}</span>
                    <span className="ml-auto text-[9px] text-muted-foreground">{b.season}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                    <span>n={b.sampleCount}</span>
                    <span>±{b.uncertainty.toFixed(4)}</span>
                    <span className="text-primary">{b.gridSize}×{b.gridSize}</span>
                  </div>
                </div>
              ))}
              {baselines.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[10px] text-muted-foreground">
                  No baselines computed
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: raster grid map */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Grid3x3 className="size-4 text-primary" /> Raster Intelligence
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {products.length} products · {baselines.length} baselines
            </span>
            {selectedTypeInfo && (
              <span className="text-[11px] text-muted-foreground">· {selectedTypeInfo.description}</span>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-[oklch(0.135_0.006_165)]">
          <div className="absolute inset-0 gdt-grid-bg opacity-40" />
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="riOutlineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.22 0.01 160)" />
                <stop offset="100%" stopColor="oklch(0.17 0.008 160)" />
              </linearGradient>
            </defs>
            {/* Ghana outline */}
            <path d={pathFromCoords(GHANA_OUTLINE, VIEW_W, VIEW_H, true)} fill="url(#riOutlineFill)" stroke="oklch(0.5 0.03 160)" strokeWidth={1.2} opacity={0.85} />

            {/* Raster product grid overlay */}
            {productDetail && !detailLoading && (
              <RasterGridOverlay product={productDetail} />
            )}

            {detailLoading && (
              <g>
                <text x={VIEW_W / 2} y={VIEW_H / 2} fill="#34d399" fontSize={14} textAnchor="middle" className="font-mono">
                  Loading grid…
                </text>
              </g>
            )}

            {/* Product extent indicator */}
            {selectedMeta && !productDetail && (
              (() => {
                const e = selectedMeta.extent;
                const [x1, y1] = project([e.minLng, e.maxLat], VIEW_W, VIEW_H);
                const [x2, y2] = project([e.maxLng, e.minLat], VIEW_W, VIEW_H);
                return (
                  <g>
                    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={selectedTypeInfo?.color ?? "#34d399"} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
                    <text x={(x1 + x2) / 2} y={y1 - 5} fill={selectedTypeInfo?.color ?? "#34d399"} fontSize={9} textAnchor="middle" className="font-mono">
                      {selectedMeta.mgrsTile}
                    </text>
                  </g>
                );
              })()
            )}
          </svg>

          {/* Legend / color bar */}
          {productDetail && (
            <div className="absolute left-3 bottom-3 rounded-lg border border-border bg-card/85 backdrop-blur p-2.5 w-[200px]">
              <SectionLabel className="mb-1.5">{selectedTypeInfo?.label}</SectionLabel>
              <ColorBar type={selectedType} min={productDetail.minValue ?? 0} max={productDetail.maxValue ?? 1} />
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>min: {productDetail.minValue?.toFixed(3)}</span>
                <span>mean: {productDetail.meanValue?.toFixed(3)}</span>
                <span>max: {productDetail.maxValue?.toFixed(3)}</span>
              </div>
            </div>
          )}

          {/* Info badge */}
          <div className="absolute left-3 top-3 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-mono text-primary backdrop-blur">
            {productDetail ? `${productDetail.gridSize}×${productDetail.gridSize} GRID · UNCERTAINTY ±${(productDetail.confidence * 100).toFixed(0)}%` : "SELECT A PRODUCT"}
          </div>
        </div>
      </div>

      {/* Right: product details */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Layers className="size-3.5 text-primary" /> Product Details
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
          {!productDetail ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Grid3x3 className="size-8 opacity-30" />
              <span className="text-xs">Select a product to inspect</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* stats */}
              <div className="grid grid-cols-2 gap-2">
                <MetricStat label="Mean" value={productDetail.meanValue?.toFixed(3) ?? "—"} accent={selectedTypeInfo?.color} />
                <MetricStat label="Std" value={productDetail.stdValue?.toFixed(3) ?? "—"} />
                <MetricStat label="Min" value={productDetail.minValue?.toFixed(3) ?? "—"} />
                <MetricStat label="Max" value={productDetail.maxValue?.toFixed(3) ?? "—"} />
              </div>

              {/* confidence */}
              <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-mono tnum font-semibold" style={{ color: productDetail.confidence > 0.5 ? "#34d399" : "#fbbf24" }}>
                    {(productDetail.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <ConfidenceBar value={productDetail.confidence} showLabel={false} />
                <div className="text-[10px] text-muted-foreground">
                  Derived from valid-pixel ratio × uncertainty factor
                </div>
              </div>

              {/* formula */}
              <div>
                <SectionLabel className="mb-2">Formula</SectionLabel>
                <div className="rounded-lg border border-border bg-background/60 p-3">
                  <code className="text-[11px] font-mono text-foreground/90 leading-relaxed">{productDetail.formula}</code>
                </div>
              </div>

              {/* provenance */}
              <div>
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Database className="size-3" /> Provenance
                </SectionLabel>
                <div className="space-y-1">
                  {productDetail.sources.map((s) => (
                    <div key={s} className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                      <Database className="size-3 text-muted-foreground" />
                      <span className="text-[11px]">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* spatial extent */}
              <div>
                <SectionLabel className="mb-2">Spatial Extent</SectionLabel>
                <div className="rounded-lg border border-border bg-card/40 p-3 space-y-1 text-[10px] font-mono text-muted-foreground">
                  <div>MGRS: {productDetail.mgrsTile ?? "—"}</div>
                  <div>Season: {productDetail.season ?? "—"}</div>
                  <div>Grid: {productDetail.gridSize}×{productDetail.gridSize} ({productDetail.gridSize ** 2} cells)</div>
                  <div>NW: {productDetail.extent.maxLat.toFixed(3)}°N, {productDetail.extent.minLng.toFixed(3)}°W</div>
                  <div>SE: {productDetail.extent.minLat.toFixed(3)}°N, {productDetail.extent.maxLng.toFixed(3)}°W</div>
                </div>
              </div>

              {/* uncertainty note */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sigma className="size-3 text-amber-400" />
                  <span className="text-[10px] font-semibold text-amber-400">Uncertainty Propagation</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Every cell carries a value ± uncertainty, propagated from sensor noise (cloud-cover dependent),
                  atmospheric correction, and baseline standard error (σ/√n). Downstream systems receive both
                  the measurement and its confidence.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Raster grid overlay renderer ----
function RasterGridOverlay({ product }: { product: RasterProductDetail }) {
  const { valueGrid, uncertaintyGrid, gridSize, extent, type } = product;
  const [minLng, minLat, maxLng, maxLat] = [extent.minLng, extent.minLat, extent.maxLng, extent.maxLat];

  // project extent to SVG
  const [sx, sy] = project([minLng, maxLat], VIEW_W, VIEW_H); // top-left
  const [ex, ey] = project([maxLng, minLat], VIEW_W, VIEW_H); // bottom-right
  const cellW = (ex - sx) / gridSize;
  const cellH = (ey - sy) / gridSize;

  // find min/max for color scale
  const valid = valueGrid.filter((v) => Number.isFinite(v));
  const min = valid.length ? Math.min(...valid) : 0;
  const max = valid.length ? Math.max(...valid) : 1;

  // render cells
  const cells: React.ReactElement[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const idx = row * gridSize + col;
      const v = valueGrid[idx];
      const color = valueToColor(type, v, min, max);
      if (color === "transparent") continue;
      const x = sx + col * cellW;
      const y = sy + row * cellH;
      cells.push(
        <rect
          key={idx}
          x={x}
          y={y}
          width={cellW + 0.5}
          height={cellH + 0.5}
          fill={color}
          stroke="none"
        >
          <title>{`(${col},${row}) value=${v?.toFixed(3) ?? "NaN"} ±${uncertaintyGrid[idx]?.toFixed(3) ?? "—"}`}</title>
        </rect>
      );
    }
  }

  // outline
  return (
    <g>
      {cells}
      <rect x={sx} y={sy} width={ex - sx} height={ey - sy} fill="none" stroke={valueToColor(type, max, min, max)} strokeWidth={0.8} opacity={0.5} />
    </g>
  );
}

// ---- Color bar legend ----
function ColorBar({ type, min, max }: { type: string; min: number; max: number }) {
  const stops: React.ReactElement[] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const v = min + t * (max - min);
    const color = valueToColor(type, v, min, max);
    stops.push(<div key={i} className="h-full flex-1" style={{ background: color }} />);
  }
  return (
    <div className="flex h-3 w-full gap-px rounded overflow-hidden">{stops}</div>
  );
}
