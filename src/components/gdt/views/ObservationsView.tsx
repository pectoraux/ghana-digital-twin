"use client";

import { useMemo, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { REGIONS } from "@/lib/gdt/geo";
import {
  OBS_META,
  SEVERITY_META,
  STATUS_META,
  obsColor,
  fmtArea,
  timeAgo,
  fmtInt,
} from "@/lib/gdt/format";
import type { ObservationType, ObservationStatus } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import { SectionLabel, ConfidencePill, StatusDot, MetricStat } from "@/components/gdt/atoms";
import {
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  Eye,
  AlertOctagon,
  CheckCircle2,
  Activity,
  TrendingUp,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

type SortKey = "newest" | "confidence" | "severity" | "area";

const SEV_ORDER = { critical: 0, high: 1, moderate: 2, low: 3 } as const;

export function ObservationsView() {
  const obsFilter = useGDT((s) => s.obsFilter);
  const setObsFilter = useGDT((s) => s.setObsFilter);
  const selectObservation = useGDT((s) => s.selectObservation);
  const selectedObservationId = useGDT((s) => s.selectedObservationId);
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const filtered = useMemo(() => {
    let list = OBSERVATIONS.filter((o) => {
      if (obsFilter.regionId !== "all" && o.regionId !== obsFilter.regionId) return false;
      if (obsFilter.types.length && !obsFilter.types.includes(o.type)) return false;
      if (obsFilter.statuses.length && !obsFilter.statuses.includes(o.status)) return false;
      if (o.confidence < obsFilter.minConfidence) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !o.title.toLowerCase().includes(q) &&
          !o.id.toLowerCase().includes(q) &&
          !o.summary.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "confidence":
          return b.confidence - a.confidence;
        case "severity":
          return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
        case "area":
          return b.areaAffectedHa - a.areaAffectedHa;
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });
    return list;
  }, [obsFilter, search, sort]);

  const stats = useMemo(() => {
    const active = OBSERVATIONS.filter((o) => o.status === "active").length;
    const critical = OBSERVATIONS.filter((o) => o.severity === "critical").length;
    const resolved = OBSERVATIONS.filter((o) => o.status === "resolved").length;
    const avgConf = OBSERVATIONS.reduce((a, o) => a + o.confidence, 0) / OBSERVATIONS.length;
    return { active, critical, resolved, avgConf };
  }, []);

  const toggleType = (t: ObservationType) => {
    const has = obsFilter.types.includes(t);
    setObsFilter({ types: has ? obsFilter.types.filter((x) => x !== t) : [...obsFilter.types, t] });
  };
  const toggleStatus = (s: ObservationStatus) => {
    const has = obsFilter.statuses.includes(s);
    setObsFilter({ statuses: has ? obsFilter.statuses.filter((x) => x !== s) : [...obsFilter.statuses, s] });
  };

  return (
    <div className="flex h-full w-full">
      {/* Main list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Change Detection Feed</h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {filtered.length} / {OBSERVATIONS.length} shown
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search observations…"
                  className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs transition-colors",
                  filtersOpen || obsFilter.types.length || obsFilter.statuses.length || obsFilter.minConfidence > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5" /> Filters
                {(obsFilter.types.length || obsFilter.statuses.length) > 0 && (
                  <span className="rounded bg-primary/20 px-1 text-[9px] font-mono">
                    {obsFilter.types.length + obsFilter.statuses.length}
                  </span>
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
                  <option value="severity">Severity</option>
                  <option value="area">Area affected</option>
                </select>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Total" value={fmtInt(OBSERVATIONS.length)} sub="observations" />
            <MetricStat label="Active" value={fmtInt(stats.active)} sub="in progress" accent="#f43f5e" />
            <MetricStat label="Critical" value={fmtInt(stats.critical)} sub="high priority" accent="#fb7185" />
            <MetricStat label="Avg confidence" value={`${(stats.avgConf * 100).toFixed(0)}%`} sub="all observations" accent="#34d399" />
          </div>
        </div>

        {/* filters */}
        {filtersOpen && (
          <div className="border-b border-border bg-card/20 px-4 py-2.5 space-y-2">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Type</span>
                {(Object.keys(OBS_META) as ObservationType[]).map((t) => {
                  const on = obsFilter.types.includes(t);
                  const col = obsColor(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
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
                      {OBS_META[t].label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Status</span>
                {(Object.keys(STATUS_META) as ObservationStatus[]).map((s) => {
                  const on = obsFilter.statuses.includes(s);
                  const col = STATUS_META[s].color;
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-all",
                        on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      style={{ borderColor: on ? col : "var(--border)", background: on ? `${col}1a` : "transparent" }}
                    >
                      <StatusDot color={col} /> {STATUS_META[s].label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 min-w-[200px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Min conf {(obsFilter.minConfidence * 100).toFixed(0)}%
                </span>
                <Slider
                  value={[obsFilter.minConfidence * 100]}
                  onValueChange={(v) => setObsFilter({ minConfidence: v[0] / 100 })}
                  max={100}
                  step={5}
                  className="flex-1"
                />
              </div>
              {(obsFilter.types.length > 0 || obsFilter.statuses.length > 0 || obsFilter.minConfidence > 0) && (
                <button
                  onClick={() => setObsFilter({ types: [], statuses: [], minConfidence: 0 })}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* list */}
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3 space-y-1.5">
          {filtered.map((o) => {
            const om = OBS_META[o.type];
            const sev = SEVERITY_META[o.severity];
            const st = STATUS_META[o.status];
            const region = REGIONS.find((r) => r.id === o.regionId);
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
                {/* severity bar */}
                <div className="w-0.5 shrink-0 rounded-full" style={{ background: sev.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ color: om.color, background: `${om.color}1a` }}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: om.color }} />
                      {om.label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{o.id}</span>
                    <span className="text-[10px] text-muted-foreground">· {region?.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">{timeAgo(o.timestamp)}</span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug truncate">{o.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <StatusDot color={st.color} pulse={o.status === "active"} /> {st.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full" style={{ background: sev.color }} /> {sev.label}
                    </span>
                    <span className="font-mono tnum">{fmtArea(o.areaAffectedHa)}</span>
                    <span className="font-mono tnum">{o.modelVersion}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 w-[120px]">
                  <ConfidencePill value={o.confidence} />
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {o.affectedEntities.length} entities · {o.evidence.length} sources
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Eye className="size-8 opacity-30" />
              <span className="text-sm">No observations match your filters</span>
            </div>
          )}
        </div>
      </div>

      {/* Analytics sidebar */}
      <div className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <TrendingUp className="size-3.5 text-primary" /> Analytics
          </h3>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-4 space-y-5">
          {/* by severity */}
          <div>
            <SectionLabel className="mb-2">By Severity</SectionLabel>
            <div className="space-y-1.5">
              {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((sev) => {
                const count = OBSERVATIONS.filter((o) => o.severity === sev).length;
                const pct = (count / OBSERVATIONS.length) * 100;
                const col = SEVERITY_META[sev].color;
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-muted-foreground">{SEVERITY_META[sev].label}</span>
                      <span className="font-mono tnum text-foreground/80">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* by type */}
          <div>
            <SectionLabel className="mb-2">By Type</SectionLabel>
            <div className="space-y-1.5">
              {(Object.keys(OBS_META) as ObservationType[])
                .map((t) => ({ t, count: OBSERVATIONS.filter((o) => o.type === t).length }))
                .filter((x) => x.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(({ t, count }) => {
                  const pct = (count / OBSERVATIONS.length) * 100;
                  const col = obsColor(t);
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground truncate">{OBS_META[t].label}</span>
                        <span className="font-mono tnum text-foreground/80">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* by status */}
          <div>
            <SectionLabel className="mb-2">By Status</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STATUS_META) as ObservationStatus[]).map((s) => {
                const count = OBSERVATIONS.filter((o) => o.status === s).length;
                const col = STATUS_META[s].color;
                const Icon = s === "active" ? AlertOctagon : s === "resolved" ? CheckCircle2 : s === "monitoring" ? Activity : Eye;
                return (
                  <div key={s} className="rounded-lg border border-border bg-background/40 p-2">
                    <Icon className="size-3.5 mb-1" style={{ color: col }} />
                    <div className="text-lg font-semibold tnum" style={{ color: col }}>{count}</div>
                    <div className="text-[9px] text-muted-foreground">{STATUS_META[s].label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* confidence histogram */}
          <div>
            <SectionLabel className="mb-2">Confidence Distribution</SectionLabel>
            <div className="flex items-end gap-1 h-20">
              {[0, 0.2, 0.4, 0.6, 0.8].map((lo) => {
                const count = OBSERVATIONS.filter((o) => o.confidence >= lo && o.confidence < lo + 0.2).length;
                const max = Math.max(...[0, 0.2, 0.4, 0.6, 0.8].map((l) => OBSERVATIONS.filter((o) => o.confidence >= l && o.confidence < l + 0.2).length)) || 1;
                const h = (count / max) * 100;
                return (
                  <div key={lo} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/40 hover:bg-primary/60 transition-colors" style={{ height: `${h}%`, minHeight: 2 }} title={`${count} obs`} />
                    <span className="text-[8px] font-mono text-muted-foreground">{lo.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* by region (top 5) */}
          <div>
            <SectionLabel className="mb-2">Top Regions</SectionLabel>
            <div className="space-y-1.5">
              {REGIONS
                .map((r) => ({ r, count: OBSERVATIONS.filter((o) => o.regionId === r.id).length }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map(({ r, count }) => (
                  <div key={r.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground truncate">{r.name}</span>
                    <span className="font-mono tnum text-foreground/80">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
