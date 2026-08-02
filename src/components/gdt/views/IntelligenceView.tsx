"use client";

import { useEffect, useState } from "react";
import { fetchHypotheses, fetchHypothesis, fetchDecisionTrace, fetchScenarios, generateScenario, type HypothesisRecord, type ScenarioRecord } from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar, StatusDot } from "@/components/gdt/atoms";
import { timeAgo, fmtArea } from "@/lib/gdt/format";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Loader2,
  Zap,
  Sigma,
  GitBranch,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Target,
  Clock,
  ChevronRight,
} from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  artisanal_mining: "#f43f5e",
  road_construction: "#94a3b8",
  flood_erosion: "#06b6d4",
  agricultural_expansion: "#84cc16",
  quarrying: "#fb923c",
  deforestation: "#ef4444",
  natural_clearing: "#a3e635",
  settlement_expansion: "#fbbf24",
  infrastructure_development: "#60a5fa",
};

export function IntelligenceView() {
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionTrace, setDecisionTrace] = useState<any>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  useEffect(() => {
    fetchHypotheses({ limit: 100 })
      .then((r) => { setHypotheses(r.hypotheses); setLoading(false); if (r.hypotheses.length > 0) setSelectedId(r.hypotheses[0].id); })
      .catch(() => setLoading(false));
  }, []);

  // fetch full hypothesis detail when selected
  useEffect(() => {
    if (!selectedId) { setSelectedDetail(null); return; }
    let active = true;
    Promise.resolve().then(() => { if (active) setDetailLoading(true); });
    fetchHypothesis(selectedId)
      .then((d) => { if (active) { setSelectedDetail(d); setDetailLoading(false); } })
      .catch(() => { if (active) setDetailLoading(false); });
    // also fetch decision trace
    Promise.resolve().then(() => { if (active) setTraceLoading(true); });
    fetchDecisionTrace(selectedId)
      .then((d) => { if (active) { setDecisionTrace(d); setTraceLoading(false); } })
      .catch(() => { if (active) setTraceLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  // the list item (for the left panel)
  const selectedHyp = hypotheses.find((h) => h.id === selectedId);
  // the full detail (for the right panel)
  const detail = selectedDetail;
  const observationId = selectedHyp?.observationId ?? selectedHyp?.observation?.id;

  useEffect(() => {
    if (!observationId) { setScenarios([]); return; }
    fetchScenarios(observationId).then((r) => setScenarios(r.scenarios)).catch(() => {});
  }, [observationId]);

  const handleGenerateScenario = async () => {
    if (!observationId) return;
    setScenarioLoading(true);
    try {
      await generateScenario({ observationId, forecastDays: 30 });
      const r = await fetchScenarios(observationId);
      setScenarios(r.scenarios);
    } finally { setScenarioLoading(false); }
  };

  // group hypotheses by observation
  const byObservation: Record<string, any[]> = {};
  for (const h of hypotheses) {
    const obsId = h.observationId ?? h.observation?.id ?? "unknown";
    (byObservation[obsId] ??= []).push(h);
  }

  return (
    <div className="flex h-full w-full">
      {/* Left: hypothesis list grouped by observation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Brain className="size-4 text-primary" /> Intelligence Engine
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {hypotheses.length} hypotheses · {Object.keys(byObservation).length} observations
            </span>
            <p className="text-[15px] text-muted-foreground hidden lg:block">
              Ranked competing hypotheses · Bayesian reasoning · No legal conclusions
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Hypotheses" value={hypotheses.length} accent="#a78bfa" />
            <MetricStat label="Primary" value={hypotheses.filter((h) => h.isPrimary).length} sub="top-ranked" accent="#34d399" />
            <MetricStat label="Avg confidence" value={`${hypotheses.length ? (hypotheses.filter((h: any) => h.isPrimary).reduce((a, h) => a + h.confidence, 0) / Math.max(1, hypotheses.filter((h: any) => h.isPrimary).length) * 100).toFixed(0) : 0}%`} accent="#fbbf24" />
            <MetricStat label="Rules fired" value={hypotheses.reduce((a, h) => a + (h.rulesFired?.length ?? 0), 0)} sub="deterministic" accent="#2dd4bf" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && hypotheses.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Brain className="size-8 opacity-30" />
              <span className="text-xs">No hypotheses yet. Generate from observations.</span>
            </div>
          )}
          {Object.entries(byObservation).map(([obsId, hyps]) => (
            <div key={obsId}>
              <SectionLabel className="mb-2">
                Observation {obsId.slice(0, 8)}… ({hyps.length} hypotheses)
              </SectionLabel>
              <div className="space-y-1">
                {hyps.sort((a, b) => a.rank - b.rank).map((h) => {
                  const typeColor = TYPE_COLORS[h.type] ?? "#a1a1aa";
                  const isSel = h.id === selectedId;
                  return (
                    <button
                      key={h.id}
                      onClick={() => setSelectedId(h.id)}
                      className={cn(
                        "group flex w-full items-stretch gap-3 rounded-lg border bg-card/40 px-3 py-2 text-left transition-all",
                        isSel ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30 hover:bg-card/60"
                      )}
                    >
                      <div className="w-1 shrink-0 rounded-full" style={{ background: typeColor }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[14px] text-muted-foreground">#{h.rank}</span>
                          {h.isPrimary && (
                            <span className="rounded bg-primary/15 px-1 py-0.5 text-[13px] font-semibold text-primary">PRIMARY</span>
                          )}
                          <span className="text-[16px] font-medium truncate flex-1">{h.label}</span>
                          <span className="font-mono text-[16px] font-semibold tnum" style={{ color: typeColor }}>
                            {(h.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle2 className="size-2.5 text-emerald-400" /> {h.supportingCount} support</span>
                          <span className="flex items-center gap-1"><XCircle className="size-2.5 text-rose-400" /> {h.contradictingCount} contradict</span>
                          <span className="flex items-center gap-1"><HelpCircle className="size-2.5 text-amber-400" /> {h.missingCount} missing</span>
                          <span className="flex items-center gap-1"><GitBranch className="size-2.5" /> {h.rulesFired?.length ?? 0} rules</span>
                        </div>
                        {/* confidence bar */}
                        <div className="mt-1.5 h-1 rounded-full bg-foreground/8 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${h.confidence * 100}%`, background: typeColor }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: hypothesis detail + decision trace + scenario */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Target className="size-3.5 text-primary" /> Hypothesis Analysis
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
          {!detail ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {detailLoading ? <Loader2 className="size-5 animate-spin text-primary" /> : <Brain className="size-8 opacity-30" />}
              <span className="text-xs">{detailLoading ? "Loading hypothesis…" : "Select a hypothesis to inspect"}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* hypothesis header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[14px] font-semibold" style={{ color: TYPE_COLORS[detail.type], background: `${TYPE_COLORS[detail.type]}1a` }}>
                    {detail.type.replace(/_/g, " ")}
                  </span>
                  {detail.isPrimary && <span className="rounded bg-primary/15 px-1 py-0.5 text-[13px] font-semibold text-primary">PRIMARY</span>}
                  <span className="font-mono text-[14px] text-muted-foreground">rank #{detail.rank}</span>
                </div>
                <h4 className="text-[18px] font-semibold leading-snug">{detail.label}</h4>
              </div>

              {/* Bayesian confidence */}
              <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Bayesian confidence</span>
                  <span className="font-mono tnum font-semibold" style={{ color: detail.confidence > 0.5 ? "#34d399" : "#fbbf24" }}>
                    {(detail.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <ConfidenceBar value={detail.confidence} showLabel={false} />
                <div className="flex items-center justify-between text-[14px] font-mono text-muted-foreground pt-1 border-t border-border">
                  <span>prior: {(detail.prior * 100).toFixed(0)}%</span>
                  <span>→</span>
                  <span>posterior: {(detail.posterior * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* evidence breakdown */}
              <div>
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Sigma className="size-3" /> Evidence ({detail.evidence?.length})
                </SectionLabel>
                <div className="space-y-1.5">
                  {detail.evidence?.map((e, i) => {
                    const isSupport = e.relationship === "supports";
                    return (
                      <div key={i} className={cn("rounded-md border px-2.5 py-1.5", isSupport ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5")}>
                        <div className="flex items-center gap-2">
                          {isSupport ? <CheckCircle2 className="size-3 text-emerald-400" /> : <XCircle className="size-3 text-rose-400" />}
                          <span className={cn("text-[14px] font-semibold uppercase", isSupport ? "text-emerald-400" : "text-rose-400")}>{e.relationship}</span>
                          <span className="ml-auto font-mono text-[13px] text-muted-foreground">LR={e.likelihoodRatio.toFixed(2)}</span>
                        </div>
                        <div className="text-[14px] text-muted-foreground mt-0.5">{e.description}</div>
                      </div>
                    );
                  })}
                  {detail.evidence?.length === 0 && (
                    <div className="text-[14px] text-muted-foreground italic px-1">No evidence applied</div>
                  )}
                </div>
              </div>

              {/* missing evidence */}
              {detail.missingCount > 0 && (
                <div>
                  <SectionLabel className="mb-2 flex items-center gap-1.5">
                    <HelpCircle className="size-3" /> Missing Evidence ({detail.missingCount})
                  </SectionLabel>
                  <div className="space-y-1">
                    {Array.from({ length: detail.missingCount }).map((_, i) => (
                      <div key={i} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[14px] text-amber-400/80">
                        Verification data not yet available
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* decision trace */}
              <div>
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <GitBranch className="size-3" /> Decision Trace
                </SectionLabel>
                {traceLoading ? (
                  <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin text-primary" /> Tracing reasoning chain…
                  </div>
                ) : decisionTrace ? (
                  <div className="rounded-lg border border-border bg-background/60 p-2 text-[14px] font-mono">
                    <TraceNode node={decisionTrace} depth={0} />
                  </div>
                ) : (
                  <div className="text-[14px] text-muted-foreground italic">Trace unavailable</div>
                )}
              </div>

              {/* reasoning */}
              <div>
                <SectionLabel className="mb-2">Reasoning</SectionLabel>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <pre className="text-[14px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{detail.reasoning}</pre>
                </div>
              </div>

              {/* recommended verification */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="size-3 text-primary" />
                  <span className="text-[14px] font-semibold text-primary">Recommended Verification</span>
                </div>
                <p className="text-[15px] text-foreground/80 leading-relaxed">{detail.recommendedVerification}</p>
              </div>

              {/* scenarios */}
              <div>
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Clock className="size-3" /> Predictive Scenarios ({scenarios.length})
                </SectionLabel>
                <button
                  onClick={handleGenerateScenario}
                  disabled={scenarioLoading}
                  className="mb-2 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50 w-full justify-center"
                >
                  {scenarioLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  Generate 30-day forecast
                </button>
                {scenarios.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card/40 p-3 space-y-1.5">
                    <div className="text-[16px] font-medium">{s.label}</div>
                    <div className="grid grid-cols-2 gap-1.5 text-[14px]">
                      <div className="rounded border border-border bg-background/40 px-2 py-1">
                        <div className="text-muted-foreground">Predicted area</div>
                        <div className="font-mono tnum font-semibold">{s.predictedAreaHa.toFixed(0)} ha</div>
                      </div>
                      <div className="rounded border border-border bg-background/40 px-2 py-1">
                        <div className="text-muted-foreground">Growth</div>
                        <div className="font-mono tnum font-semibold" style={{ color: s.predictedGrowthPct > 0 ? "#fb923c" : "#34d399" }}>
                          {s.predictedGrowthPct >= 0 ? "+" : ""}{s.predictedGrowthPct.toFixed(0)}%
                        </div>
                      </div>
                      <div className="rounded border border-border bg-background/40 px-2 py-1">
                        <div className="text-muted-foreground">Rivers affected</div>
                        <div className="font-mono tnum">{s.affectedRiversCount}</div>
                      </div>
                      <div className="rounded border border-border bg-background/40 px-2 py-1">
                        <div className="text-muted-foreground">Communities</div>
                        <div className="font-mono tnum">{s.affectedCommunitiesCount}</div>
                      </div>
                    </div>
                    {s.expectedSedimentIncrease != null && s.expectedSedimentIncrease > 0 && (
                      <div className="text-[14px] text-amber-400/80 flex items-center gap-1">
                        <TrendingUp className="size-2.5" /> Expected sediment increase: ~{s.expectedSedimentIncrease.toFixed(0)}%
                      </div>
                    )}
                    <div className="text-[14px] text-muted-foreground pt-1 border-t border-border">
                      conf {(s.confidence * 100).toFixed(0)}% · {s.forecastDays}d forecast
                    </div>
                  </div>
                ))}
              </div>

              {/* objectivity note */}
              <div className="rounded-lg border border-border bg-foreground/[0.02] p-3">
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  This is a ranked hypothesis produced by deterministic rules + Bayesian reasoning. No legal conclusion is asserted. Competing hypotheses are preserved — uncertainty is not prematurely collapsed into a single answer.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const colors: Record<string, string> = {
    hypothesis: "#a78bfa",
    observation: "#34d399",
    hypothesis_evidence: "#fbbf24",
    evidence_bundle: "#2dd4bf",
    phenomenon: "#fb923c",
  };
  const color = colors[node.level] ?? "#71717a";
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      <div
        className="flex items-start gap-1.5 cursor-pointer py-0.5"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <ChevronRight className={cn("size-2.5 mt-0.5 shrink-0 transition-transform", expanded && "rotate-90")} style={{ color }} />
        )}
        {!hasChildren && <span className="w-2.5 shrink-0" />}
        <span className="inline-block size-2 rounded-full shrink-0 mt-1" style={{ background: color }} />
        <span className="text-foreground/80 leading-snug">{node.label}</span>
      </div>
      {expanded && hasChildren && (
        <div className="ml-1 border-l border-border/40">
          {node.children.map((child: any, i: number) => (
            <TraceNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
