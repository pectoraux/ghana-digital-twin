"use client";

import { useEffect, useState } from "react";
import {
  fetchReviewQueue,
  populateReviewQueue,
  submitReview,
  fetchCalibration,
  generateBenchmark,
  fetchDriftAlerts,
  runDriftDetection,
  type ReviewQueueItem,
  type ReviewQueueStats,
} from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar, StatusDot } from "@/components/gdt/atoms";
import { timeAgo, obsColor, OBS_META } from "@/lib/gdt/format";
import {
  ShieldCheck,
  Loader2,
  ListChecks,
  Activity,
  Sparkles,
  Gauge,
  Bell,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  Brain,
  FlaskConical,
  BarChart3,
} from "lucide-react";

// ---- priority → color (NO blue/indigo) ----
const PRIORITY_META: Record<string, { color: string; label: string }> = {
  urgent: { color: "#f43f5e", label: "Urgent" }, // rose
  high: { color: "#fbbf24", label: "High" }, // amber
  normal: { color: "#34d399", label: "Normal" }, // emerald
  low: { color: "#71717a", label: "Low" }, // zinc
};

function priorityMeta(p: string) {
  return PRIORITY_META[p] ?? { color: "#71717a", label: p.charAt(0).toUpperCase() + p.slice(1) };
}

// ---- drift type → color ----
const DRIFT_TYPE_META: Record<string, { color: string; label: string }> = {
  distribution: { color: "#a78bfa", label: "Distribution" }, // violet
  sensor: { color: "#2dd4bf", label: "Sensor" }, // teal
  seasonal: { color: "#fb923c", label: "Seasonal" }, // orange
  concept: { color: "#f43f5e", label: "Concept" }, // rose
};

function driftTypeMeta(t: string) {
  return DRIFT_TYPE_META[t] ?? { color: "#a1a1aa", label: t.charAt(0).toUpperCase() + t.slice(1) };
}

function obsTypeLabel(t: string): string {
  return (OBS_META as any)[t]?.label ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function obsTypeColor(t: string): string {
  return (OBS_META as any)[t]?.color ?? "#a1a1aa";
}

export function GroundTruthView() {
  // ---- data state ----
  const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewQueueStats | null>(null);
  const [calibration, setCalibration] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);
  const [driftRunning, setDriftRunning] = useState(false);
  const [benchmarkGenerating, setBenchmarkGenerating] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- initial load ----
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setLoading(true); });
    Promise.all([fetchReviewQueue(), fetchCalibration(), fetchDriftAlerts()])
      .then(([rq, cal, drift]) => {
        if (!active) return;
        setReviewItems(rq.items);
        setReviewStats(rq.stats);
        setCalibration(cal.current);
        setBenchmarks(cal.benchmarks ?? []);
        setDriftAlerts(drift.alerts ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message ?? "Failed to load");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // ---- handlers ----
  const reloadReview = () => {
    fetchReviewQueue()
      .then((rq) => {
        setReviewItems(rq.items);
        setReviewStats(rq.stats);
      })
      .catch(() => {});
  };

  const reloadCalibration = () => {
    fetchCalibration()
      .then((cal) => {
        setCalibration(cal.current);
        setBenchmarks(cal.benchmarks ?? []);
      })
      .catch(() => {});
  };

  const reloadDrift = () => {
    fetchDriftAlerts()
      .then((d) => setDriftAlerts(d.alerts ?? []))
      .catch(() => {});
  };

  const handlePopulate = async () => {
    setPopulating(true);
    try {
      await populateReviewQueue(20);
      reloadReview();
    } finally {
      setPopulating(false);
    }
  };

  const handleRunDrift = async () => {
    setDriftRunning(true);
    try {
      await runDriftDetection();
      reloadDrift();
    } finally {
      setDriftRunning(false);
    }
  };

  const handleGenerateBenchmark = async () => {
    setBenchmarkGenerating(true);
    try {
      await generateBenchmark();
      reloadCalibration();
    } finally {
      setBenchmarkGenerating(false);
    }
  };

  const handleSubmit = async (reviewId: string, outcome: "confirmed" | "rejected") => {
    setSubmittingId(reviewId);
    try {
      await submitReview(reviewId, {
        outcome,
        verificationMethod: "manual_inspection",
        reviewerRole: "human_inspector",
        notes: outcome === "confirmed" ? "Manually confirmed via review queue" : "Manually rejected via review queue",
      });
      reloadReview();
      reloadCalibration();
    } finally {
      setSubmittingId(null);
    }
  };

  // ---- derived metrics ----
  const needsReview = reviewStats?.needsReview ?? 0;
  const totalGroundTruth = reviewStats?.totalGroundTruth ?? 0;
  const ece = calibration?.ece ?? 0;
  const driftCount = driftAlerts.length;

  // reliability bins (default to 5 standard bins if missing)
  const reliability: any[] = calibration?.reliability ?? [];
  const reliabilityBins = reliability.length > 0
    ? reliability
    : [
        { bin: "0-20%", meanConfidence: 0, accuracy: 0, count: 0 },
        { bin: "20-40%", meanConfidence: 0, accuracy: 0, count: 0 },
        { bin: "40-60%", meanConfidence: 0, accuracy: 0, count: 0 },
        { bin: "60-80%", meanConfidence: 0, accuracy: 0, count: 0 },
        { bin: "80-100%", meanConfidence: 0, accuracy: 0, count: 0 },
      ];

  return (
    <div className="flex h-full w-full">
      {/* ============ Main column ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Ground Truth &amp; Active Learning
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {reviewItems.length} in queue
            </span>
            <p className="text-[11px] text-muted-foreground hidden lg:block">
              Human-in-the-loop verification · confidence calibration · drift monitoring
            </p>
          </div>

          {reviewStats && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricStat
                label="Review Queue"
                value={<span className="font-mono tnum">{needsReview}</span>}
                sub="needs review"
                accent="#fbbf24"
              />
              <MetricStat
                label="Ground Truth"
                value={<span className="font-mono tnum">{totalGroundTruth}</span>}
                sub="verified"
                accent="#34d399"
              />
              <MetricStat
                label="Calibration"
                value={<span className="font-mono tnum">{(ece * 100).toFixed(1)}%</span>}
                sub="ECE"
                accent="#2dd4bf"
              />
              <MetricStat
                label="Drift Alerts"
                value={<span className="font-mono tnum">{driftCount}</span>}
                sub="active"
                accent="#f43f5e"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handlePopulate}
              disabled={populating}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {populating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Populate Queue
            </button>
            <button
              onClick={handleRunDrift}
              disabled={driftRunning}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 disabled:opacity-50"
            >
              {driftRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
              Run Drift Check
            </button>
            {error && (
              <span className="ml-auto text-[10px] text-rose-400 font-mono">{error}</span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-5">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}

          {/* ---------- Review Queue ---------- */}
          {!loading && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="size-3.5 text-amber-400" />
                <SectionLabel>Review Queue · Active Learning Selections</SectionLabel>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum">
                  {reviewItems.filter((i) => i.status === "needs_review").length} pending
                </span>
              </div>

              {reviewItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/20 p-6 text-center">
                  <p className="text-[12px] text-muted-foreground">
                    No items in the review queue. Click <span className="text-primary">Populate Queue</span> to let
                    active learning select the most informative observations.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto gdt-scroll pr-1">
                  {reviewItems.map((item) => {
                    const pm = priorityMeta(item.priority);
                    const obsColorStr = obsTypeColor(item.observation.type);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-card/40 p-3 hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* priority badge */}
                          <span
                            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: pm.color, background: `${pm.color}1a`, border: `1px solid ${pm.color}33` }}
                          >
                            <StatusDot color={pm.color} pulse={item.priority === "urgent"} />
                            {pm.label}
                          </span>

                          {/* main info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ color: obsColorStr, background: `${obsColorStr}1a` }}
                              >
                                {obsTypeLabel(item.observation.type)}
                              </span>
                              <span className="text-[12px] font-medium truncate">
                                {item.observation.title}
                              </span>
                              <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum shrink-0">
                                {timeAgo(item.createdAt)}
                              </span>
                            </div>

                            {/* confidence + uncertainty */}
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-20 shrink-0">Confidence</span>
                                <ConfidenceBar value={item.observation.confidence} size="sm" className="flex-1" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-20 shrink-0">Uncertainty</span>
                                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${item.uncertaintyScore * 100}%`,
                                      background: "#a78bfa",
                                      boxShadow: "0 0 8px #a78bfa66",
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono tnum text-muted-foreground w-9 text-right">
                                  {(item.uncertaintyScore * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>

                            {/* footer row: info gain, actions */}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                Info gain:{" "}
                                <span className="font-mono tnum text-teal-400">
                                  {(item.informationGain * 100).toFixed(1)}%
                                </span>
                              </span>
                              {item.observation.mgrsTile && (
                                <span className="text-[10px] text-muted-foreground font-mono tnum">
                                  · tile {item.observation.mgrsTile}
                                </span>
                              )}
                              {item.assignedTo && (
                                <span className="text-[10px] text-muted-foreground">
                                  · assigned to <span className="text-foreground/70">{item.assignedTo}</span>
                                </span>
                              )}

                              <div className="ml-auto flex items-center gap-1.5">
                                <button
                                  onClick={() => handleSubmit(item.id, "confirmed")}
                                  disabled={submittingId === item.id}
                                  className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
                                >
                                  {submittingId === item.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-3" />
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleSubmit(item.id, "rejected")}
                                  disabled={submittingId === item.id}
                                  className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/15 disabled:opacity-50"
                                >
                                  <XCircle className="size-3" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ---------- Calibration ---------- */}
          {!loading && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="size-3.5 text-teal-400" />
                <SectionLabel>Calibration Metrics</SectionLabel>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum">
                  n={calibration?.sampleCount ?? 0} samples
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <MetricStat
                  label="Brier"
                  value={<span className="font-mono tnum">{(calibration?.brierScore ?? 0).toFixed(3)}</span>}
                  sub="lower better"
                  accent="#fb923c"
                />
                <MetricStat
                  label="ECE"
                  value={<span className="font-mono tnum">{((calibration?.ece ?? 0) * 100).toFixed(1)}%</span>}
                  sub="calibration err"
                  accent="#2dd4bf"
                />
                <MetricStat
                  label="Precision"
                  value={<span className="font-mono tnum">{((calibration?.precision ?? 0) * 100).toFixed(0)}%</span>}
                  sub="TP/(TP+FP)"
                  accent="#34d399"
                />
                <MetricStat
                  label="Recall"
                  value={<span className="font-mono tnum">{((calibration?.recall ?? 0) * 100).toFixed(0)}%</span>}
                  sub="TP/(TP+FN)"
                  accent="#fbbf24"
                />
                <MetricStat
                  label="F1"
                  value={<span className="font-mono tnum">{((calibration?.f1 ?? 0) * 100).toFixed(0)}%</span>}
                  sub="harmonic mean"
                  accent="#a78bfa"
                />
              </div>

              {/* Reliability diagram */}
              <div className="mt-3 rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Reliability Diagram
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    confidence bins vs. empirical accuracy
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#fbbf24" }} />
                    <span className="text-[9px] text-muted-foreground">conf</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#34d399" }} />
                    <span className="text-[9px] text-muted-foreground">acc</span>
                  </span>
                </div>

                <div className="flex items-end gap-2 h-32">
                  {reliabilityBins.map((bin) => {
                    const conf = bin.meanConfidence ?? 0;
                    const acc = bin.accuracy ?? 0;
                    const count = bin.count ?? 0;
                    const maxBar = 100;
                    return (
                      <div key={bin.bin} className="flex-1 flex flex-col items-center gap-1">
                        <div className="relative w-full h-full flex items-end justify-center gap-0.5">
                          {/* perfect-calibration reference line marker */}
                          <div className="absolute inset-0 flex items-end">
                            <div className="w-full border-t border-dashed border-foreground/10" />
                          </div>
                          {/* confidence bar (gold) */}
                          <div
                            className="w-2.5 rounded-t transition-all"
                            style={{
                              height: `${(conf * maxBar)}%`,
                              background: "#fbbf24",
                              boxShadow: "0 0 6px #fbbf2466",
                              minHeight: count > 0 ? 2 : 0,
                            }}
                            title={`Mean confidence: ${(conf * 100).toFixed(0)}%`}
                          />
                          {/* accuracy bar (emerald) */}
                          <div
                            className="w-2.5 rounded-t transition-all"
                            style={{
                              height: `${(acc * maxBar)}%`,
                              background: "#34d399",
                              boxShadow: "0 0 6px #34d39966",
                              minHeight: count > 0 ? 2 : 0,
                            }}
                            title={`Empirical accuracy: ${(acc * 100).toFixed(0)}%`}
                          />
                        </div>
                        <div className="text-[9px] font-mono tnum text-muted-foreground">{bin.bin}</div>
                        <div className="text-[9px] font-mono tnum text-muted-foreground/70">n={count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-hypothesis breakdown */}
              {calibration?.perHypothesis && calibration.perHypothesis.length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-card/30 p-3">
                  <SectionLabel className="mb-2">Per-Hypothesis Precision / Recall</SectionLabel>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto gdt-scroll">
                    {calibration.perHypothesis.map((p: any) => {
                      const color = obsColor(p.type);
                      return (
                        <div key={p.type} className="flex items-center gap-2 text-[11px]">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ background: color }}
                          />
                          <span className="truncate flex-1 text-foreground/80">
                            {p.type.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono tnum text-muted-foreground w-12 text-right">
                            P {(p.precision * 100).toFixed(0)}%
                          </span>
                          <span className="font-mono tnum text-muted-foreground w-12 text-right">
                            R {(p.recall * 100).toFixed(0)}%
                          </span>
                          <span className="font-mono tnum text-muted-foreground/70 w-8 text-right">
                            n={p.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={handleGenerateBenchmark}
                  disabled={benchmarkGenerating}
                  className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-400 hover:bg-violet-500/15 disabled:opacity-50"
                >
                  {benchmarkGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
                  Generate Benchmark
                </button>
              </div>
            </section>
          )}

          {/* ---------- Drift Alerts ---------- */}
          {!loading && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Bell className="size-3.5 text-rose-400" />
                <SectionLabel>Drift Alerts</SectionLabel>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum">
                  {driftCount} active
                </span>
              </div>

              {driftAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/20 p-6 text-center">
                  <p className="text-[12px] text-muted-foreground">
                    No active drift alerts. The system&apos;s recent observations are within historical baselines.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto gdt-scroll pr-1">
                  {driftAlerts.map((a) => {
                    const tm = driftTypeMeta(a.type);
                    const mag = a.driftMagnitude ?? 0;
                    const threshold = a.threshold ?? 0;
                    const exceeds = mag > threshold;
                    return (
                      <div key={a.id} className="rounded-lg border border-border bg-card/40 p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: tm.color, background: `${tm.color}1a`, border: `1px solid ${tm.color}33` }}
                          >
                            {tm.label}
                          </span>
                          <span className="text-[11px] font-mono tnum text-muted-foreground truncate">
                            {a.metric}
                          </span>
                          <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum shrink-0">
                            {timeAgo(a.detectedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-foreground/80 leading-relaxed">
                          {a.description}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[10px]">
                          <span className="text-muted-foreground">
                            baseline:{" "}
                            <span className="font-mono tnum text-foreground/70">
                              {a.baselineValue.toFixed(2)}
                            </span>
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground">
                            current:{" "}
                            <span className="font-mono tnum text-foreground/70">
                              {a.currentValue.toFixed(2)}
                            </span>
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-muted-foreground">magnitude:</span>
                            <span
                              className="font-mono tnum font-semibold"
                              style={{ color: exceeds ? "#f43f5e" : "#fbbf24" }}
                            >
                              {mag.toFixed(0)}%
                            </span>
                            <span className="text-muted-foreground/70">/ {threshold.toFixed(0)}%</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ============ Right sidebar ============ */}
      <div className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 text-primary" />
            <h3 className="text-xs font-semibold">Benchmarks &amp; Methods</h3>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* Benchmark Reports */}
          <section>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <BarChart3 className="size-3" /> Benchmark Reports
            </SectionLabel>
            {benchmarks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/20 p-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  No benchmark reports yet. Click <span className="text-violet-400">Generate Benchmark</span> to
                  create one.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {benchmarks.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg border border-border bg-card/40 p-2.5"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold font-mono tnum">{b.period}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono tnum">
                        {timeAgo(b.createdAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="rounded bg-foreground/5 px-1.5 py-1">
                        <div className="text-muted-foreground">F1</div>
                        <div className="font-mono tnum text-emerald-400">
                          {((b.detectionAccuracy ?? 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="rounded bg-foreground/5 px-1.5 py-1">
                        <div className="text-muted-foreground">ECE</div>
                        <div className="font-mono tnum text-teal-400">
                          {((b.avgCalibrationError ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded bg-foreground/5 px-1.5 py-1">
                        <div className="text-muted-foreground">Cov</div>
                        <div className="font-mono tnum text-amber-400">
                          {(b.coveragePct ?? 0).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    {b.learningImprovement !== undefined && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                        <TrendingUp className="size-3 text-emerald-400" />
                        <span className="text-muted-foreground">learning:</span>
                        <span
                          className="font-mono tnum"
                          style={{ color: b.learningImprovement >= 0 ? "#34d399" : "#f43f5e" }}
                        >
                          {b.learningImprovement >= 0 ? "+" : ""}
                          {b.learningImprovement.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Learning explanation */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="size-4 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-400">ACTIVE LEARNING</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              Instead of reviewing random observations, the system selects samples that maximize information gain.
              Each candidate is scored by <span className="font-semibold text-foreground">uncertainty</span> (predictions
              near 50%), <span className="font-semibold text-foreground">priority</span> (high-impact mining detections),
              and <span className="font-semibold text-foreground">information gain</span> (how much confirming or
              rejecting it would reduce model uncertainty).
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="rounded bg-foreground/5 px-1.5 py-1">
                <div className="text-muted-foreground">Priority</div>
                <div className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ background: "#f43f5e" }} />
                  <span className="text-foreground/70">urgent</span>
                </div>
              </div>
              <div className="rounded bg-foreground/5 px-1.5 py-1">
                <div className="text-muted-foreground">Score</div>
                <div className="font-mono tnum text-foreground/70">priority × uncertainty</div>
              </div>
            </div>
          </div>

          {/* Calibration explanation */}
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="size-4 text-teal-400" />
              <span className="text-[11px] font-semibold text-teal-400">CALIBRATION</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              A model that says &quot;83% confident&quot; should be right ~83% of the time. Calibration measures this
              alignment between predicted confidence and observed accuracy.
            </p>
            <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>
                  <span className="text-foreground/70 font-semibold">Brier</span> — mean squared error of
                  probabilistic predictions (0 = perfect).
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-400 mt-0.5">•</span>
                <span>
                  <span className="text-foreground/70 font-semibold">ECE</span> — expected calibration error,
                  weighted gap between confidence and accuracy across bins.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>
                  <span className="text-foreground/70 font-semibold">Reliability diagram</span> — bars should align
                  with the diagonal for a well-calibrated model.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
