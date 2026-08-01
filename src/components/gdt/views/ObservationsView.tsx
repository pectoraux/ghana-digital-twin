"use client";

import { useMemo, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { fetchChanges, triggerSyncAll, useAsync } from "@/lib/gdt/api";
import {
  ENTITY_META,
  entityColor,
  timeAgo,
  fmtInt,
} from "@/lib/gdt/format";
import type { EntityKind } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import { SectionLabel, ConfidencePill, MetricStat } from "@/components/gdt/atoms";
import {
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  Eye,
  History,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

type SortKey = "newest" | "confidence" | "version";
type SincePreset = "7d" | "30d" | "90d";

interface ChangeRecord {
  id: string;
  entityId: string;
  version: number;
  change: string;
  observedAt: string;
  confidence: number;
  source: string;
  entityName: string | null;
  entityKind: string | null;
}

const SINCE_DAYS: Record<SincePreset, number> = { "7d": 7, "30d": 30, "90d": 90 };

function sinceIso(preset: SincePreset): string {
  return new Date(Date.now() - SINCE_DAYS[preset] * 86400000).toISOString();
}

function kindLabel(kind: string): string {
  const meta = ENTITY_META[kind as keyof typeof ENTITY_META];
  if (meta) return meta.label;
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ObservationsView() {
  const selectEntity = useGDT((s) => s.selectEntity);
  const selectedEntityId = useGDT((s) => s.selectedEntityId);

  const [since, setSince] = useState<SincePreset>("30d");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [kindFilter, setKindFilter] = useState<string | "all">("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const { data, loading, error, refresh } = useAsync(
    () => fetchChanges(sinceIso(since), 200),
    [since]
  );

  const changes: ChangeRecord[] = (data?.changes as ChangeRecord[]) ?? [];

  // kind breakdown (for filter chips + analytics)
  const kindCounts = useMemo(() => {
    const m: Record<string, number> = {};
    changes.forEach((c) => {
      if (c.entityKind) m[c.entityKind] = (m[c.entityKind] ?? 0) + 1;
    });
    return m;
  }, [changes]);

  const filtered = useMemo(() => {
    let list = changes.filter((c) => {
      if (kindFilter !== "all" && c.entityKind !== kindFilter) return false;
      if (c.confidence < minConfidence) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(c.entityName ?? "").toLowerCase().includes(q) &&
          !c.entityId.toLowerCase().includes(q) &&
          !c.change.toLowerCase().includes(q) &&
          !(c.source ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "confidence":
          return b.confidence - a.confidence;
        case "version":
          return b.version - a.version;
        default:
          return new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
      }
    });
    return list;
  }, [changes, kindFilter, minConfidence, search, sort]);

  const stats = useMemo(() => {
    if (changes.length === 0) {
      return { total: 0, entities: 0, avgConf: 0, mostRecent: null as string | null };
    }
    const entitySet = new Set(changes.map((c) => c.entityId));
    const avgConf = changes.reduce((a, c) => a + c.confidence, 0) / changes.length;
    const mostRecent = changes.reduce<string | null>((latest, c) => {
      if (!latest) return c.observedAt;
      return new Date(c.observedAt) > new Date(latest) ? c.observedAt : latest;
    }, null);
    return {
      total: changes.length,
      entities: entitySet.size,
      avgConf,
      mostRecent,
    };
  }, [changes]);

  // source breakdown for analytics
  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {};
    changes.forEach((c) => {
      if (c.source) m[c.source] = (m[c.source] ?? 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [changes]);

  // confidence histogram bins
  const confBins = useMemo(() => {
    const bins = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
    changes.forEach((c) => {
      const idx = Math.min(4, Math.floor(c.confidence * 5));
      bins[idx]++;
    });
    return bins;
  }, [changes]);

  const onTriggerSync = async () => {
    setSyncing(true);
    try {
      await triggerSyncAll();
      refresh();
    } finally {
      setSyncing(false);
    }
  };

  const hasActiveFilters = kindFilter !== "all" || minConfidence > 0 || search.length > 0;
  const clearFilters = () => {
    setKindFilter("all");
    setMinConfidence(0);
    setSearch("");
  };

  return (
    <div className="flex h-full w-full">
      {/* Main list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <History className="size-4 text-primary" />
                Change Log
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Entity version history — change detection (Observations) activates in Milestone 3
              </p>
            </div>
            <span className="ml-auto rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {loading ? "…" : (
                <>
                  <span className="tnum">{filtered.length}</span> / <span className="tnum">{changes.length}</span>
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              {/* since selector */}
              <div className="flex items-center rounded-md border border-border bg-background/40 h-8 p-0.5">
                {(["7d", "30d", "90d"] as SincePreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSince(p)}
                    className={cn(
                      "px-2 h-7 rounded text-[10px] font-mono tnum transition-colors",
                      since === p
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search changes…"
                  className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs transition-colors",
                  filtersOpen || hasActiveFilters
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5" /> Filters
                {hasActiveFilters && (
                  <span className="rounded bg-primary/20 px-1 text-[9px] font-mono">•</span>
                )}
              </button>
              <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 h-8">
                <ArrowDownUp className="size-3 text-muted-foreground" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-transparent text-xs outline-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="confidence">Confidence</option>
                  <option value="version">Version</option>
                </select>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat
              label="Total Changes"
              value={loading ? "…" : fmtInt(stats.total)}
              sub={`last ${since}`}
            />
            <MetricStat
              label="Entities Changed"
              value={loading ? "…" : fmtInt(stats.entities)}
              sub="unique entities"
              accent="#2dd4bf"
            />
            <MetricStat
              label="Avg Confidence"
              value={loading ? "…" : `${(stats.avgConf * 100).toFixed(0)}%`}
              sub="across changes"
              accent="#34d399"
            />
            <MetricStat
              label="Most Recent"
              value={loading || !stats.mostRecent ? "…" : timeAgo(stats.mostRecent)}
              sub="latest version"
              accent="#fbbf24"
            />
          </div>
        </div>

        {/* filters */}
        {filtersOpen && (
          <div className="border-b border-border bg-card/20 px-4 py-2.5 space-y-2">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Kind</span>
                {Object.entries(kindCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([k, count]) => {
                    const on = kindFilter === k;
                    const col = entityColor(k as EntityKind);
                    return (
                      <button
                        key={k}
                        onClick={() => setKindFilter(on ? "all" : k)}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-all",
                          on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        style={{
                          borderColor: on ? col : "var(--border)",
                          background: on ? `${col}1a` : "transparent",
                        }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: col }} />
                        {kindLabel(k)}
                        <span className="font-mono tnum opacity-70">{count}</span>
                      </button>
                    );
                  })}
                {Object.keys(kindCounts).length === 0 && (
                  <span className="text-[10px] text-muted-foreground italic">no kinds in current window</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 min-w-[220px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Min conf {(minConfidence * 100).toFixed(0)}%
                </span>
                <Slider
                  value={[minConfidence * 100]}
                  onValueChange={(v) => setMinConfidence(v[0] / 100)}
                  max={100}
                  step={5}
                  className="flex-1"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* list / states */}
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3 space-y-1.5">
          {loading && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Loading change log…</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-6 text-rose-400" />
              <span className="text-xs">Failed to load changes: {error}</span>
            </div>
          )}
          {!loading && !error && changes.length === 0 && (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
              <History className="size-9 opacity-30" />
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/80">No entity changes yet</div>
                <div className="text-[11px] mt-1 max-w-xs">
                  Run a connector sync to populate the world model. Entity versions will appear here as
                  relationships and attributes are updated.
                </div>
              </div>
              <button
                onClick={onTriggerSync}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 h-8 text-xs text-foreground/90 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {syncing ? "Syncing…" : "Trigger sync"}
              </button>
            </div>
          )}
          {!loading && !error && changes.length > 0 && filtered.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Eye className="size-8 opacity-30" />
              <span className="text-sm">No changes match your filters</span>
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((c) => {
              const kind = c.entityKind ?? "unknown";
              const col = entityColor(kind as EntityKind);
              const kLabel = kindLabel(kind);
              const selected = selectedEntityId === c.entityId;
              return (
                <button
                  key={c.id}
                  onClick={() => selectEntity(c.entityId)}
                  className={cn(
                    "group flex w-full items-stretch gap-3 rounded-lg border bg-card/40 px-3 py-2.5 text-left transition-all",
                    selected
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-card/60"
                  )}
                >
                  {/* kind accent bar */}
                  <div className="w-0.5 shrink-0 rounded-full" style={{ background: col }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{ color: col, background: `${col}1a` }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: col }} />
                        {kLabel}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        v{c.version}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        · {c.source || "unknown"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum">
                        {timeAgo(c.observedAt)}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium leading-snug truncate">
                      {c.entityName || c.entityId}
                    </div>
                    <div className="mt-1 text-[11px] text-foreground/70 leading-snug line-clamp-2">
                      {c.change}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 w-[110px]">
                    <ConfidencePill value={c.confidence} />
                    <span className="text-[9px] text-muted-foreground font-mono truncate max-w-full">
                      {c.entityId.slice(0, 13)}…
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Analytics sidebar */}
      <div className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <History className="size-3.5 text-primary" /> Analytics
          </h3>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-4 space-y-5">
          {/* by kind */}
          <div>
            <SectionLabel className="mb-2">By Kind</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(kindCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([k, count]) => {
                  const pct = changes.length ? (count / changes.length) * 100 : 0;
                  const col = entityColor(k as EntityKind);
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground truncate">{kindLabel(k)}</span>
                        <span className="font-mono tnum text-foreground/80">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(kindCounts).length === 0 && (
                <div className="text-[10px] text-muted-foreground italic">no data</div>
              )}
            </div>
          </div>

          {/* by source */}
          <div>
            <SectionLabel className="mb-2">By Source</SectionLabel>
            <div className="space-y-1.5">
              {sourceCounts.map(([src, count]) => {
                const pct = changes.length ? (count / changes.length) * 100 : 0;
                return (
                  <div key={src}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-muted-foreground truncate font-mono">{src}</span>
                      <span className="font-mono tnum text-foreground/80">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#2dd4bf" }} />
                    </div>
                  </div>
                );
              })}
              {sourceCounts.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic">no data</div>
              )}
            </div>
          </div>

          {/* confidence histogram */}
          <div>
            <SectionLabel className="mb-2">Confidence Distribution</SectionLabel>
            <div className="flex items-end gap-1 h-20">
              {confBins.map((count, i) => {
                const max = Math.max(...confBins, 1);
                const h = (count / max) * 100;
                const lo = i * 20;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/40 hover:bg-primary/60 transition-colors"
                      style={{ height: `${h}%`, minHeight: count > 0 ? 2 : 0 }}
                      title={`${count} changes`}
                    />
                    <span className="text-[8px] font-mono text-muted-foreground">{lo}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* summary card */}
          <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <div className="flex items-center justify-between mb-1">
              <span className="text-foreground font-medium">Window</span>
              <span className="font-mono tnum">{since}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Changes</span>
              <span className="font-mono tnum text-foreground">{changes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Entities</span>
              <span className="font-mono tnum text-foreground">{stats.entities}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-border text-[10px] italic">
              Change detection (automated observations) activates in Milestone 3.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
