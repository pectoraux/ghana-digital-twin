"use client";

import { useEffect, useState } from "react";
import { fetchPhenomena, triggerTemporalMerge, type PhenomenonRecord } from "@/lib/gdt/api";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar, StatusDot } from "@/components/gdt/atoms";
import { timeAgo, fmtArea } from "@/lib/gdt/format";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Zap,
  Ruler,
  GitCommit,
  Activity,
  MapPin,
} from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  surface_disturbance: "#fb923c",
  water_body_change: "#22d3ee",
  vegetation_loss: "#f97316",
  burn_event: "#ef4444",
  moisture_stress: "#a78bfa",
};

const STATUS_COLORS: Record<string, string> = {
  emerging: "#fbbf24",
  active: "#34d399",
  growing: "#fb923c",
  stabilizing: "#2dd4bf",
  declining: "#a78bfa",
  resolved: "#71717a",
};

export function PhenomenaView() {
  const [phenomena, setPhenomena] = useState<PhenomenonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectObservation = useGDT((s) => s.selectObservation);

  const load = () => {
    setLoading(true);
    fetchPhenomena(undefined, undefined, 100)
      .then((r) => { setPhenomena(r.phenomena); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMerge = async () => {
    setMerging(true);
    try { await triggerTemporalMerge(); } finally { setMerging(false); load(); }
  };

  const selected = phenomena.find((p) => p.id === selectedId);

  const stats = {
    total: phenomena.length,
    active: phenomena.filter((p) => ["emerging", "active", "growing"].includes(p.status)).length,
    avgConf: phenomena.length ? phenomena.reduce((a, p) => a + p.confidence, 0) / phenomena.length : 0,
    avgObs: phenomena.length ? phenomena.reduce((a, p) => a + p.observationCount, 0) / phenomena.length : 0,
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: phenomenon list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Phenomena
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {phenomena.length} tracked
            </span>
            <p className="text-[11px] text-muted-foreground hidden md:block">Evolving events tracked over time — one physical event = one phenomenon</p>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {merging ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
              Run Merge
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Phenomena" value={stats.total} sub="tracked" accent="#34d399" />
            <MetricStat label="Active" value={stats.active} sub="emerging/growing" accent="#fb923c" />
            <MetricStat label="Avg confidence" value={`${(stats.avgConf * 100).toFixed(0)}%`} sub="fused" accent="#fbbf24" />
            <MetricStat label="Avg observations" value={stats.avgObs.toFixed(1)} sub="per phenomenon" accent="#2dd4bf" />
          </div>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && phenomena.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Clock className="size-8 opacity-30" />
              <span className="text-xs">No phenomena yet. Run a merge to track observations over time.</span>
            </div>
          )}
          {phenomena.map((p) => {
            const typeColor = TYPE_COLORS[p.type] ?? "#a1a1aa";
            const statusColor = STATUS_COLORS[p.status] ?? "#71717a";
            const isSel = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "group flex w-full items-stretch gap-3 rounded-lg border bg-card/40 px-3 py-2.5 text-left transition-all",
                  isSel ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30 hover:bg-card/60"
                )}
              >
                <div className="w-1 shrink-0 rounded-full" style={{ background: typeColor }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: typeColor, background: `${typeColor}1a` }}>
                      {p.type.replace(/_/g, " ")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ color: statusColor, background: `${statusColor}1a` }}>
                      <StatusDot color={statusColor} /> {p.status}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.uuid.slice(0, 8)}…</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">{timeAgo(p.lastObserved)}</span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug truncate">{p.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Ruler className="size-2.5" /> {fmtArea(p.currentAreaHa * 100)}</span>
                    <span className="flex items-center gap-1"><GitCommit className="size-2.5" /> {p.observationCount} obs</span>
                    {p.growthPct != null && (
                      <span className="flex items-center gap-1" style={{ color: p.growthPct > 5 ? "#fb923c" : p.growthPct < -5 ? "#34d399" : "#71717a" }}>
                        {p.growthPct > 5 ? <TrendingUp className="size-2.5" /> : p.growthPct < -5 ? <TrendingDown className="size-2.5" /> : <Minus className="size-2.5" />}
                        {p.growthPct >= 0 ? "+" : ""}{p.growthPct.toFixed(0)}%
                      </span>
                    )}
                    {p.durationDays > 0 && (
                      <span className="flex items-center gap-1"><Clock className="size-2.5" /> {p.durationDays.toFixed(0)}d</span>
                    )}
                    <span className="font-mono">conf {(p.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: phenomenon detail */}
      <div className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Activity className="size-3.5 text-primary" /> Phenomenon Detail
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Clock className="size-8 opacity-30" />
              <span className="text-xs">Select a phenomenon to inspect</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: TYPE_COLORS[selected.type], background: `${TYPE_COLORS[selected.type]}1a` }}>
                    {selected.type.replace(/_/g, " ")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: STATUS_COLORS[selected.status], background: `${STATUS_COLORS[selected.status]}1a` }}>
                    {selected.status}
                  </span>
                </div>
                <h4 className="text-[14px] font-semibold capitalize leading-snug">{selected.title}</h4>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="size-3" /> {selected.centroid[1].toFixed(3)}°N, {selected.centroid[0].toFixed(3)}°W · {selected.mgrsTile ?? "—"}
                </div>
              </div>

              {/* evolution metrics */}
              <div className="grid grid-cols-2 gap-2">
                <MetricStat label="Current area" value={fmtArea(selected.currentAreaHa * 100)} accent="#34d399" />
                <MetricStat label="Duration" value={`${selected.durationDays.toFixed(0)}d`} accent="#fbbf24" />
                <MetricStat label="Observations" value={selected.observationCount} accent="#2dd4bf" />
                <MetricStat label="Confidence" value={`${(selected.confidence * 100).toFixed(0)}%`} accent="#fb923c" />
              </div>

              {/* growth metrics */}
              <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
                <SectionLabel>Evolution Metrics</SectionLabel>
                {selected.growthPct != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Growth</span>
                    <span className="font-mono tnum font-semibold" style={{ color: selected.growthPct > 5 ? "#fb923c" : selected.growthPct < -5 ? "#34d399" : "#71717a" }}>
                      {selected.growthPct >= 0 ? "+" : ""}{selected.growthPct.toFixed(1)}%
                    </span>
                  </div>
                )}
                {selected.growthRateHaPerWeek != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Growth rate</span>
                    <span className="font-mono tnum">{selected.growthRateHaPerWeek >= 0 ? "+" : ""}{selected.growthRateHaPerWeek.toFixed(1)} ha/wk</span>
                  </div>
                )}
                {selected.movementKm != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Centroid movement</span>
                    <span className="font-mono tnum">{selected.movementKm.toFixed(2)} km</span>
                  </div>
                )}
                {selected.persistenceScore != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Persistence</span>
                    <span className="font-mono tnum">{(selected.persistenceScore * 100).toFixed(0)}%</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Fused confidence</span>
                    <span className="font-mono tnum">{(selected.confidence * 100).toFixed(0)}% ±{(selected.uncertainty * 100).toFixed(1)}%</span>
                  </div>
                  <ConfidenceBar value={selected.confidence} showLabel={false} />
                </div>
              </div>

              {/* observation timeline */}
              <div>
                <SectionLabel className="mb-2">Observation Timeline ({selected.observations.length})</SectionLabel>
                <div className="relative pl-4">
                  <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                  <div className="space-y-2.5">
                    {selected.observations.map((o, i) => {
                      const isLatest = i === selected.observations.length - 1;
                      return (
                        <div key={o.observationId} className="relative">
                          <span
                            className={cn("absolute -left-4 top-1 size-2.5 rounded-full border-2 border-background", isLatest ? "" : "opacity-60")}
                            style={{ background: isLatest ? TYPE_COLORS[selected.type] : "#71717a" }}
                          />
                          <button
                            onClick={() => selectObservation(o.observationId)}
                            className="block w-full text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground">#{o.sequence}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(o.observedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                              {isLatest && <span className="text-[9px] font-medium text-primary">latest</span>}
                            </div>
                            <div className="text-[11px] mt-0.5">{fmtArea(o.areaHa * 100)}</div>
                            {o.areaDeltaHa != null && (
                              <div className="text-[9px] font-mono" style={{ color: o.areaDeltaHa > 0 ? "#fb923c" : "#34d399" }}>
                                {o.areaDeltaHa >= 0 ? "+" : ""}{o.areaDeltaHa.toFixed(1)} ha ({o.areaDeltaPct?.toFixed(0)}%)
                              </div>
                            )}
                            {o.centroidShiftKm != null && o.centroidShiftKm > 0.01 && (
                              <div className="text-[9px] text-muted-foreground font-mono">shift {o.centroidShiftKm.toFixed(2)} km</div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* summary */}
              <div>
                <SectionLabel className="mb-2">Summary</SectionLabel>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{selected.summary}</p>
              </div>

              {/* objectivity note */}
              <div className="rounded-lg border border-border bg-foreground/[0.02] p-3">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Phenomena merge observations across time into evolving events. Growth, movement, and persistence are tracked. No legal conclusions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
