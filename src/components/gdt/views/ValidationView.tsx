"use client";

import { useEffect, useState } from "react";
import { fetchObservability, recordSystemMetrics, fetchReplayHistory, seedBenchmarkDataset, runEvaluation, fetchCacheStats } from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  ShieldCheck,
  Loader2,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Target,
  Database,
  Clock,
  Server,
} from "lucide-react";

export function ValidationView() {
  const [obs, setObs] = useState<any>(null);
  const [replays, setReplays] = useState<any[]>([]);
  const [cache, setCache] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchObservability(), fetchReplayHistory(), fetchCacheStats()])
      .then(([o, r, c]) => {
        setObs(o);
        setReplays(r.replays || []);
        setCache(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === "metrics") await recordSystemMetrics();
      if (action === "seed") await seedBenchmarkDataset();
      if (action === "evaluate") await runEvaluation("ghana_validation");
    } finally { setActionLoading(null); load(); }
  };

  const sc = obs?.systemCounts || {};
  const sm = obs?.stageMetrics || {};

  return (
    <div className="flex h-full w-full">
      {/* Left: observability + replay + evaluation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Validation & Observability
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {sc.entities ?? 0} entities · {sc.scenes ?? 0} scenes · {sc.observations ?? 0} obs
            </span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => handleAction("metrics")} disabled={actionLoading === "metrics"} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {actionLoading === "metrics" ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />} Record Metrics
              </button>
              <button onClick={() => handleAction("seed")} disabled={actionLoading === "seed"} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {actionLoading === "seed" ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />} Seed Benchmark
              </button>
              <button onClick={() => handleAction("evaluate")} disabled={actionLoading === "evaluate"} className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50">
                {actionLoading === "evaluate" ? <Loader2 className="size-3.5 animate-spin" /> : <Target className="size-3.5" />} Run Evaluation
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <MetricStat label="Entities" value={sc.entities ?? 0} accent="#34d399" />
            <MetricStat label="Scenes" value={sc.scenes ?? 0} accent="#22d3ee" />
            <MetricStat label="Observations" value={sc.observations ?? 0} accent="#fb923c" />
            <MetricStat label="Hypotheses" value={sc.hypotheses ?? 0} accent="#a78bfa" />
            <MetricStat label="Evidence" value={sc.evidence ?? 0} accent="#fbbf24" />
            <MetricStat label="Missions" value={sc.missions ?? 0} accent="#f43f5e" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-4">
          {/* pipeline stage metrics */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Server className="size-3" /> Pipeline Stage Metrics
            </SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(sm).map(([stage, metrics]: [string, any]) => (
                <div key={stage} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[11px] font-semibold capitalize mb-1.5">{stage.replace(/_/g, " ")}</div>
                  {Object.entries(metrics).map(([metric, vals]: [string, any]) => (
                    <div key={metric} className="flex items-center justify-between text-[10px] py-0.5">
                      <span className="text-muted-foreground">{metric.replace(/_/g, " ")}</span>
                      <span className="font-mono tnum text-foreground/80">
                        {vals.count > 0 ? vals.avg.toFixed(1) : "—"} {vals.count > 0 ? `(${vals.count})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {Object.keys(sm).length === 0 && (
                <div className="col-span-2 rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                  No stage metrics recorded yet. Click "Record Metrics" to collect.
                </div>
              )}
            </div>
          </div>

          {/* replay history */}
          <div>
            <SectionLabel className="mb-2">Replay History ({replays.length})</SectionLabel>
            <div className="space-y-1">
              {replays.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2.5 py-1.5 text-[10px]">
                  <StatusDot color={r.status === "success" ? "#34d399" : r.status === "partial" ? "#fbbf24" : "#f43f5e"} />
                  <span className="font-mono text-muted-foreground">{r.scope}</span>
                  <span className="text-muted-foreground">{r.stagesCompleted?.length || 0} stages</span>
                  <span className="text-muted-foreground">{r.observationsCreated} obs</span>
                  <span className="text-muted-foreground">{r.hypothesesCreated} hyp</span>
                  <span className="font-mono text-muted-foreground ml-auto">{r.durationMs}ms</span>
                  <span className="text-muted-foreground">{timeAgo(r.startedAt)}</span>
                </div>
              ))}
              {replays.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[10px] text-muted-foreground">
                  No replays yet. Use POST /api/replay with a sceneId to run.
                </div>
              )}
            </div>
          </div>

          {/* recent processing runs */}
          {obs?.recentRuns && obs.recentRuns.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Recent Processing Runs</SectionLabel>
              <div className="space-y-1">
                {obs.recentRuns.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2.5 py-1.5 text-[10px]">
                    <StatusDot color={r.status === "success" ? "#34d399" : "#fbbf24"} />
                    <span className="font-mono text-muted-foreground">{r.tilesProcessed} tiles</span>
                    <span className="text-muted-foreground">{r.observationsCreated} obs</span>
                    <span className="font-mono text-muted-foreground ml-auto">{r.durationMs}ms</span>
                    <span className="text-muted-foreground">{timeAgo(r.startedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* loading */}
          {loading && (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}

          {/* validation explanation */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="size-4 text-primary" />
              <span className="text-[11px] font-semibold text-primary">PRODUCTION VALIDATION</span>
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed">
              End-to-end replay framework verifies every pipeline stage. Scientific evaluation computes
              precision, recall, F1, AUROC, and calibration against benchmark datasets. Explainability
              audits produce structured Why?/Why not? reports for regulators. Observability tracks
              every metric: scenes/hour, pixels processed, products generated, evidence objects,
              average confidence, calibration error, mission completion, and learning updates.
            </p>
          </div>
        </div>
      </div>

      {/* Right: cache stats + system info */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Database className="size-3.5 text-primary" /> System Info
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* cache stats */}
          {cache && (
            <div>
              <SectionLabel className="mb-2">Cache</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded border border-border bg-card/40 px-2 py-1">
                  <div className="text-muted-foreground">Entries</div>
                  <div className="font-mono tnum font-semibold">{cache.totalEntries}</div>
                </div>
                <div className="rounded border border-border bg-card/40 px-2 py-1">
                  <div className="text-muted-foreground">Hits</div>
                  <div className="font-mono tnum font-semibold text-emerald-400">{cache.totalHits}</div>
                </div>
                <div className="rounded border border-border bg-card/40 px-2 py-1 col-span-2">
                  <div className="text-muted-foreground">Size</div>
                  <div className="font-mono tnum">{(cache.totalSizeBytes / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              {cache.byType && cache.byType.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {cache.byType.map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between text-[9px] px-1">
                      <span className="text-muted-foreground">{t.type}</span>
                      <span className="font-mono">{t.count} ({t.hits} hits)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* system counts summary */}
          {sc && (
            <div>
              <SectionLabel className="mb-2">System Counts</SectionLabel>
              <div className="space-y-0.5">
                {Object.entries(sc).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-[10px] px-1">
                    <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                    <span className="font-mono tnum">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* timestamp */}
          {obs?.timestamp && (
            <div className="rounded-lg border border-border bg-card/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground">Last updated</div>
              <div className="font-mono text-[10px]">{timeAgo(obs.timestamp)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
