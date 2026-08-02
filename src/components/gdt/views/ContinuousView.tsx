"use client";

import { useEffect, useState } from "react";
import {
  fetchPipelineStatus,
  triggerContinuousPipeline,
  fetchLearnedPriors,
  triggerLearning,
  fetchFeedback,
  submitFeedback,
  type PipelineStatus,
  type LearnedPrior,
} from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Radar,
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  Grid3x3,
  Activity,
  Target,
} from "lucide-react";

export function ContinuousView() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [priors, setPriors] = useState<LearnedPrior[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [learning, setLearning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([fetchPipelineStatus(), fetchLearnedPriors(), fetchFeedback()])
      .then(([s, p, f]) => {
        setStatus(s);
        setPriors(p.priors);
        setFeedback(f.feedback);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRunPipeline = async () => {
    setRunning(true);
    try { await triggerContinuousPipeline({ tileLimit: 10 }); } finally { setRunning(false); load(); }
  };

  const handleRunLearning = async () => {
    setLearning(true);
    try { await triggerLearning(); } finally { setLearning(false); load(); }
  };

  const handleSubmitFeedback = async (hypothesisType: string, outcome: "confirmed" | "rejected") => {
    await submitFeedback({ outcome, feedbackType: "human_inspector", hypothesisType, notes: outcome === "confirmed" ? "Manually confirmed" : "Manually rejected" });
    load();
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: pipeline status + grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Radar className="size-4 text-primary" /> Continuous Pipeline
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {status ? `${status.grid.coveragePct.toFixed(0)}% coverage` : "—"}
            </span>
            <p className="text-[15px] text-muted-foreground hidden lg:block">
              Automatic nationwide processing · learns from feedback
            </p>
            <button
              onClick={handleRunPipeline}
              disabled={running}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
              Run Pipeline
            </button>
          </div>
          {status && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricStat label="Grid tiles" value={status.grid.total} sub="nationwide" accent="#34d399" />
              <MetricStat label="Processed" value={status.grid.processed} sub={`${status.grid.coveragePct.toFixed(0)}% coverage`} accent="#2dd4bf" />
              <MetricStat label="Pending" value={status.grid.pending} sub="awaiting" accent="#fbbf24" />
              <MetricStat label="Stale" value={status.grid.stale} sub="needs refresh" accent="#fb923c" />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-4">
          {/* last run */}
          {status?.lastRun && (
            <div>
              <SectionLabel className="mb-2">Last Pipeline Run</SectionLabel>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <StatusDot color={status.lastRun.status === "success" ? "#34d399" : status.lastRun.status === "partial" ? "#fbbf24" : "#f43f5e"} />
                  <span className="text-[16px] font-medium capitalize">{status.lastRun.status}</span>
                  <span className="text-[14px] text-muted-foreground font-mono ml-auto">{timeAgo(status.lastRun.startedAt)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[15px]">
                  <div><span className="text-muted-foreground">Tiles: </span><span className="font-mono tnum">{status.lastRun.tilesProcessed}/{status.lastRun.tilesTotal}</span></div>
                  <div><span className="text-muted-foreground">Duration: </span><span className="font-mono tnum">{(status.lastRun.durationMs / 1000).toFixed(1)}s</span></div>
                  <div><span className="text-muted-foreground">Observations: </span><span className="font-mono tnum">{status.lastRun.observationsCreated}</span></div>
                  <div><span className="text-muted-foreground">Hypotheses: </span><span className="font-mono tnum">{status.lastRun.hypothesesCreated}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* recent runs */}
          {status && status.recentRuns.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Recent Runs</SectionLabel>
              <div className="space-y-1">
                {status.recentRuns.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-md border border-border bg-card/30 px-2.5 py-1.5 text-[15px]">
                    <StatusDot color={r.status === "success" ? "#34d399" : r.status === "partial" ? "#fbbf24" : "#f43f5e"} />
                    <span className="font-mono text-muted-foreground">{r.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{r.tilesProcessed} tiles</span>
                    <span className="text-muted-foreground">{r.observationsCreated} obs</span>
                    <span className="ml-auto text-muted-foreground font-mono">{timeAgo(r.startedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* loading state */}
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}

          {/* pipeline description */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-primary" />
              <span className="text-[15px] font-semibold text-primary">CONTINUOUS PROCESSING</span>
            </div>
            <p className="text-[16px] text-foreground/80 leading-relaxed">
              The pipeline automatically processes new satellite imagery across all {status?.grid.total ?? 945} Ghana grid tiles.
              For each tile: finds newest scene → computes raster products → generates observations → updates hypotheses →
              merges phenomena. Tiles become "stale" after 7 days and are automatically reprocessed. The system runs itself.
            </p>
          </div>
        </div>
      </div>

      {/* Right: learning engine */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="size-3.5 text-primary" />
            <h3 className="text-xs font-semibold">Learning Engine</h3>
            <button
              onClick={handleRunLearning}
              disabled={learning}
              className="ml-auto flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[14px] text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {learning ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              Learn
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* learned priors */}
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Target className="size-3" /> Learned Priors ({priors.length})
            </SectionLabel>
            <div className="space-y-1.5">
              {priors.filter(p => p.confirmations + p.rejections > 0).map((p) => {
                const delta = p.priorDeltaPct;
                const isUp = delta > 0;
                return (
                  <div key={p.id} className="rounded-lg border border-border bg-card/40 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[15px] font-medium truncate flex-1">{p.hypothesisType.replace(/_/g, " ")}</span>
                      {isUp ? <TrendingUp className="size-3 text-emerald-400" /> : delta < 0 ? <TrendingDown className="size-3 text-rose-400" /> : null}
                      <span className="font-mono text-[14px] tnum" style={{ color: isUp ? "#34d399" : delta < 0 ? "#f43f5e" : "#71717a" }}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] font-mono text-muted-foreground">
                      <span>{(p.originalPrior * 100).toFixed(0)}% → {(p.learnedPrior * 100).toFixed(0)}%</span>
                      <span>·</span>
                      <span className="text-emerald-400">{p.confirmations}✓</span>
                      <span className="text-rose-400">{p.rejections}✗</span>
                      <span>·</span>
                      <span>acc {(p.accuracy * 100).toFixed(0)}%</span>
                    </div>
                    {/* feedback buttons */}
                    <div className="mt-1.5 flex gap-1">
                      <button
                        onClick={() => handleSubmitFeedback(p.hypothesisType, "confirmed")}
                        className="flex-1 flex items-center justify-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-[13px] text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="size-2.5" /> Confirm
                      </button>
                      <button
                        onClick={() => handleSubmitFeedback(p.hypothesisType, "rejected")}
                        className="flex-1 flex items-center justify-center gap-1 rounded border border-rose-500/20 bg-rose-500/5 px-1.5 py-0.5 text-[13px] text-rose-400 hover:bg-rose-500/10"
                      >
                        <XCircle className="size-2.5" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
              {priors.filter(p => p.confirmations + p.rejections > 0).length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[14px] text-muted-foreground">
                  No feedback yet. Submit feedback to start learning.
                </div>
              )}
            </div>
          </div>

          {/* all priors (including unlearned) */}
          <div>
            <SectionLabel className="mb-2">All Hypothesis Priors</SectionLabel>
            <div className="space-y-0.5">
              {priors.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded px-2 py-1 text-[14px] hover:bg-accent">
                  <span className="text-muted-foreground truncate flex-1">{p.hypothesisType.replace(/_/g, " ")}</span>
                  <span className="font-mono tnum text-muted-foreground">{(p.learnedPrior * 100).toFixed(0)}%</span>
                  {p.confirmations + p.rejections > 0 && (
                    <span className="font-mono text-[13px]" style={{ color: p.accuracy > 0.5 ? "#34d399" : "#fbbf24" }}>
                      {(p.accuracy * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* recent feedback */}
          {feedback.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Recent Feedback ({feedback.length})</SectionLabel>
              <div className="space-y-1">
                {feedback.slice(0, 10).map((f) => (
                  <div key={f.id} className="rounded-md border border-border bg-card/30 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      {f.outcome === "confirmed" ? <CheckCircle2 className="size-3 text-emerald-400" /> : <XCircle className="size-3 text-rose-400" />}
                      <span className="text-[14px] font-medium">{f.hypothesisType?.replace(/_/g, " ") ?? "—"}</span>
                      <span className="ml-auto text-[13px] text-muted-foreground font-mono">{timeAgo(f.createdAt)}</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground mt-0.5">{f.feedbackType} · {f.providerRole ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* learning explanation */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="size-3 text-amber-400" />
              <span className="text-[14px] font-semibold text-amber-400">CONTINUOUS LEARNING</span>
            </div>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              Every confirmed or rejected hypothesis updates Bayesian priors. The system learns which evidence patterns
              are most predictive and adjusts future reasoning. Priors converge toward observed frequencies, weighted
              by provider credibility and sample size.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
