"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  RadioTower,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  FileSearch,
  GitBranch,
  Gavel,
  Users,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  Zap,
  ShieldCheck,
  Scale,
  FileText,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Brain,
  RefreshCw,
  Satellite,
} from "lucide-react";

// ---- Command Center domain formatting ----

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  illegal_mining: { label: "Illegal Mining", color: "#f43f5e", icon: "⛏" },
  flood_risk: { label: "Flood Risk", color: "#38bdf8", icon: "🌊" },
  deforestation: { label: "Deforestation", color: "#84cc16", icon: "🌲" },
  cocoa_disease: { label: "Cocoa Disease", color: "#fbbf24", icon: "🍫" },
  water_pollution: { label: "Water Pollution", color: "#22d3ee", icon: "💧" },
  land_degradation: { label: "Land Degradation", color: "#a78bfa", icon: "🏜" },
};

const SEVERITY_META: Record<string, { color: string; bg: string }> = {
  low: { color: "#34d399", bg: "#34d3991a" },
  moderate: { color: "#fbbf24", bg: "#fbbf241a" },
  high: { color: "#fb923c", bg: "#fb923c1a" },
  critical: { color: "#f43f5e", bg: "#f43f5e1a" },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  detected: { color: "#f43f5e", label: "Detected" },
  reviewed: { color: "#fb923c", label: "Reviewed" },
  assigned: { color: "#fbbf24", label: "Assigned" },
  investigated: { color: "#a78bfa", label: "Investigated" },
  resolved: { color: "#34d399", label: "Resolved" },
  closed: { color: "#64748b", label: "Closed" },
  learned: { color: "#22d3ee", label: "Learned" },
};

const LIFECYCLE = ["detected", "reviewed", "assigned", "investigated", "resolved", "closed", "learned"];

const RISK_META: Record<string, { color: string; label: string }> = {
  low: { color: "#34d399", label: "Low" },
  medium: { color: "#fbbf24", label: "Medium" },
  high: { color: "#fb923c", label: "High" },
  critical: { color: "#f43f5e", label: "Critical" },
};

type Tab = "overview" | "situation" | "incidents" | "investigation" | "workflows" | "decisions" | "roles";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "National Overview", icon: LayoutDashboard },
  { id: "situation", label: "Situation Room", icon: Activity },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "investigation", label: "Investigation", icon: FileSearch },
  { id: "workflows", label: "Workflows", icon: GitBranch },
  { id: "decisions", label: "Decisions", icon: Gavel },
  { id: "roles", label: "Institutional Roles", icon: Users },
];

// ---- API helpers ----

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function CommandCenterView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <RadioTower className="size-4 text-primary" /> National Intelligence Command Center
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: national-command-center
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Intelligence → Assessment → Decision → Workflow → Action → Outcome → Learning
          </p>
          <PackageBadge />
        </div>
        {/* Tab bar */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab />}
        {tab === "situation" && <SituationTab />}
        {tab === "incidents" && <IncidentsTab />}
        {tab === "investigation" && <InvestigationTab />}
        {tab === "workflows" && <WorkflowsTab />}
        {tab === "decisions" && <DecisionsTab />}
        {tab === "roles" && <RolesTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [pkg, setPkg] = useState<any>(null);
  useEffect(() => {
    api("/api/command-center").then((d) => setPkg(d.package)).catch(() => {});
  }, []);
  if (!pkg) return null;
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
      <ShieldCheck className="size-3 text-emerald-400" />
      <span className="font-mono">v{pkg.version}</span>
      <span>·</span>
      <span>{pkg.provides?.length ?? 0} provides</span>
      <span>·</span>
      <span>{pkg.requires?.length ?? 0} requires</span>
      <span>·</span>
      <span>{pkg.subPackages?.length ?? 0} sub-packages</span>
    </div>
  );
}

// ===========================================================================
// TAB: NATIONAL OVERVIEW
// ===========================================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api("/api/command-center")
      .then((d) => setData(d.overview))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api("/api/command-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) });
      load();
    } finally { setSeeding(false); }
  };

  if (loading || !data) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  }

  const inc = data.incidents;
  const ops = data.operations;
  const risk = RISK_META[data.environmentRisk] ?? RISK_META.low;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Active Incidents" value={inc.active} sub={`${inc.total} total`} accent="#f43f5e" />
        <MetricStat label="High Confidence" value={inc.highConfidence} sub="≥85% fused" accent="#fb923c" />
        <MetricStat label="Decisions" value={ops.decisions} sub="human-in-loop" accent="#a78bfa" />
        <MetricStat label="Actions" value={ops.actions} sub={`${ops.actionsCompleted} completed`} accent="#22d3ee" />
        <MetricStat label="Outcomes" value={ops.outcomes} sub={`${ops.confirmed} confirmed`} accent="#34d399" />
        <MetricStat
          label="Assessment Accuracy"
          value={ops.accuracy !== null ? `${(ops.accuracy * 100).toFixed(0)}%` : "—"}
          sub={ops.falsePositives > 0 ? `${ops.falsePositives} false positives` : "no FP yet"}
          accent={ops.accuracy !== null && ops.accuracy >= 0.8 ? "#34d399" : "#fbbf24"}
        />
      </div>

      {/* Environmental risk + by severity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">National Environmental Risk</SectionLabel>
          <div className="flex items-center gap-3">
            <div className={cn("size-14 rounded-full flex items-center justify-center text-2xl font-bold")} style={{ color: risk.color, background: `${risk.color}1a`, border: `2px solid ${risk.color}55` }}>
              {data.environmentRisk === "critical" ? "●●" : data.environmentRisk === "high" ? "●" : "○"}
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: risk.color }}>{risk.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {inc.bySeverity.critical ?? 0} critical · {inc.bySeverity.high ?? 0} high active
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Active by Type</SectionLabel>
          <div className="space-y-1.5">
            {Object.entries(inc.byType).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]: any) => {
              const meta = TYPE_META[type] ?? { label: type, color: "#a1a1aa" };
              return (
                <div key={type} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1 truncate">{meta.label}</span>
                  <span className="font-mono font-semibold">{count}</span>
                  <div className="h-1.5 w-16 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / inc.active) * 100}%`, background: meta.color }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(inc.byType).length === 0 && <div className="text-[11px] text-muted-foreground">No active incidents</div>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">By Lifecycle Stage</SectionLabel>
          <div className="flex items-center gap-1">
            {LIFECYCLE.map((s) => {
              const count = inc.byStatus[s] ?? 0;
              const meta = STATUS_META[s] ?? { color: "#a1a1aa" };
              return (
                <div key={s} className="flex-1 text-center" title={`${STATUS_META[s]?.label ?? s}: ${count}`}>
                  <div className="text-[10px] text-muted-foreground mb-1">{STATUS_META[s]?.label ?? s}</div>
                  <div className="rounded-md py-1 text-[11px] font-mono font-semibold" style={{ color: meta.color, background: `${meta.color}14` }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Regions + recent events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Active Incidents by Region</SectionLabel>
          <div className="space-y-1.5">
            {Object.entries(inc.byRegion).sort((a: any, b: any) => b[1] - a[1]).map(([region, count]: any) => (
              <div key={region} className="flex items-center gap-2 text-[11px]">
                <MapPin className="size-3 text-muted-foreground" />
                <span className="flex-1 font-mono uppercase">{region}</span>
                <div className="h-2 w-32 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, (count / Math.max(...Object.values(inc.byRegion) as number[])) * 100)}%` }} />
                </div>
                <span className="font-mono font-semibold w-6 text-right">{count}</span>
              </div>
            ))}
            {Object.keys(inc.byRegion).length === 0 && <div className="text-[11px] text-muted-foreground">No active incidents</div>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Activity className="size-3" /> Live Situation Feed</SectionLabel>
          <div className="space-y-1 max-h-56 overflow-y-auto gdt-scroll">
            {data.recentEvents.map((e: any) => {
              const color = e.severity === "crit" ? "#f43f5e" : e.severity === "warn" ? "#fb923c" : "#34d399";
              return (
                <div key={e.eventId} className="flex items-start gap-2 text-[11px] py-1 border-b border-border/40 last:border-0">
                  <StatusDot color={color} pulse={e.severity === "crit"} />
                  <span className="font-mono text-muted-foreground w-12 shrink-0">{new Date(e.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{e.detail}</div>
                  </div>
                </div>
              );
            })}
            {data.recentEvents.length === 0 && <div className="text-[11px] text-muted-foreground">No recent events</div>}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <RadioTower className="size-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary">INTELLIGENCE → OPERATIONS PIPELINE</span>
          <span className="text-[10px] text-muted-foreground ml-auto">The loop that turns intelligence into outcomes</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {["Agents", "Assessment", "Incident", "Workflow", "Decision", "Action", "Outcome", "Learning"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-1 shrink-0">
              <span className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium border",
                i < 2 ? "bg-violet-500/10 border-violet-500/20 text-violet-300" :
                i < 4 ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              )}>{step}</span>
              {i < arr.length - 1 && <ArrowRight className="size-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">↺ feeds back</span>
        </div>
        <p className="text-[11px] text-foreground/70 mt-2 leading-relaxed">
          The Command Center is a <span className="text-primary font-medium">package</span>, not a kernel feature. It consumes intelligence
          (observations, hypotheses, agent reasoning, arbitration) and produces operational state. Every step — from satellite pixel to
          field action to learning feedback — is an immutable artifact with full provenance. This is what governments buy: fewer incidents,
          faster response, defensible decisions, audit trails.
        </p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
        >
          {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Re-seed Demo Data
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: SITUATION ROOM
// ===========================================================================

function SituationTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api("/api/command-center/situation?limit=80")
      .then((d) => setEvents(d.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold"><Activity className="size-3.5 text-emerald-400" /> LIVE</span>
        <span className="text-[11px] text-muted-foreground">Real-time operational event stream · auto-refresh 15s</span>
        <button onClick={load} className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1">
        {loading && events.length === 0 && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {events.map((e) => {
          const color = e.severity === "crit" ? "#f43f5e" : e.severity === "warn" ? "#fb923c" : "#34d399";
          const meta = EVENT_KIND_META[e.kind] ?? { icon: Activity, label: e.kind };
          const Icon = meta.icon;
          return (
            <div key={e.eventId} className="flex items-start gap-3 rounded-lg border border-border bg-card/30 px-3 py-2 hover:bg-card/50 transition-colors">
              <div className="shrink-0 mt-0.5">
                <StatusDot color={color} pulse={e.severity === "crit"} />
              </div>
              <Icon className="size-3.5 shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium truncate flex-1">{e.title}</span>
                  <span className="font-mono text-[9px] text-muted-foreground shrink-0">{new Date(e.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{e.detail}</div>
                <div className="flex items-center gap-2 mt-1">
                  {e.regionId && <span className="text-[9px] font-mono uppercase text-muted-foreground">{e.regionId}</span>}
                  {e.incidentId && <span className="text-[9px] font-mono text-primary/70">{e.incidentId}</span>}
                  {e.artifactHash && <span className="text-[9px] font-mono text-muted-foreground/70">{e.artifactHash}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Activity className="size-8 opacity-30" />
            <span className="text-xs">No situation events yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

const EVENT_KIND_META: Record<string, { icon: React.ElementType; label: string }> = {
  incident_opened: { icon: AlertTriangle, label: "Incident Opened" },
  incident_transition: { icon: GitBranch, label: "Lifecycle Transition" },
  incident_assigned: { icon: Users, label: "Assigned" },
  incident_resolved: { icon: CheckCircle2, label: "Resolved" },
  workflow_started: { icon: GitBranch, label: "Workflow Started" },
  workflow_completed: { icon: CheckCircle2, label: "Workflow Completed" },
  decision_made: { icon: Gavel, label: "Decision" },
  action_dispatched: { icon: Zap, label: "Action Dispatched" },
  action_completed: { icon: CheckCircle2, label: "Action Completed" },
  outcome_reported: { icon: Brain, label: "Outcome → Learning" },
  mining_anomaly: { icon: AlertTriangle, label: "Mining Anomaly" },
  flood_risk: { icon: AlertTriangle, label: "Flood Risk" },
  arbitration: { icon: Scale, label: "Arbitration" },
  alert_declared: { icon: AlertCircle, label: "Alert Declared" },
};

// ===========================================================================
// TAB: INCIDENTS
// ===========================================================================

function IncidentsTab() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string; severity?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (filter.status) sp.set("status", filter.status);
    if (filter.severity) sp.set("severity", filter.severity);
    api(`/api/command-center/incidents?${sp}&limit=100`)
      .then((d) => setIncidents(d.incidents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (incidentId: string, status: string) => {
    setBusy(incidentId);
    try {
      await api(`/api/command-center/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor: "ui-operator", note: `Advanced to ${status} via Command Center UI` }),
      });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold">{incidents.length} incidents</span>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] text-muted-foreground">Status:</span>
          {["", "detected", "reviewed", "assigned", "investigated", "resolved", "closed", "learned"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setFilter((f) => ({ ...f, status: s || undefined }))}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                (filter.status ?? "") === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {s || "all"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] text-muted-foreground">Severity:</span>
          {["", "low", "moderate", "high", "critical"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setFilter((f) => ({ ...f, severity: s || undefined }))}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                (filter.severity ?? "") === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {s || "all"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {incidents.map((inc) => {
          const tmeta = TYPE_META[inc.type] ?? { label: inc.type, color: "#a1a1aa" };
          const smeta = SEVERITY_META[inc.severity] ?? SEVERITY_META.moderate;
          const stmeta = STATUS_META[inc.status] ?? { color: "#a1a1aa", label: inc.status };
          const stageIdx = LIFECYCLE.indexOf(inc.status);
          return (
            <div key={inc.incidentId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: tmeta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{inc.incidentId}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>
                      {tmeta.icon} {tmeta.label}
                    </span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase" style={{ color: smeta.color, background: smeta.bg }}>
                      {inc.severity}
                    </span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ color: stmeta.color, background: `${stmeta.color}14` }}>
                      {stmeta.label}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Clock className="size-2.5" /> {timeAgo(inc.detectedAt)}
                    </span>
                  </div>
                  <div className="text-[12px] font-medium mb-1">{inc.title}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{inc.summary}</p>

                  {/* Lifecycle progress */}
                  <div className="flex items-center gap-0.5 mb-1.5">
                    {LIFECYCLE.map((s, i) => {
                      const done = i <= stageIdx;
                      const current = i === stageIdx;
                      const meta = STATUS_META[s] ?? { color: "#a1a1aa" };
                      return (
                        <div key={s} className="flex items-center gap-0.5 flex-1">
                          <div
                            className={cn("h-1.5 flex-1 rounded-full transition-all", current && "h-2")}
                            style={{ background: done ? meta.color : "#ffffff14" }}
                            title={STATUS_META[s]?.label ?? s}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {inc.regionId ?? "—"}</span>
                    <span className="flex items-center gap-1">conf <span className="font-mono font-semibold" style={{ color: tmeta.color }}>{(inc.confidence * 100).toFixed(0)}%</span></span>
                    {inc.areaAffectedHa && <span>{inc.areaAffectedHa.toFixed(1)} ha</span>}
                    {inc.agentsInvolved.length > 0 && <span className="flex items-center gap-1"><Brain className="size-2.5" /> {inc.agentsInvolved.join(", ")}</span>}
                    {inc.assignedTo.length > 0 && <span className="flex items-center gap-1"><Users className="size-2.5" /> {inc.assignedTo.join(", ")}</span>}
                    {inc.outcome && <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="size-2.5" /> {inc.outcome}</span>}
                  </div>

                  {/* Advance button */}
                  {stageIdx >= 0 && stageIdx < LIFECYCLE.length - 1 && inc.status !== "learned" && (
                    <button
                      onClick={() => handleTransition(inc.incidentId, LIFECYCLE[stageIdx + 1])}
                      disabled={busy === inc.incidentId}
                      className="mt-2 flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {busy === inc.incidentId ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                      Advance to {STATUS_META[LIFECYCLE[stageIdx + 1]]?.label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && incidents.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-8 opacity-30" />
            <span className="text-xs">No incidents match this filter</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INVESTIGATION WORKSPACE (Evidence Room)
// ===========================================================================

function InvestigationTab() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/command-center/incidents?limit=100")
      .then((d) => {
        setIncidents(d.incidents);
        if (d.incidents.length > 0 && !selected) setSelected(d.incidents[0].incidentId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="h-full flex">
      {/* Incident picker */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <SectionLabel>Investigation Cases</SectionLabel>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-2 space-y-1">
          {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-4 animate-spin text-primary" /></div>}
          {incidents.map((inc) => {
            const tmeta = TYPE_META[inc.type] ?? { label: inc.type, color: "#a1a1aa" };
            const active = selected === inc.incidentId;
            return (
              <button
                key={inc.incidentId}
                onClick={() => setSelected(inc.incidentId)}
                className={cn(
                  "w-full text-left rounded-md border px-2 py-1.5 transition-all",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-card/30 hover:bg-card/50"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="size-1.5 rounded-full" style={{ background: tmeta.color }} />
                  <span className="font-mono text-[9px] text-muted-foreground">{inc.incidentId}</span>
                  <span className="ml-auto text-[9px]" style={{ color: STATUS_META[inc.status]?.color }}>{STATUS_META[inc.status]?.label}</span>
                </div>
                <div className="text-[11px] font-medium truncate">{inc.title}</div>
                <div className="text-[9px] text-muted-foreground">{tmeta.label} · {(inc.confidence * 100).toFixed(0)}%</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Evidence Room */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {selected ? <EvidenceRoom key={selected} incidentId={selected} /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            <FileSearch className="size-8 opacity-30 mr-2" /> Select a case to open its Evidence Room
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceRoom({ incidentId }: { incidentId: string }) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState<"evidence" | "timeline" | "decisions" | "actions">("evidence");

  useEffect(() => {
    let cancelled = false;
    api(`/api/command-center/evidence-room/${incidentId}`)
      .then((d) => { if (!cancelled) setRoom(d.evidenceRoom); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [incidentId]);

  if (loading || !room) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  }

  const tmeta = TYPE_META[room.type] ?? { label: room.type ?? "Unknown", color: "#a1a1aa" };

  return (
    <div className="h-full flex flex-col">
      {/* Case header */}
      <div className="px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <FileSearch className="size-4 text-primary" />
          <span className="font-mono text-xs font-semibold">{incidentId}</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>
            {tmeta.label}
          </span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground">Fused confidence</span>
          <span className="font-mono text-[11px] font-semibold" style={{ color: tmeta.color }}>{(room.fusedConfidence * 100).toFixed(0)}%</span>
          <div className="ml-auto flex items-center gap-1">
            {(["evidence", "timeline", "decisions", "actions"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSubtab(s)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-medium capitalize transition-colors",
                  subtab === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {room.recommendedAction && (
          <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1">
            <Zap className="size-3 text-amber-400" />
            <span className="text-[11px] text-amber-300/90"><span className="font-semibold">Recommended:</span> {room.recommendedAction}</span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4">
        {subtab === "evidence" && <EvidenceTab room={room} />}
        {subtab === "timeline" && <TimelineTab timeline={room.timeline} />}
        {subtab === "decisions" && <DecisionsSubTab decisions={room.decisions} />}
        {subtab === "actions" && <ActionsSubTab actions={room.actions} outcome={room.outcome} />}
      </div>
    </div>
  );
}

function EvidenceTab({ room }: { room: any }) {
  return (
    <div className="space-y-4">
      {/* Provenance chain audit */}
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Scale className="size-3" /> Provenance Chain Audit</SectionLabel>
        <div className="flex items-center gap-1 flex-wrap">
          {room.chainSteps.map((s: any, i: number) => (
            <div key={s.step} className="flex items-center gap-1">
              <div
                className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium border", s.present ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border bg-card/30 text-muted-foreground line-through opacity-50")}
                title={s.detail}
              >
                {s.present ? "✓" : "✗"} {s.step}
              </div>
              {i < room.chainSteps.length - 1 && <ArrowRight className="size-2.5 text-muted-foreground/50" />}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          {room.chainComplete ? "✓ Complete chain — every step from satellite pixel to outcome is traceable" : "Chain incomplete — some evidence steps are missing"}
        </div>
      </div>

      {/* Satellite evidence */}
      <EvidenceSection title="Satellite Evidence" icon={Satellite} color="#34d399" entries={room.satelliteEvidence} />
      <EvidenceSection title="SAR Evidence" icon={RadioTower} color="#a78bfa" entries={room.sarEvidence} />
      <EvidenceSection title="Weather Evidence" icon={Activity} color="#38bdf8" entries={room.weatherEvidence} />
      <EvidenceSection title="Historical Evidence" icon={Clock} color="#fbbf24" entries={room.historicalEvidence} />

      {/* Agent reasoning */}
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Brain className="size-3" /> Agent Reasoning</SectionLabel>
        <div className="space-y-1.5">
          {room.agentReasoning.map((a: any, i: number) => (
            <div key={i} className="rounded-md border border-border bg-card/30 px-2.5 py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10px] font-semibold text-violet-300">{a.agentId}</span>
                {a.isPrimary && <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[8px] font-semibold text-violet-300">PRIMARY</span>}
                {a.rank && <span className="text-[9px] text-muted-foreground">rank #{a.rank}</span>}
                <span className="ml-auto font-mono text-[10px] font-semibold" style={{ color: a.confidence >= 0.7 ? "#34d399" : a.confidence >= 0.5 ? "#fbbf24" : "#fb923c" }}>
                  {(a.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-[11px] font-medium">{a.position}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{a.reasoning}</div>
              {(a.supporting !== undefined || a.contradicting !== undefined) && (
                <div className="flex items-center gap-3 mt-1 text-[9px]">
                  <span className="text-emerald-400">↑ {a.supporting ?? 0} supporting</span>
                  <span className="text-rose-400">↓ {a.contradicting ?? 0} contradicting</span>
                  <span className="text-muted-foreground">? {a.missing ?? 0} missing</span>
                </div>
              )}
            </div>
          ))}
          {room.agentReasoning.length === 0 && <div className="text-[11px] text-muted-foreground">No agent reasoning recorded</div>}
        </div>
      </div>

      {/* Debate / arbitration */}
      {room.debateSummary.hasDebate && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Scale className="size-3 text-violet-300" /> Arbitration Summary</SectionLabel>
          <div className="text-[11px]">
            <div className="mb-1"><span className="text-muted-foreground">Final assessment:</span> <span className="font-medium">{room.debateSummary.finalAssessment ?? "—"}</span></div>
            <div className="mb-1"><span className="text-muted-foreground">Confidence:</span> <span className="font-mono font-semibold">{room.debateSummary.confidence ? `${(room.debateSummary.confidence * 100).toFixed(0)}%` : "—"}</span></div>
            <div className="mb-1"><span className="text-muted-foreground">Outcome:</span> <span className="font-medium">{room.debateSummary.outcome}</span></div>
            {room.debateSummary.claims?.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-muted-foreground mb-1">Claims weighed:</div>
                {room.debateSummary.claims.map((c: any, i: number) => (
                  <div key={i} className="text-[10px] flex items-center gap-2">
                    <span className="font-mono text-violet-300">{c.agentId}</span>
                    <span className="flex-1 truncate">{c.assessment}</span>
                    <span className="font-mono">{c.confidence ? `${(c.confidence * 100).toFixed(0)}%` : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceSection({ title, icon: Icon, color, entries }: { title: string; icon: React.ElementType; color: string; entries: any[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <SectionLabel className="mb-2 flex items-center gap-1.5">
        <Icon className="size-3" style={{ color }} /> {title}
        <span className="ml-auto text-[9px] font-mono text-muted-foreground">{entries.length} items</span>
      </SectionLabel>
      <div className="space-y-1">
        {entries.map((e: any, i: number) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-card/20 px-2 py-1.5">
            <CheckCircle2 className="size-3 shrink-0 mt-0.5" style={{ color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium">{e.source ?? e.type}</span>
                {e.type && <span className="text-[9px] font-mono text-muted-foreground">{e.type}</span>}
                <span className="ml-auto font-mono text-[9px] font-semibold" style={{ color }}>{(e.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="text-[10px] text-foreground/70 mt-0.5">{e.finding}</div>
              {e.date && <div className="text-[9px] text-muted-foreground mt-0.5">{new Date(e.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>}
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-[11px] text-muted-foreground italic">No {title.toLowerCase()} recorded</div>}
      </div>
    </div>
  );
}

function TimelineTab({ timeline }: { timeline: any[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <SectionLabel className="mb-3 flex items-center gap-1.5"><Clock className="size-3" /> Incident Timeline</SectionLabel>
      <div className="relative pl-4">
        <div className="absolute left-1 top-1 bottom-1 w-px bg-border" />
        {timeline.map((t: any, i: number) => (
          <div key={i} className="relative pb-3">
            <div className="absolute -left-3 top-0.5 size-2 rounded-full bg-primary border-2 border-background" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">{new Date(t.time).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
              <span className="text-[11px] font-semibold">{t.event}</span>
              {t.actor && <span className="text-[9px] font-mono text-primary/70">{t.actor}</span>}
            </div>
            <div className="text-[10px] text-foreground/70 mt-0.5">{t.detail}</div>
          </div>
        ))}
        {timeline.length === 0 && <div className="text-[11px] text-muted-foreground">No timeline events</div>}
      </div>
    </div>
  );
}

function DecisionsSubTab({ decisions }: { decisions: any[] }) {
  return (
    <div className="space-y-2">
      <SectionLabel className="flex items-center gap-1.5"><Gavel className="size-3" /> Decision Provenance — {decisions.length} decisions</SectionLabel>
      {decisions.map((d: any) => (
        <div key={d.decisionId} className="rounded-lg border border-border bg-card/40 p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-semibold text-amber-300">{d.decisionId}</span>
            <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-300">{d.decisionType}</span>
            {d.policyChecked && <CheckCircle2 className="size-3 text-emerald-400" />}
            <span className="ml-auto text-[9px] text-muted-foreground">{new Date(d.decidedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
          <div className="text-[11px] font-medium">{d.decision}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{d.rationale}</div>
          <div className="flex items-center gap-2 mt-1 text-[9px]">
            <span className="text-muted-foreground">by</span>
            <span className="font-mono text-primary/70">{d.actorRole}</span>
            <span className="font-mono text-muted-foreground">({d.actorId})</span>
            {d.basedOn.length > 0 && <span className="text-muted-foreground">· based on {d.basedOn.length} artifact(s)</span>}
          </div>
        </div>
      ))}
      {decisions.length === 0 && <div className="text-[11px] text-muted-foreground">No decisions recorded</div>}
    </div>
  );
}

function ActionsSubTab({ actions, outcome }: { actions: any[]; outcome: any }) {
  return (
    <div className="space-y-2">
      <SectionLabel className="flex items-center gap-1.5"><Zap className="size-3" /> Operational Actions — {actions.length} dispatched</SectionLabel>
      {actions.map((a: any) => {
        const color = a.status === "completed" ? "#34d399" : a.status === "dispatched" ? "#fb923c" : "#a1a1aa";
        return (
          <div key={a.actionId} className="rounded-lg border border-border bg-card/40 p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-semibold text-cyan-300">{a.actionId}</span>
              <span className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ color, background: `${color}1a` }}>{a.actionType}</span>
              <span className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ color, background: `${color}14` }}>{a.status}</span>
              <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground"><DollarSign className="size-2.5" />{a.cost > 0 ? `$${a.cost}` : "free"}</span>
            </div>
            <div className="text-[11px]">{a.description}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">→ {a.assignedTo} ({a.assignedRole})</div>
            {a.result && <div className="text-[10px] text-foreground/70 mt-1 rounded bg-card/30 p-1.5 border border-border/50">📋 {a.result}</div>}
          </div>
        );
      })}
      {actions.length === 0 && <div className="text-[11px] text-muted-foreground">No actions dispatched</div>}

      {outcome && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mt-2">
          <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Brain className="size-3 text-emerald-400" /> Outcome → Learning Feedback</SectionLabel>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-semibold text-emerald-300">{outcome.outcomeId}</span>
            <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">{outcome.result}</span>
            <span className="text-[9px] text-muted-foreground">ground truth: {outcome.groundTruth ? "✓ confirmed" : "✗ false positive"}</span>
          </div>
          <div className="text-[11px]">{outcome.summary}</div>
          <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-2.5" /> {outcome.timeToResolveH}h to resolve</span>
            <span className="flex items-center gap-1"><DollarSign className="size-2.5" /> ${outcome.totalCost}</span>
            <span className="flex items-center gap-1"><ArrowRight className="size-2.5" /> feedback artifact: <span className="font-mono">{outcome.feedbackArtifact}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// TAB: WORKFLOWS
// ===========================================================================

function WorkflowsTab() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/api/command-center/workflows"),
      api("/api/command-center/executions?limit=50"),
    ]).then(([w, e]) => {
      setWorkflows(w.workflows);
      setExecutions(e.executions);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdvance = async (executionId: string) => {
    setBusy(executionId);
    try {
      await api("/api/command-center/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId, actor: "ui-operator", decision: "Advanced via Command Center UI" }),
      });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="h-full flex">
      {/* Workflow definitions */}
      <div className="w-[360px] shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border"><SectionLabel>Workflow Definitions</SectionLabel></div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-2 space-y-1.5">
          {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-4 animate-spin text-primary" /></div>}
          {workflows.map((wf) => {
            const tmeta = TYPE_META[wf.triggerType] ?? { label: wf.triggerType, color: "#a1a1aa" };
            return (
              <div key={wf.workflowId} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <GitBranch className="size-3 text-primary" />
                  <span className="text-[11px] font-semibold truncate flex-1">{wf.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>{tmeta.label}</span>
                  <span className="text-[9px] text-muted-foreground">{wf.steps.length} steps</span>
                  <span className="text-[9px] text-muted-foreground ml-auto font-mono">v{wf.version}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mb-1.5 leading-snug">{wf.description}</div>
                <div className="space-y-0.5">
                  {wf.steps.map((s: any, i: number) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-3.5 rounded-full bg-foreground/10 flex items-center justify-center font-mono font-semibold text-[8px] shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-muted-foreground">{s.sla}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-[9px] text-muted-foreground flex items-center gap-1">
                  <Users className="size-2.5" /> owns: <span className="font-mono">{wf.owningRole}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Executions */}
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <SectionLabel>Active Workflow Executions</SectionLabel>
          <span className="text-[10px] text-muted-foreground">{executions.length} executions</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-2">
          {executions.map((ex) => {
            const tmeta = TYPE_META[ex.steps?.[0]?.type] ?? { label: "", color: "#a1a1aa" };
            const isRunning = ex.status === "running";
            return (
              <div key={ex.executionId} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] font-semibold text-primary">{ex.executionId}</span>
                  <span className="text-[10px] text-muted-foreground">→ {ex.incidentId}</span>
                  <span className="text-[10px] text-muted-foreground">· {ex.workflowId}</span>
                  <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold", isRunning ? "bg-amber-500/15 text-amber-300" : ex.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : "bg-foreground/10 text-muted-foreground")}>
                    {ex.status}
                  </span>
                </div>
                {/* Steps */}
                <div className="space-y-1">
                  {ex.stepStates.map((ss: any, i: number) => {
                    const color = ss.status === "completed" ? "#34d399" : ss.status === "active" ? "#fbbf24" : ss.status === "skipped" ? "#64748b" : "#a1a1aa";
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="size-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
                          {ss.status === "completed" ? "✓" : ss.status === "active" ? "●" : ss.status === "skipped" ? "—" : i + 1}
                        </span>
                        <span className={cn("flex-1 truncate", ss.status === "pending" && "text-muted-foreground", ss.status === "completed" && "text-foreground/80")}>
                          {ss.stepName}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{ss.requiredRole}</span>
                        <span className="text-[9px] text-muted-foreground">{ss.sla}</span>
                      </div>
                    );
                  })}
                </div>
                {ex.stepStates[ex.currentStep]?.actor && (
                  <div className="mt-1.5 text-[9px] text-muted-foreground">Current actor: <span className="font-mono">{ex.stepStates[ex.currentStep].actor}</span></div>
                )}
                {isRunning && (
                  <button
                    onClick={() => handleAdvance(ex.executionId)}
                    disabled={busy === ex.executionId}
                    className="mt-2 flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {busy === ex.executionId ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                    Complete Step {ex.currentStep + 1}: {ex.stepStates[ex.currentStep]?.stepName}
                  </button>
                )}
              </div>
            );
          })}
          {executions.length === 0 && !loading && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <GitBranch className="size-8 opacity-30" />
              <span className="text-xs">No workflow executions yet. Incidents with matching workflows auto-start.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: DECISIONS
// ===========================================================================

function DecisionsTab() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/command-center/decisions?limit=100")
      .then((d) => setDecisions(d.decisions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Gavel className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Decision Provenance</span>
        <span className="text-[11px] text-muted-foreground">— every human action is an immutable artifact</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{decisions.length} decisions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {decisions.map((d) => (
          <div key={d.decisionId} className="rounded-lg border border-border bg-card/40 px-3 py-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] font-semibold text-amber-300">{d.decisionId}</span>
              <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-300">{d.decisionType}</span>
              {d.policyChecked ? (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400"><ShieldCheck className="size-2.5" /> policy ✓</span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] text-rose-400"><AlertCircle className="size-2.5" /> policy ✗</span>
              )}
              {d.incidentId && <span className="text-[9px] font-mono text-primary/70">{d.incidentId}</span>}
              <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(d.decidedAt)}</span>
            </div>
            <div className="text-[12px] font-medium mb-0.5">{d.decision}</div>
            <div className="text-[11px] text-foreground/70 leading-snug">{d.rationale}</div>
            <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground flex-wrap">
              <span>by <span className="font-mono text-primary/70">{d.actorRole}</span> ({d.actorId})</span>
              {d.basedOn.length > 0 && <span>· based on {d.basedOn.length} artifact(s)</span>}
              {d.permissionsUsed.length > 0 && <span>· {d.permissionsUsed.length} permission(s) used</span>}
              {d.actionIds.length > 0 && <span className="text-cyan-400">· → {d.actionIds.length} action(s)</span>}
            </div>
          </div>
        ))}
        {decisions.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Gavel className="size-8 opacity-30" />
            <span className="text-xs">No decisions recorded yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INSTITUTIONAL ROLES
// ===========================================================================

function RolesTab() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/command-center/roles")
      .then((d) => setRoles(d.roles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const INSTITUTION_COLOR: Record<string, string> = {
    EPA: "#34d399",
    NADMO: "#fb923c",
    "Forestry Commission": "#84cc16",
    COCOBOD: "#fbbf24",
    "Field Operations": "#22d3ee",
    Intelligence: "#a78bfa",
    Administration: "#f43f5e",
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Users className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Institutional Roles</span>
        <span className="text-[11px] text-muted-foreground">— governance packages, not hardcoded users</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{roles.length} roles</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {loading && <div className="flex h-32 items-center justify-center col-span-2"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {roles.map((r) => {
          const color = INSTITUTION_COLOR[r.institution] ?? "#a1a1aa";
          return (
            <div key={r.roleId} className="rounded-lg border border-border bg-card/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="size-7 rounded-md flex items-center justify-center font-bold text-[11px]" style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}>
                  {r.institution.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{r.name}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">{r.roleId}</div>
                </div>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color, background: `${color}1a` }}>{r.institution}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{r.description}</p>
              <div className="mb-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">Permissions ({r.permissions.length})</div>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p: any) => (
                    <span key={p.id} className="rounded bg-foreground/5 border border-border px-1.5 py-0.5 text-[9px] font-mono" title={p.name}>
                      {p.id}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground border-t border-border/60 pt-1.5">
                <span>max severity: <span className="font-mono" style={{ color: SEVERITY_META[r.maxSeverity]?.color }}>{r.maxSeverity}</span></span>
                <span className="flex items-center gap-1">{r.canEscalate ? <CheckCircle2 className="size-2.5 text-emerald-400" /> : "—"} can escalate</span>
                {r.requiresApproval.length > 0 && <span className="text-amber-400">⚠ {r.requiresApproval.length} need approval</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
