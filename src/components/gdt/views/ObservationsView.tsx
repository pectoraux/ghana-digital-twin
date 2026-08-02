"use client";

import { useMemo, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import {
  fetchObservations,
  triggerObservationScan,
  useAsync,
  type ObservationRecord,
} from "@/lib/gdt/api";
import { fmtArea, timeAgo } from "@/lib/gdt/format";
import type { ObservationType } from "@/lib/observation/types";
import { cn } from "@/lib/utils";
import { SectionLabel, ConfidencePill, MetricStat } from "@/components/gdt/atoms";
import {
  Search,
  Radar,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Layers,
  X,
} from "lucide-react";

// ---- Type / severity / status color maps (NO indigo/blue) ----

const TYPE_COLORS: Record<ObservationType, string> = {
  surface_disturbance: "#fb923c",
  water_body_change: "#22d3ee",
  vegetation_loss: "#f97316",
  burn_event: "#ef4444",
  moisture_stress: "#a78bfa",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f43f5e",
  high: "#fb923c",
  moderate: "#fbbf24",
  low: "#34d399",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#f43f5e",
  monitoring: "#fbbf24",
  resolved: "#34d399",
  candidate: "#a78bfa",
};

const SEVERITY_LIST = ["critical", "high", "moderate", "low"] as const;
const STATUS_LIST = ["active", "monitoring", "resolved"] as const;

interface TypeInfo {
  type: string;
  label: string;
  description: string;
  threshold: number;
  minEvidenceSources: number;
}

function typeColor(t: string): string {
  return TYPE_COLORS[t as ObservationType] ?? "#a1a1aa";
}

function severityColor(s: string): string {
  return SEVERITY_COLORS[s] ?? "#a1a1aa";
}

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? "#a1a1aa";
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeLabel(t: string, types: TypeInfo[]): string {
  return types.find((x) => x.type === t)?.label ?? titleCase(t);
}

export function ObservationsView() {
  const selectObservation = useGDT((s) => s.selectObservation);
  const selectedObservationId = useGDT((s) => s.selectedObservationId);

  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);

  // Fetch all observations (limit 200) once on mount; we filter client-side so the
  // analytics sidebar always reflects the full dataset regardless of the active
  // filter selection. `types` is returned regardless of server-side filters.
  const { data, loading, error, refresh } = useAsync(
    () => fetchObservations({ limit: 200 }),
    []
  );

  const observations: ObservationRecord[] = data?.observations ?? [];
  const types: TypeInfo[] = (data?.types as TypeInfo[] | undefined) ?? [];

  // ---- Client-side filtering (type / severity / status / search) ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return observations.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (severityFilter !== "all" && o.severity !== severityFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        if (
          !o.title.toLowerCase().includes(q) &&
          !o.summary.toLowerCase().includes(q) &&
          !o.uuid.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [observations, typeFilter, severityFilter, statusFilter, search]);

  // ---- Stats strip ----
  const stats = useMemo(() => {
    const total = observations.length;
    if (total === 0) {
      return { total: 0, active: 0, avgConf: 0, avgSources: 0 };
    }
    const active = observations.filter((o) => o.status === "active").length;
    const avgConf = observations.reduce((a, o) => a + o.confidence, 0) / total;
    const totalSources = observations.reduce((a, o) => a + o.evidence.length, 0);
    const avgSources = totalSources / total;
    return { total, active, avgConf, avgSources };
  }, [observations]);

  // ---- Analytics breakdowns ----
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    observations.forEach((o) => {
      m[o.type] = (m[o.type] ?? 0) + 1;
    });
    return m;
  }, [observations]);

  const severityCounts = useMemo(() => {
    const m: Record<string, number> = {};
    observations.forEach((o) => {
      m[o.severity] = (m[o.severity] ?? 0) + 1;
    });
    return m;
  }, [observations]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    observations.forEach((o) => {
      m[o.status] = (m[o.status] ?? 0) + 1;
    });
    return m;
  }, [observations]);

  const confBins = useMemo(() => {
    // 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
    const bins = [0, 0, 0, 0, 0];
    observations.forEach((o) => {
      const idx = Math.min(4, Math.floor(o.confidence * 5));
      bins[idx]++;
    });
    return bins;
  }, [observations]);

  // ---- Run scan handler ----
  const onRunScan = async () => {
    setScanning(true);
    try {
      await triggerObservationScan();
      refresh();
    } finally {
      setScanning(false);
    }
  };

  const hasActiveFilters =
    typeFilter !== "all" ||
    severityFilter !== "all" ||
    statusFilter !== "all" ||
    search.length > 0;

  const clearFilters = () => {
    setTypeFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <div className="flex h-full w-full">
      {/* Main list column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Radar className="size-4 text-primary" />
                Observations
              </h2>
              <p className="text-[14px] text-muted-foreground mt-0.5">
                Fused evidence from multiple raster products — objective, no legal conclusions
              </p>
            </div>
            <span className="ml-auto rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {loading ? (
                "…"
              ) : (
                <>
                  <span className="tnum">{filtered.length}</span> /{" "}
                  <span className="tnum">{observations.length}</span>
                </>
              )}
            </span>
            <button
              onClick={onRunScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 h-8 text-xs text-foreground/90 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Run observation scan"
            >
              {scanning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {scanning ? "Scanning…" : "Run Scan"}
            </button>
          </div>

          {/* stat strip */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat
              label="Total Observations"
              value={loading ? "…" : stats.total}
              sub="fused detections"
            />
            <MetricStat
              label="Active"
              value={loading ? "…" : stats.active}
              sub="status: active"
              accent="#f43f5e"
            />
            <MetricStat
              label="Avg Confidence"
              value={loading ? "…" : `${(stats.avgConf * 100).toFixed(0)}%`}
              sub="across observations"
              accent="#34d399"
            />
            <MetricStat
              label="Avg Evidence Sources"
              value={loading ? "…" : stats.avgSources.toFixed(1)}
              sub="per observation"
              accent="#2dd4bf"
            />
          </div>
        </div>

        {/* filter bar */}
        <div className="border-b border-border bg-card/20 px-4 py-2.5 space-y-2">
          {/* type chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground mr-1">
              Type
            </span>
            <FilterChip
              on={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label="All"
              color="#a1a1aa"
              count={observations.length}
            />
            {types.map((t) => (
              <FilterChip
                key={t.type}
                on={typeFilter === t.type}
                onClick={() => setTypeFilter(typeFilter === t.type ? "all" : t.type)}
                label={t.label}
                color={typeColor(t.type)}
                count={typeCounts[t.type] ?? 0}
              />
            ))}
            {types.length === 0 && !loading && (
              <span className="text-[14px] text-muted-foreground italic">no types registered</span>
            )}
          </div>

          {/* severity chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground mr-1">
              Severity
            </span>
            <FilterChip
              on={severityFilter === "all"}
              onClick={() => setSeverityFilter("all")}
              label="All"
              color="#a1a1aa"
              count={observations.length}
            />
            {SEVERITY_LIST.map((sev) => (
              <FilterChip
                key={sev}
                on={severityFilter === sev}
                onClick={() =>
                  setSeverityFilter(severityFilter === sev ? "all" : sev)
                }
                label={titleCase(sev)}
                color={severityColor(sev)}
                count={severityCounts[sev] ?? 0}
              />
            ))}
          </div>

          {/* status chips + search */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground mr-1">
              Status
            </span>
            <FilterChip
              on={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label="All"
              color="#a1a1aa"
              count={observations.length}
            />
            {STATUS_LIST.map((st) => (
              <FilterChip
                key={st}
                on={statusFilter === st}
                onClick={() =>
                  setStatusFilter(statusFilter === st ? "all" : st)
                }
                label={titleCase(st)}
                color={statusColor(st)}
                count={statusCounts[st] ?? 0}
              />
            ))}
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title / summary / uuid…"
                className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                aria-label="Search observations"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* list / states */}
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3 space-y-1.5">
          {loading && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Loading observations…</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-6 text-rose-400" />
              <span className="text-xs">Failed to load observations: {error}</span>
            </div>
          )}
          {!loading && !error && observations.length === 0 && (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Radar className="size-9 opacity-30" />
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/80">
                  No observations yet
                </div>
                <div className="text-[15px] mt-1 max-w-xs">
                  Run a scan to fuse raster products into observations.
                </div>
              </div>
              <button
                onClick={onRunScan}
                disabled={scanning}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 h-8 text-xs text-foreground/90 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {scanning ? "Scanning…" : "Run Scan"}
              </button>
            </div>
          )}
          {!loading && !error && observations.length > 0 && filtered.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Eye className="size-8 opacity-30" />
              <span className="text-sm">No observations match your filters</span>
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((o) => {
              const tCol = typeColor(o.type);
              const sCol = severityColor(o.severity);
              const tLabel = typeLabel(o.type, types);
              const selected = selectedObservationId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => selectObservation(o.id)}
                  className={cn(
                    "group flex w-full items-stretch gap-3 rounded-lg border bg-card/40 px-3 py-2.5 text-left transition-all",
                    selected
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-card/60"
                  )}
                >
                  {/* severity color bar */}
                  <div
                    className="w-0.5 shrink-0 rounded-full"
                    style={{ background: sCol }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    {/* meta row */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-semibold"
                        style={{ color: tCol, background: `${tCol}1a` }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: tCol }}
                        />
                        {tLabel}
                      </span>
                      <span className="font-mono text-[14px] text-muted-foreground">
                        {o.uuid.slice(0, 8)}…
                      </span>
                      {o.mgrsTile && (
                        <span className="text-[14px] text-muted-foreground font-mono">
                          · {o.mgrsTile}
                        </span>
                      )}
                      <span className="ml-auto text-[14px] text-muted-foreground font-mono tnum">
                        {timeAgo(o.observedAt)}
                      </span>
                    </div>
                    <div className="text-[17px] font-medium leading-snug truncate">
                      {o.title}
                    </div>
                    <div className="mt-1 text-[15px] text-foreground/70 leading-snug line-clamp-2">
                      {o.summary}
                    </div>
                    {/* evidence chips row */}
                    {o.evidence.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {o.evidence.slice(0, 4).map((e, i) => (
                          <span
                            key={`${o.id}-ev-${i}`}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] font-mono tnum bg-foreground/5 text-muted-foreground border border-border"
                            title={e.description}
                          >
                            {e.productType}
                            <span className="text-foreground/60">
                              {(e.contribution * 100).toFixed(0)}%
                            </span>
                          </span>
                        ))}
                        {o.evidence.length > 4 && (
                          <span className="text-[13px] text-muted-foreground font-mono tnum">
                            +{o.evidence.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* right side */}
                  <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 w-[110px]">
                    <ConfidencePill value={o.confidence} />
                    <span className="text-[13px] text-muted-foreground font-mono tnum">
                      {fmtArea(o.areaHa)}
                    </span>
                    <span className="text-[13px] text-muted-foreground font-mono tnum">
                      {o.evidence.length} evidence
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Analytics sidebar (hidden on mobile) */}
      <div className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Radar className="size-3.5 text-primary" /> Analytics
          </h3>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-4 space-y-5">
          {/* By Type */}
          <div>
            <SectionLabel className="mb-2">By Type</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([t, count]) => {
                  const pct = observations.length
                    ? (count / observations.length) * 100
                    : 0;
                  const col = typeColor(t);
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between text-[14px] mb-0.5">
                        <span className="text-muted-foreground truncate">
                          {typeLabel(t, types)}
                        </span>
                        <span className="font-mono tnum text-foreground/80">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: col }}
                        />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(typeCounts).length === 0 && (
                <div className="text-[14px] text-muted-foreground italic">no data</div>
              )}
            </div>
          </div>

          {/* By Severity */}
          <div>
            <SectionLabel className="mb-2">By Severity</SectionLabel>
            <div className="space-y-1.5">
              {SEVERITY_LIST.map((sev) => {
                const count = severityCounts[sev] ?? 0;
                const pct = observations.length
                  ? (count / observations.length) * 100
                  : 0;
                const col = severityColor(sev);
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between text-[14px] mb-0.5">
                      <span className="text-muted-foreground capitalize">{sev}</span>
                      <span className="font-mono tnum text-foreground/80">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: col }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confidence Distribution histogram */}
          <div>
            <SectionLabel className="mb-2">Confidence Distribution</SectionLabel>
            <div className="flex items-end gap-1 h-20">
              {confBins.map((count, i) => {
                const max = Math.max(...confBins, 1);
                const h = (count / max) * 100;
                const lo = i * 20;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t bg-primary/40 hover:bg-primary/60 transition-colors"
                      style={{ height: `${h}%`, minHeight: count > 0 ? 2 : 0 }}
                      title={`${count} observations · ${lo}–${lo + 20}%`}
                    />
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {lo}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-right text-[8px] font-mono text-muted-foreground">
              % confidence
            </div>
          </div>

          {/* Evidence Fusion explainer */}
          <div className="rounded-lg border border-border bg-background/40 p-3 text-[15px] text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Layers className="size-3.5 text-primary" />
              <span className="text-foreground font-medium">Evidence Fusion</span>
            </div>
            <p>
              Each observation fuses multiple raster products. Confidence and
              uncertainty are propagated from all evidence sources. No legal
              conclusions.
            </p>
            <div className="mt-2 pt-2 border-t border-border text-[14px] italic">
              {loading
                ? "loading types…"
                : `${types.length} observation types · ${observations.length} active`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- FilterChip helper ----

function FilterChip({
  on,
  onClick,
  label,
  color,
  count,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  color: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[14px] transition-all",
        on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      style={{
        borderColor: on ? color : "var(--border)",
        background: on ? `${color}1a` : "transparent",
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
      {count != null && (
        <span className="font-mono tnum opacity-70">{count}</span>
      )}
    </button>
  );
}
