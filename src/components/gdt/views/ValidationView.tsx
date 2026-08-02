"use client";

import { useEffect, useState } from "react";
import {
  fetchObservability, recordSystemMetrics, fetchReplayHistory, seedBenchmarkDataset, runEvaluation, fetchCacheStats,
  fetchSLOs, measureSLOs, fetchDashboard, auditLineage, triggerDriftActions, fetchDriftActions,
} from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  ShieldCheck, Loader2, Zap, Activity, CheckCircle2, XCircle, AlertTriangle,
  Target, Database, Clock, Server, TrendingUp, Gauge, Link2, Zap as ZapIcon,
} from "lucide-react";

const SLO_STATUS_COLORS: Record<string, string> = {
  met: "#34d399",
  warning: "#fbbf24",
  violated: "#f43f5e",
  unknown: "#71717a",
};

export function ValidationView() {
  const [obs, setObs] = useState<any>(null);
  const [slos, setSlos] = useState<any[]>([]);
  const [engDashboard, setEngDashboard] = useState<any>(null);
  const [sciDashboard, setSciDashboard] = useState<any>(null);
  const [replays, setReplays] = useState<any[]>([]);
  const [cache, setCache] = useState<any>(null);
  const [driftActions, setDriftActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchObservability(), fetchSLOs(), fetchDashboard("engineering"),
      fetchDashboard("scientific"), fetchReplayHistory(), fetchCacheStats(), fetchDriftActions(),
    ])
      .then(([o, s, eng, sci, r, c, da]) => {
        setObs(o); setSlos(s.slos || []); setEngDashboard(eng); setSciDashboard(sci);
        setReplays(r.replays || []); setCache(c); setDriftActions(da.actions || []);
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
      if (action === "slo") await measureSLOs();
      if (action === "lineage") await auditLineage();
      if (action === "drift") await triggerDriftActions();
    } finally { setActionLoading(null); load(); }
  };

  const sc = obs?.systemCounts || {};
  const engSLOs = slos.filter((s) => s.category === "engineering");
  const sciSLOs = slos.filter((s) => s.category === "scientific");

  return (
    <div className="flex h-full w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Validation & Observability
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {sc.entities ?? 0} entities · {sc.scenes ?? 0} scenes
            </span>
            <div className="ml-auto flex gap-2 flex-wrap">
              <button onClick={() => handleAction("slo")} disabled={actionLoading === "slo"} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {actionLoading === "slo" ? <Loader2 className="size-3.5 animate-spin" /> : <Gauge className="size-3.5" />} Measure SLOs
              </button>
              <button onClick={() => handleAction("lineage")} disabled={actionLoading === "lineage"} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {actionLoading === "lineage" ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Audit Lineage
              </button>
              <button onClick={() => handleAction("drift")} disabled={actionLoading === "drift"} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {actionLoading === "drift" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />} Drift Actions
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
          {/* Engineering SLOs */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Server className="size-3" /> Engineering SLOs ({engSLOs.length})
            </SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {engSLOs.map((slo) => {
                const color = SLO_STATUS_COLORS[slo.status] ?? "#71717a";
                return (
                  <div key={slo.sloId} className="rounded-lg border border-border bg-card/40 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot color={color} pulse={slo.status === "violated"} />
                      <span className="text-[15px] font-medium truncate flex-1">{slo.name}</span>
                      <span className="text-[13px] font-mono font-semibold" style={{ color }}>{slo.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-mono text-muted-foreground">
                      <span>target: {slo.targetDisplay}</span>
                      <span style={{ color }}>current: {slo.valueDisplay}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scientific SLOs */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Target className="size-3" /> Scientific SLOs ({sciSLOs.length})
            </SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sciSLOs.map((slo) => {
                const color = SLO_STATUS_COLORS[slo.status] ?? "#71717a";
                return (
                  <div key={slo.sloId} className="rounded-lg border border-border bg-card/40 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot color={color} pulse={slo.status === "violated"} />
                      <span className="text-[15px] font-medium truncate flex-1">{slo.name}</span>
                      <span className="text-[13px] font-mono font-semibold" style={{ color }}>{slo.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-mono text-muted-foreground">
                      <span>target: {slo.targetDisplay}</span>
                      <span style={{ color }}>current: {slo.valueDisplay}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lineage completeness */}
          {sciDashboard?.lineage && (
            <div>
              <SectionLabel className="mb-2 flex items-center gap-1.5">
                <Link2 className="size-3" /> Lineage Completeness
              </SectionLabel>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold tnum" style={{ color: sciDashboard.lineage.completenessPct >= 95 ? "#34d399" : "#fbbf24" }}>
                      {sciDashboard.lineage.completenessPct.toFixed(1)}%
                    </div>
                    <div className="text-[13px] text-muted-foreground">completeness</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tnum text-foreground/80">{sciDashboard.lineage.audited}</div>
                    <div className="text-[13px] text-muted-foreground">audited</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tnum text-emerald-400">{sciDashboard.lineage.complete}</div>
                    <div className="text-[13px] text-muted-foreground">complete</div>
                  </div>
                </div>
                {sciDashboard.lineage.avgCompletenessPct > 0 && (
                  <div className="mt-2">
                    <div className="text-[13px] text-muted-foreground mb-0.5">Average completeness: {sciDashboard.lineage.avgCompletenessPct.toFixed(1)}%</div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${sciDashboard.lineage.avgCompletenessPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Uncertainty validation */}
          {sciDashboard?.uncertaintyBuckets && (
            <div>
              <SectionLabel className="mb-2 flex items-center gap-1.5">
                <Gauge className="size-3" /> Uncertainty Distribution ({sciDashboard.hypothesisCount} hypotheses)
              </SectionLabel>
              <div className="flex items-end gap-1 h-20">
                {sciDashboard.uncertaintyBuckets.map((b: any, i: number) => {
                  const max = Math.max(...sciDashboard.uncertaintyBuckets.map((x: any) => x.count), 1);
                  const h = (b.count / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-primary/40 hover:bg-primary/60 transition-colors" style={{ height: `${Math.max(2, h)}%` }} title={`${b.count} hypotheses`} />
                      <span className="text-[8px] font-mono text-muted-foreground">{b.bucket}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drift actions */}
          {driftActions.length > 0 && (
            <div>
              <SectionLabel className="mb-2 flex items-center gap-1.5">
                <AlertTriangle className="size-3" /> Drift Actions ({driftActions.length})
              </SectionLabel>
              <div className="space-y-1">
                {driftActions.map((a) => (
                  <div key={a.id} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded px-1 py-0.5 text-[13px] font-semibold", a.status === "pending" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400")}>{a.status}</span>
                      <span className="text-[14px] font-medium">{a.actionType.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className="text-[14px] text-muted-foreground mt-0.5">{a.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replay history */}
          <div>
            <SectionLabel className="mb-2">Replay History ({replays.length})</SectionLabel>
            <div className="space-y-1">
              {replays.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2.5 py-1.5 text-[14px]">
                  <StatusDot color={r.status === "success" ? "#34d399" : r.status === "partial" ? "#fbbf24" : "#f43f5e"} />
                  <span className="font-mono text-muted-foreground">{r.scope}</span>
                  <span className="text-muted-foreground">{r.stagesCompleted?.length || 0} stages</span>
                  <span className="font-mono text-muted-foreground ml-auto">{r.durationMs}ms</span>
                  <span className="text-muted-foreground">{timeAgo(r.startedAt)}</span>
                </div>
              ))}
              {replays.length === 0 && <div className="text-[14px] text-muted-foreground italic px-1">No replays yet</div>}
            </div>
          </div>

          {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}

          {/* Architecture explanation */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="size-4 text-primary" />
              <span className="text-[15px] font-semibold text-primary">VALIDATION GATES</span>
            </div>
            <p className="text-[16px] text-foreground/80 leading-relaxed">
              Engineering health (replay success, API latency, cache hits) is tracked separately from scientific validity
              (precision, recall, calibration, lineage completeness). SLOs define measurable production targets.
              Drift detection triggers operational actions (increase review sampling, reduce confidence, prioritize SAR).
              Every observation's lineage is audited for completeness from observation to satellite pixel.
              Uncertainty is validated per confidence bucket — when confidence is 80%, the system should be correct ~80% of the time.
            </p>
          </div>
        </div>
      </div>

      {/* Right: cache stats + system info */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold"><Database className="size-3.5 text-primary" /> System Info</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {cache && (
            <div>
              <SectionLabel className="mb-2">Cache</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5 text-[14px]">
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
            </div>
          )}

          {sc && (
            <div>
              <SectionLabel className="mb-2">System Counts</SectionLabel>
              <div className="space-y-0.5">
                {Object.entries(sc).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-[14px] px-1">
                    <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                    <span className="font-mono tnum">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sciDashboard?.latestEvaluation && (
            <div>
              <SectionLabel className="mb-2">Latest Evaluation</SectionLabel>
              <div className="rounded-lg border border-border bg-card/40 p-2.5 space-y-1">
                <div className="flex justify-between text-[14px]"><span className="text-muted-foreground">Precision</span><span className="font-mono">{(sciDashboard.latestEvaluation.precision * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted-foreground">Recall</span><span className="font-mono">{(sciDashboard.latestEvaluation.recall * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted-foreground">F1</span><span className="font-mono">{(sciDashboard.latestEvaluation.f1 * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted-foreground">Samples</span><span className="font-mono">{sciDashboard.latestEvaluation.sampleCount}</span></div>
              </div>
            </div>
          )}

          {obs?.timestamp && (
            <div className="rounded-lg border border-border bg-card/40 p-2 text-center">
              <div className="text-[13px] text-muted-foreground">Last updated</div>
              <div className="font-mono text-[14px]">{timeAgo(obs.timestamp)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
