"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Network,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Users,
  Loader2,
  TrendingUp,
  Brain,
  Zap,
  RefreshCw,
  Award,
  Fingerprint,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";

const NODE_TYPE_META: Record<string, { color: string; icon: string }> = {
  citizen: { color: "#34d399", icon: "👤" },
  event: { color: "#fbbf24", icon: "📍" },
  evidence: { color: "#a78bfa", icon: "📄" },
  outcome: { color: "#22d3ee", icon: "✓" },
  sensor: { color: "#38bdf8", icon: "📡" },
  agent: { color: "#f43f5e", icon: "🤖" },
  organization: { color: "#84cc16", icon: "🏛" },
  verification: { color: "#fb923c", icon: "🔐" },
};

const EDGE_TYPE_META: Record<string, { color: string; label: string }> = {
  reported: { color: "#34d399", label: "reported" },
  witnessed: { color: "#22d3ee", label: "witnessed" },
  contradicted_by: { color: "#f43f5e", label: "contradicted" },
  verified_by: { color: "#34d399", label: "verified by" },
  vouched_for: { color: "#a78bfa", label: "vouched for" },
  contributed_evidence: { color: "#fbbf24", label: "contributed evidence" },
  produced: { color: "#fb923c", label: "produced" },
};

const TRUST_TIER_META: Record<string, { color: string; label: string }> = {
  unproven: { color: "#a1a1aa", label: "Unproven" },
  emerging: { color: "#fbbf24", label: "Emerging" },
  trusted: { color: "#34d399", label: "Trusted" },
  anchor: { color: "#22d3ee", label: "Anchor" },
};

const IDV_LEVEL_META: Record<string, { color: string; label: string }> = {
  anonymous: { color: "#a1a1aa", label: "Anonymous" },
  phone: { color: "#fbbf24", label: "Phone" },
  national: { color: "#22d3ee", label: "National ID" },
  biometric: { color: "#34d399", label: "Biometric" },
  vouched: { color: "#a78bfa", label: "Vouched" },
  anchor: { color: "#f43f5e", label: "Anchor" },
};

const SYBIL_SEVERITY_META: Record<string, { color: string; label: string }> = {
  info: { color: "#38bdf8", label: "Info" },
  warn: { color: "#fbbf24", label: "Warning" },
  critical: { color: "#fb923c", label: "Critical" },
  blocked: { color: "#f43f5e", label: "Blocked" },
};

type Tab = "overview" | "graph" | "scores" | "sybil" | "identity" | "runs";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Network },
  { id: "graph", label: "Trust Graph", icon: GitBranch },
  { id: "scores", label: "Trust Scores", icon: TrendingUp },
  { id: "sybil", label: "Sybil Detection", icon: ShieldAlert },
  { id: "identity", label: "Identity & Vouching", icon: Fingerprint },
  { id: "runs", label: "Propagation Runs", icon: Activity },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function CivicTrustView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Network className="size-4 text-primary" /> Civic Trust Graph
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[14px] font-mono text-primary">
            package: civic-trust-graph
          </span>
          <p className="text-[15px] text-muted-foreground hidden lg:block">
            Trust propagates from verified reality through the graph · Sybil resistance · Identity vouching
          </p>
          <PackageBadge />
        </div>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                  active ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent")}>
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab />}
        {tab === "graph" && <GraphTab />}
        {tab === "scores" && <ScoresTab />}
        {tab === "sybil" && <SybilTab />}
        {tab === "identity" && <IdentityTab />}
        {tab === "runs" && <RunsTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => { api("/api/civic-trust").then((d) => setPackages(d.packages)).catch(() => {}); }, []);
  if (packages.length === 0) return null;
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[14px] text-muted-foreground">
      <ShieldCheck className="size-3 text-emerald-400" />
      <span className="font-mono">v{packages[0].version}</span>
      <span>·</span>
      <span>{packages[0].provides.length} capabilities</span>
      <span>·</span>
      <span>{packages[0].subPackages.length} sub-packages</span>
    </div>
  );
}

// ===========================================================================
// TAB: OVERVIEW
// ===========================================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [propagating, setPropagating] = useState(false);

  const load = useCallback(() => {
    api("/api/civic-trust").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePropagate = async () => {
    setPropagating(true);
    try { await api("/api/civic-trust/propagate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iterations: 15 }) }); load(); }
    finally { setPropagating(false); }
  };

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Graph Nodes" value={o.graph.nodes} sub={`${o.graph.nodeTypes.length} types`} accent="#a78bfa" />
        <MetricStat label="Graph Edges" value={o.graph.edges} sub="trust relationships" accent="#22d3ee" />
        <MetricStat label="Avg Trust" value={o.trust.avgTrust.toFixed(1)} sub="/ 100" accent={o.trust.avgTrust >= 60 ? "#34d399" : "#fbbf24"} />
        <MetricStat label="Anchor Citizens" value={o.trust.anchors} sub="highest trust tier" accent="#f43f5e" />
        <MetricStat label="Flagged" value={o.sybil.flagged} sub={`${o.sybil.openFlags} open flags`} accent={o.sybil.flagged > 0 ? "#fb923c" : "#34d399"} />
        <MetricStat label="Active Vouches" value={o.vouching.activeVouches} sub={`${o.vouching.verifiedByIdentity} verified`} accent="#84cc16" />
      </div>

      {/* Node type distribution + trust tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Node Types in Trust Graph</SectionLabel>
          <div className="space-y-1.5">
            {o.graph.nodeTypes.map((nt: any) => {
              const meta = NODE_TYPE_META[nt.nodeType] ?? { color: "#a1a1aa", icon: "•" };
              return (
                <div key={nt.nodeType} className="flex items-center gap-2 text-[15px]">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1 capitalize">{nt.nodeType}</span>
                  <span className="font-mono font-semibold">{nt._count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Trust Tier Distribution</SectionLabel>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(["unproven", "emerging", "trusted", "anchor"] as const).map((tier) => {
              const count = tier === "unproven" ? o.trust.unproven : tier === "trusted" ? o.trust.trusted : tier === "anchor" ? o.trust.anchors : 0;
              const meta = TRUST_TIER_META[tier];
              return (
                <div key={tier} className="rounded-md border border-border bg-card/30 py-2">
                  <div className="text-[18px] font-bold font-mono" style={{ color: meta.color }}>{count}</div>
                  <div className="text-[13px] text-muted-foreground">{meta.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top citizens by trust */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <SectionLabel className="mb-2 flex items-center gap-1.5"><TrendingUp className="size-3" /> Top Citizens by Trust Score</SectionLabel>
        <div className="space-y-1">
          {o.topCitizens.map((c: any, i: number) => {
            const tier = TRUST_TIER_META[c.trustTier] ?? TRUST_TIER_META.unproven;
            return (
              <div key={c.citizenId} className="flex items-center gap-2 text-[15px] py-1">
                <span className="font-mono text-[18px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <span className="flex-1 font-medium">{c.handle ?? c.citizenId}</span>
                <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                <span className="font-mono text-[18px] font-bold" style={{ color: tier.color }}>{c.trust.toFixed(1)}</span>
              </div>
            );
          })}
          {o.topCitizens.length === 0 && <div className="text-[15px] text-muted-foreground">No trust scores yet — run propagation</div>}
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Network className="size-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">CIVIC TRUST GRAPH vs CIVIC SCORE</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[14px] uppercase tracking-wider text-muted-foreground mb-1">CivicScore (8.5)</div>
            <div className="text-[15px] font-medium">"Is this person usually right?"</div>
            <div className="text-[14px] text-muted-foreground mt-0.5">Prediction accuracy — historical confirmed/false reports</div>
          </div>
          <div className="rounded border border-primary/30 bg-primary/5 p-2.5">
            <div className="text-[14px] uppercase tracking-wider text-primary mb-1">TrustScore (8.6)</div>
            <div className="text-[15px] font-medium">"How connected is this person to verified reality?"</div>
            <div className="text-[14px] text-muted-foreground mt-0.5">Graph centrality — trust propagated from confirmed outcomes through witnesses to reporters</div>
          </div>
        </div>
        <p className="text-[15px] text-foreground/80 leading-relaxed">
          Trust flows backward from verified reality: a confirmed outcome seeds trust (1.0), which propagates to the event, then to the witnesses who confirmed it, then to the reporter.
          A citizen connected to many verified outcomes accumulates trust. A citizen connected to false positives loses it. Vouching and identity verification add independent trust signals.
          Sybil resistance (behavior analysis + flags) protects against gaming now that rewards exist.
        </p>
        <button onClick={handlePropagate} disabled={propagating}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50">
          {propagating ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          Run Trust Propagation
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: TRUST GRAPH (visualization)
// ===========================================================================

function GraphTab() {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/civic-trust/graph?limit=50")
      .then((d) => setGraph(d.graph))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  // Simple force-directed-ish layout: position by node type in concentric rings
  const centerX = 250, centerY = 200;
  const typeOrder = ["outcome", "event", "citizen", "agent", "sensor", "evidence", "verification", "organization"];
  const nodesByType: Record<string, any[]> = {};
  for (const n of graph.nodes) {
    if (!nodesByType[n.type]) nodesByType[n.type] = [];
    nodesByType[n.type].push(n);
  }

  const positioned = new Map<string, { x: number; y: number }>();
  typeOrder.forEach((type, ringIdx) => {
    const nodes = nodesByType[type] ?? [];
    const radius = 60 + ringIdx * 50;
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      positioned.set(n.id, { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    });
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <GitBranch className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Trust Graph</span>
        <span className="text-[15px] text-muted-foreground">— {graph.nodes.length} nodes · {graph.edges.length} edges · trust flows from verified reality inward</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {Object.entries(NODE_TYPE_META).filter(([t]) => nodesByType[t]).map(([type, meta]) => (
            <span key={type} className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: meta.color }} />
              <span className="capitalize">{type}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto gdt-scroll p-4">
        <svg viewBox="0 0 500 400" className="w-full h-full" style={{ maxHeight: "70vh" }}>
          {/* Edges */}
          {graph.edges.map((e, i) => {
            const from = positioned.get(e.source);
            const to = positioned.get(e.target);
            if (!from || !to) return null;
            const meta = EDGE_TYPE_META[e.type] ?? { color: "#71717a" };
            return (
              <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={meta.color} strokeWidth={0.5 + e.weight * 1.5} strokeOpacity={0.4 + e.weight * 0.3} />
            );
          })}
          {/* Nodes */}
          {graph.nodes.map((n) => {
            const pos = positioned.get(n.id);
            if (!pos) return null;
            const meta = NODE_TYPE_META[n.type] ?? { color: "#a1a1aa", icon: "•" };
            const r = 4 + n.trust * 8;
            return (
              <g key={n.id}>
                <circle cx={pos.x} cy={pos.y} r={r} fill={meta.color} fillOpacity={0.2 + n.trust * 0.5} stroke={meta.color} strokeWidth={1} />
                <title>{n.label} ({n.type}) trust={n.trust.toFixed(2)} in={n.inDegree} out={n.outDegree}</title>
              </g>
            );
          })}
          {/* Ring labels */}
          {typeOrder.map((type, i) => {
            if (!nodesByType[type]) return null;
            return (
              <text key={type} x={centerX + 60 + i * 50} y={centerY - 4} fontSize="7" fill="#71717a" textAnchor="middle" className="capitalize">
                {type}
              </text>
            );
          })}
        </svg>
        {/* Node list below */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          {graph.nodes.slice(0, 15).map((n) => {
            const meta = NODE_TYPE_META[n.type] ?? { color: "#a1a1aa", icon: "•" };
            return (
              <div key={n.id} className="rounded border border-border bg-card/30 px-2 py-1.5 text-[14px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="font-medium truncate flex-1">{n.label}</span>
                  <span className="font-mono text-muted-foreground">{n.type}</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                  <span>trust <span className="font-mono font-semibold" style={{ color: meta.color }}>{n.trust.toFixed(2)}</span></span>
                  <span>in {n.inDegree} · out {n.outDegree}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: TRUST SCORES (trust vs civic comparison)
// ===========================================================================

function ScoresTab() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/civic-trust/scores").then((d) => setScores(d.scores)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <TrendingUp className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Trust Scores vs Civic Scores</span>
        <span className="text-[15px] text-muted-foreground">— trust = graph connectivity to verified reality; civic = prediction accuracy</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{scores.length} citizens</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {scores.map((s, i) => {
          const tier = TRUST_TIER_META[s.trustTier] ?? TRUST_TIER_META.unproven;
          const trustDiff = s.propagatedTrust - (s.civicScore ?? 0);
          return (
            <div key={s.citizenId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[18px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[16px] font-medium truncate">{s.handle ?? s.citizenId}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                    {s.trendDelta !== null && s.trendDelta !== undefined && (
                      <span className={cn("text-[13px] flex items-center gap-0.5", s.trendDelta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        <TrendingUp className={cn("size-2.5", s.trendDelta < 0 && "rotate-180")} />
                        {s.trendDelta >= 0 ? "+" : ""}{s.trendDelta.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[13px]">
                    <div className="rounded bg-card/30 px-1.5 py-0.5">
                      <span className="text-muted-foreground">Centrality</span>
                      <span className="ml-1 font-mono font-semibold">{(s.graphCentrality * 100).toFixed(0)}%</span>
                    </div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5">
                      <span className="text-muted-foreground">Reality</span>
                      <span className="ml-1 font-mono font-semibold" style={{ color: s.realityConnection >= 0.7 ? "#34d399" : "#fbbf24" }}>{(s.realityConnection * 100).toFixed(0)}%</span>
                    </div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5">
                      <span className="text-muted-foreground">Vouching</span>
                      <span className="ml-1 font-mono font-semibold">{(s.vouchingScore * 100).toFixed(0)}%</span>
                    </div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5">
                      <span className="text-muted-foreground">Sybil Resist</span>
                      <span className="ml-1 font-mono font-semibold" style={{ color: s.sybilResistance >= 0.7 ? "#34d399" : "#fb923c" }}>{(s.sybilResistance * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                {/* Trust vs Civic comparison */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <div className="text-[13px] text-muted-foreground">Civic</div>
                    <div className="text-[18px] font-bold font-mono text-amber-400">{s.civicScore ?? "—"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[13px] text-muted-foreground">Trust</div>
                    <div className="text-[22px] font-bold font-mono" style={{ color: tier.color }}>{s.propagatedTrust.toFixed(1)}</div>
                  </div>
                  {Math.abs(trustDiff) > 5 && (
                    <div className="text-[13px] text-muted-foreground text-center" title="Trust minus Civic">
                      <div>Δ</div>
                      <div className={cn("font-mono font-semibold", trustDiff > 0 ? "text-emerald-400" : "text-rose-400")}>
                        {trustDiff > 0 ? "+" : ""}{trustDiff.toFixed(0)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: SYBIL DETECTION
// ===========================================================================

function SybilTab() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api("/api/civic-trust/sybil").then((d) => setFlags(d.flags)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try { await api("/api/civic-trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze" }) }); load(); }
    finally { setAnalyzing(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <ShieldAlert className="size-4 text-rose-400" />
        <span className="text-xs font-semibold">Sybil Resistance</span>
        <span className="text-[15px] text-muted-foreground">— anti-gaming now that rewards exist</span>
        <button onClick={handleAnalyze} disabled={analyzing}
          className="ml-auto flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[14px] text-primary hover:bg-primary/15 disabled:opacity-50">
          {analyzing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Run Analysis
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {flags.map((f) => {
          const sev = SYBIL_SEVERITY_META[f.severity] ?? SYBIL_SEVERITY_META.warn;
          return (
            <div key={f.flagId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5" style={{ borderLeftColor: sev.color, borderLeftWidth: 3 }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[14px] font-semibold text-muted-foreground">{f.flagId}</span>
                <span className="rounded px-1 py-0.5 text-[13px] font-semibold uppercase" style={{ color: sev.color, background: `${sev.color}1a` }}>{sev.label}</span>
                <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] font-mono">{f.flagType}</span>
                <span className={cn("rounded px-1 py-0.5 text-[13px] font-medium",
                  f.status === "open" ? "bg-amber-500/10 text-amber-300" : f.status === "confirmed" ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300")}>
                  {f.status}
                </span>
                <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(f.detectedAt)}</span>
              </div>
              <div className="text-[16px] mb-1">{f.description}</div>
              <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
                <span>citizen: <span className="font-mono">{f.citizenId}</span></span>
                {f.autoDetected && <span className="text-cyan-400 flex items-center gap-1"><Zap className="size-2.5" /> auto-detected</span>}
                <span>trust penalty: <span className="font-mono text-rose-400">-{(f.trustPenalty * 100).toFixed(0)}%</span></span>
                {f.detectedBy !== "sybil-engine" && <span>by {f.detectedBy}</span>}
              </div>
            </div>
          );
        })}
        {!loading && flags.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-8 opacity-30 text-emerald-400" />
            <span className="text-xs">No Sybil flags — all citizens exhibit normal behavior patterns</span>
          </div>
        )}
        {/* Detection patterns explainer */}
        <div className="rounded-lg border border-border bg-card/30 p-3 mt-2">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><ShieldAlert className="size-3" /> Detection Patterns</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[14px]">
            {[
              { type: "burst_reporting", desc: "Many reports in a single hour (≥3 warn, ≥5 critical)" },
              { type: "location_clustering", desc: "All reports from the same GPS location (≥90% clustering)" },
              { type: "low_diversity", desc: "All reports in same category + region (no spread)" },
              { type: "coordinated_witnessing", desc: "Same citizens repeatedly witnessing the same events" },
              { type: "identity_reuse", desc: "Multiple accounts from same device/identity" },
              { type: "unusual_pattern", desc: "Anomalous behavior vs. baseline" },
            ].map((p) => (
              <div key={p.type} className="rounded border border-border/60 bg-card/20 px-2 py-1">
                <span className="font-mono text-cyan-400">{p.type}</span>
                <div className="text-muted-foreground">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: IDENTITY & VOUCHING
// ===========================================================================

function IdentityTab() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [vouches, setVouches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("/api/civic-trust/identity"), api("/api/civic-trust/vouching")])
      .then(([idv, vch]) => { setIdentities(idv.identities); setVouches(vch.vouches); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-3 space-y-4">
      {/* Identity verifications */}
      <div>
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Fingerprint className="size-3" /> Identity Verification Tiers ({identities.length})</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {loading && <div className="flex h-20 items-center justify-center col-span-2"><Loader2 className="size-4 animate-spin text-primary" /></div>}
          {identities.map((idv) => {
            const level = IDV_LEVEL_META[idv.verificationLevel] ?? IDV_LEVEL_META.anonymous;
            return (
              <div key={idv.citizenId} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="size-6 rounded-md flex items-center justify-center" style={{ color: level.color, background: `${level.color}1a` }}>
                    <Fingerprint className="size-3.5" />
                  </span>
                  <span className="font-mono text-[14px] flex-1 truncate">{idv.citizenId}</span>
                  <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: level.color, background: `${level.color}1a` }}>{level.label}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] mb-1.5">
                  <span className={cn("flex items-center gap-0.5", idv.phoneVerified ? "text-emerald-400" : "text-muted-foreground/50")}>
                    {idv.phoneVerified ? <CheckCircle2 className="size-2.5" /> : "○"} Phone
                  </span>
                  <span className={cn("flex items-center gap-0.5", idv.nationalIdVerified ? "text-emerald-400" : "text-muted-foreground/50")}>
                    {idv.nationalIdVerified ? <CheckCircle2 className="size-2.5" /> : "○"} National ID
                  </span>
                  <span className={cn("flex items-center gap-0.5", idv.biometricVerified ? "text-emerald-400" : "text-muted-foreground/50")}>
                    {idv.biometricVerified ? <CheckCircle2 className="size-2.5" /> : "○"} Biometric
                  </span>
                  <span className={cn("flex items-center gap-0.5", idv.vouchVerified ? "text-emerald-400" : "text-muted-foreground/50")}>
                    {idv.vouchVerified ? <CheckCircle2 className="size-2.5" /> : "○"} Vouched
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span>vouches: <span className="font-mono">{idv.vouchCount}/{idv.vouchThreshold}</span></span>
                  <span>·</span>
                  <span>trust seed bonus: <span className="font-mono text-emerald-400">+{(idv.trustSeedBonus * 100).toFixed(0)}%</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vouching network */}
      <div>
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Link2 className="size-3" /> Vouching Network — Web of Trust ({vouches.length})</SectionLabel>
        <div className="space-y-1">
          {vouches.map((v) => (
            <div key={v.id} className="rounded-lg border border-border bg-card/40 px-3 py-2 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-[14px] truncate">{v.voucherId}</span>
                <Link2 className="size-3 text-violet-400 shrink-0" />
                <span className="font-mono text-[14px] truncate">{v.vouchedForId}</span>
              </div>
              <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[13px] text-violet-300 capitalize">{v.relationship}</span>
              <span className="text-[13px] text-muted-foreground">stake <span className="font-mono font-semibold text-violet-300">{(v.stake * 100).toFixed(0)}%</span></span>
              <span className={cn("rounded px-1 py-0.5 text-[13px]", v.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{v.status}</span>
              {v.note && <span className="text-[14px] text-muted-foreground italic hidden lg:block truncate max-w-[200px]">"{v.note}"</span>}
            </div>
          ))}
          {vouches.length === 0 && !loading && <div className="text-[15px] text-muted-foreground italic">No vouching relationships yet</div>}
        </div>
      </div>

      {/* Explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="size-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">WHY IDENTITY + VOUCHING?</span>
        </div>
        <p className="text-[15px] text-foreground/80 leading-relaxed">
          Now that rewards exist, Sybil attacks (creating fake accounts to farm bounties) become economically motivated.
          Identity verification raises the cost of creating accounts. Vouching creates a <span className="text-primary font-medium">staked web of trust</span>:
          if a vouched-for citizen turns out to be a Sybil, the voucher's trust drops too. This makes reputation expensive to forge.
          Together with behavior analysis (Sybil detection tab), this forms a multi-layered defense against gaming.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: PROPAGATION RUNS
// ===========================================================================

function RunsTab() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [propagating, setPropagating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api("/api/civic-trust/runs").then((d) => setRuns(d.runs)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePropagate = async () => {
    setPropagating(true);
    try { await api("/api/civic-trust/propagate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iterations: 15 }) }); load(); }
    finally { setPropagating(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Activity className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Propagation Runs</span>
        <span className="text-[15px] text-muted-foreground">— audit trail of trust computation</span>
        <button onClick={handlePropagate} disabled={propagating}
          className="ml-auto flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-[14px] text-primary hover:bg-primary/15 disabled:opacity-50">
          {propagating ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          Run Propagation
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {runs.map((r) => (
          <div key={r.runId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-[14px] font-semibold text-cyan-300">{r.runId}</span>
              <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[13px] font-mono text-cyan-300">{r.algorithm}</span>
              <span className="text-[14px] text-muted-foreground">{r.iterations} iterations · damping {r.dampingFactor}</span>
              <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(r.startedAt)}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 text-[13px]">
              <div className="rounded bg-card/30 px-1.5 py-1">
                <div className="text-muted-foreground">Nodes</div>
                <div className="font-mono font-semibold">{r.nodesProcessed}</div>
              </div>
              <div className="rounded bg-card/30 px-1.5 py-1">
                <div className="text-muted-foreground">Edges</div>
                <div className="font-mono font-semibold">{r.edgesProcessed}</div>
              </div>
              <div className="rounded bg-card/30 px-1.5 py-1">
                <div className="text-muted-foreground">Seeds</div>
                <div className="font-mono font-semibold">{r.seedNodeCount}</div>
              </div>
              <div className="rounded bg-card/30 px-1.5 py-1">
                <div className="text-muted-foreground">Avg Trust</div>
                <div className="font-mono font-semibold">{r.avgTrustBefore.toFixed(2)} → {r.avgTrustAfter.toFixed(2)}</div>
              </div>
              <div className="rounded bg-card/30 px-1.5 py-1">
                <div className="text-muted-foreground">Max Change</div>
                <div className="font-mono font-semibold text-amber-400">{r.maxTrustChange.toFixed(3)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[13px] text-muted-foreground">
              <span>convergence: <span className="font-mono">{r.convergenceDelta.toFixed(4)}</span></span>
              <span>citizens updated: <span className="font-mono">{r.citizensUpdated}</span></span>
              {r.durationMs && <span>duration: <span className="font-mono">{(r.durationMs / 1000).toFixed(1)}s</span></span>}
            </div>
          </div>
        ))}
        {!loading && runs.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Activity className="size-8 opacity-30" />
            <span className="text-xs">No propagation runs yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
