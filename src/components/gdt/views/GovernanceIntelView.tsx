"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo, fmtDate } from "@/lib/gdt/format";
import {
  Brain,
  Search,
  Scale,
  Landmark,
  ShieldCheck,
  FileSearch,
  Gavel,
  Building2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  FlaskConical,
  Briefcase,
  Globe2,
  Users,
  ScrollText,
  ChevronDown,
  Activity,
  Eye,
} from "lucide-react";

// ===========================================================================
// METADATA MAPS
// ===========================================================================

const AGENT_TYPE_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  constitutional_auditor: { color: "#34d399", label: "Constitutional Auditor", icon: ShieldCheck },
  court_research:        { color: "#a78bfa", label: "Court Research",         icon: FileSearch },
  council_intelligence:  { color: "#fbbf24", label: "Council Intelligence",   icon: Brain },
};

const AUTHORITY_META: Record<string, { color: string; label: string }> = {
  advisory: { color: "#22d3ee", label: "Advisory" },
  monitor:  { color: "#fbbf24", label: "Monitor" },
};

const PRECEDENT_LEVEL_META: Record<string, { color: string; label: string }> = {
  binding:         { color: "#34d399", label: "Binding" },
  persuasive:      { color: "#22d3ee", label: "Persuasive" },
  distinguishable: { color: "#a1a1aa", label: "Distinguishable" },
};

const COURT_LEVEL_META: Record<string, { color: string; label: string }> = {
  national: { color: "#22d3ee", label: "National" },
  regional: { color: "#fbbf24", label: "Regional" },
  global:   { color: "#f43f5e", label: "Global" },
};

const TRUST_TIER_META: Record<string, { color: string; label: string }> = {
  unproven:  { color: "#a1a1aa", label: "Unproven" },
  emerging:  { color: "#fbbf24", label: "Emerging" },
  trusted:   { color: "#22d3ee", label: "Trusted" },
  anchor:    { color: "#34d399", label: "Anchor" },
};

const AUDIT_RESULT_META: Record<string, { color: string; label: string }> = {
  compliant:             { color: "#34d399", label: "Compliant" },
  violations_found:      { color: "#f43f5e", label: "Violations Found" },
  recommendations_made:  { color: "#fbbf24", label: "Recommendations Made" },
};

const AUDIT_TYPE_META: Record<string, { color: string; label: string }> = {
  policy_compliance:  { color: "#34d399", label: "Policy Compliance" },
  precedent_search:   { color: "#a78bfa", label: "Precedent Search" },
  impact_analysis:    { color: "#fbbf24", label: "Impact Analysis" },
};

const INSTITUTION_TYPE_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  government:     { color: "#34d399", label: "Government",   icon: Building2 },
  university:     { color: "#a78bfa", label: "University",   icon: FlaskConical },
  ngo:            { color: "#a3e635", label: "NGO",          icon: Briefcase },
  corporation:    { color: "#fbbf24", label: "Corporation",  icon: Building2 },
  developer:      { color: "#22d3ee", label: "Developer",    icon: Users },
  regional_body:  { color: "#38bdf8", label: "Regional Body", icon: Globe2 },
};

const CASE_TYPE_META: Record<string, { color: string; label: string }> = {
  false_enforcement:    { color: "#f43f5e", label: "False Enforcement" },
  evidence_manipration: { color: "#fb923c", label: "Evidence Manipulation" },
  license_violation:    { color: "#fbbf24", label: "License Violation" },
  reputation_attack:    { color: "#a78bfa", label: "Reputation Attack" },
  attribution_dispute:  { color: "#22d3ee", label: "Attribution Dispute" },
  package_misconduct:   { color: "#ef4444", label: "Package Misconduct" },
  contract_breach:      { color: "#fb7185", label: "Contract Breach" },
};

const FINDING_SEVERITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: "#f43f5e", label: "Critical" },
  warn:     { color: "#fbbf24", label: "Warning" },
  info:     { color: "#22d3ee", label: "Info" },
};

type Tab = "overview" | "agents" | "precedents" | "institutions" | "audits";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",    icon: Activity },
  { id: "agents",       label: "Agents",      icon: Brain },
  { id: "precedents",   label: "Precedents",  icon: Gavel },
  { id: "institutions", label: "Institutions", icon: Building2 },
  { id: "audits",       label: "Audits",      icon: ShieldCheck },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Small color pill helper (consistent with FederationView/GovernanceView styling)
function ColorPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-semibold"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function GovernanceIntelView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Brain className="size-4 text-primary" /> Governance Intelligence &amp; Institutional Memory
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[14px] font-mono text-primary">
            package: governance-intelligence
          </span>
          <p className="text-[15px] text-muted-foreground hidden lg:block">
            Advisory agents · Legal precedents · Institutional reputation — intelligence that governs intelligence
          </p>
          <PackageBadge />
        </div>
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab />}
        {tab === "agents" && <AgentsTab />}
        {tab === "precedents" && <PrecedentsTab />}
        {tab === "institutions" && <InstitutionsTab />}
        {tab === "audits" && <AuditsTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => {
    api("/api/governance-intel")
      .then((d) => setPackages(d.packages))
      .catch(() => {});
  }, []);
  if (packages.length === 0) return null;
  const p = packages[0];
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[14px] text-muted-foreground">
      <ShieldCheck className="size-3 text-emerald-400" />
      <span className="font-mono">v{p.version}</span>
      <span>·</span>
      <span>{p.provides.length} capabilities</span>
      <span>·</span>
      <span>{p.subPackages.length} sub-packages</span>
    </div>
  );
}

// ===========================================================================
// TAB: OVERVIEW
// ===========================================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/governance-intel")
      .then((d) => setData(d.overview))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  const o = data;
  const c = o.counts;
  const a = o.active;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricStat label="Agents" value={c.agents} sub={`${a.activeAgents} active`} accent="#34d399" />
        <MetricStat label="Audits" value={c.audits} sub="agent runs" accent="#22d3ee" />
        <MetricStat label="Precedents" value={c.precedents} sub={`${a.bindingPrecedents} binding`} accent="#a78bfa" />
        <MetricStat label="Institutions" value={c.institutions} sub={`${a.anchorInstitutions} anchor`} accent="#fbbf24" />
        <MetricStat label="Violations" value={a.violationsFound} sub="found in audits" accent="#f43f5e" />
        <MetricStat label="Binding" value={a.bindingPrecedents} sub="legal precedents" accent="#34d399" />
        <MetricStat label="Anchor" value={a.anchorInstitutions} sub="top-tier institutions" accent="#22d3ee" />
      </div>

      {/* Active agents strip */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[14px] font-semibold uppercase tracking-wider text-primary">Governance Agents — Advisory Only, Never Decide</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {o.agents.map((ag: any) => {
            const tMeta = AGENT_TYPE_META[ag.agentType] ?? { color: "#a1a1aa", label: ag.agentType, icon: Brain };
            const aMeta = AUTHORITY_META[ag.authority] ?? { color: "#a1a1aa", label: ag.authority };
            const Icon = tMeta.icon;
            return (
              <div key={ag.agentId} className="rounded border border-border bg-card/40 px-2.5 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex size-6 items-center justify-center rounded" style={{ background: `${tMeta.color}1a`, color: tMeta.color }}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold truncate">{ag.name}</div>
                    <div className="font-mono text-[13px] text-muted-foreground">{ag.agentId}</div>
                  </div>
                  <ColorPill color={aMeta.color} label={aMeta.label} />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Activity className="size-2.5" /> {ag.totalRuns ?? 0} runs
                  </span>
                  <span className="flex items-center gap-0.5">
                    <AlertTriangle className="size-2.5" /> {ag.totalFindings ?? 0} findings
                  </span>
                  {ag.lastRunAt && (
                    <span className="ml-auto">last {timeAgo(ag.lastRunAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {o.agents.length === 0 && (
            <div className="text-[15px] text-muted-foreground col-span-full">No governance agents registered.</div>
          )}
        </div>
      </div>

      {/* Recent audits + recent precedents + top institutions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="size-3" /> Recent Audits
          </SectionLabel>
          <div className="space-y-1.5">
            {o.recentAudits.map((au: any) => {
              const rMeta = AUDIT_RESULT_META[au.result] ?? { color: "#a1a1aa", label: au.result };
              const tMeta = AUDIT_TYPE_META[au.auditType] ?? { color: "#a1a1aa", label: au.auditType };
              return (
                <div key={au.runId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="font-mono text-[13px] text-muted-foreground">{au.runId}</span>
                    <ColorPill color={tMeta.color} label={tMeta.label} />
                    <ColorPill color={rMeta.color} label={rMeta.label} />
                    <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(au.completedAt || au.startedAt)}</span>
                  </div>
                  <div className="text-[15px] font-medium leading-tight line-clamp-2">{au.summary}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>by <span className="text-foreground">{au.agentName}</span></span>
                    {au.violationCount > 0 && <span className="text-rose-400">{au.violationCount} violations</span>}
                    <span className="ml-auto font-mono">{au.durationMs ?? 0}ms</span>
                  </div>
                </div>
              );
            })}
            {o.recentAudits.length === 0 && (
              <div className="text-[15px] text-muted-foreground">No audit runs yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Gavel className="size-3" /> Recent Precedents
          </SectionLabel>
          <div className="space-y-1.5">
            {o.recentPrecedents.map((pr: any) => {
              const lMeta = PRECEDENT_LEVEL_META[pr.precedentLevel] ?? { color: "#a1a1aa", label: pr.precedentLevel };
              const clMeta = COURT_LEVEL_META[pr.courtLevel] ?? { color: "#a1a1aa", label: pr.courtLevel };
              return (
                <div key={pr.precedentId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="font-mono text-[13px] text-muted-foreground">{pr.precedentId}</span>
                    <ColorPill color={lMeta.color} label={lMeta.label} />
                    <ColorPill color={clMeta.color} label={clMeta.label} />
                    <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(pr.establishedAt)}</span>
                  </div>
                  <div className="text-[15px] font-medium leading-tight line-clamp-2">{pr.principleEstablished}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>from <span className="text-foreground">{pr.caseTitle}</span></span>
                    <span className="ml-auto">{pr.citedByCount} cited by</span>
                  </div>
                </div>
              );
            })}
            {o.recentPrecedents.length === 0 && (
              <div className="text-[15px] text-muted-foreground">No precedents established yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Building2 className="size-3" /> Top Institutions
          </SectionLabel>
          <div className="space-y-1.5">
            {o.topInstitutions.map((inst: any) => {
              const tMeta = TRUST_TIER_META[inst.trustTier] ?? { color: "#a1a1aa", label: inst.trustTier };
              const tyMeta = INSTITUTION_TYPE_META[inst.institutionType] ?? { color: "#a1a1aa", label: inst.institutionType, icon: Building2 };
              const Icon = tyMeta.icon;
              return (
                <div key={inst.institutionId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="flex size-4 items-center justify-center rounded" style={{ background: `${tyMeta.color}1a`, color: tyMeta.color }}>
                      <Icon className="size-2.5" />
                    </span>
                    <span className="text-[15px] font-medium truncate">{inst.name}</span>
                    <ColorPill color={tMeta.color} label={tMeta.label} />
                    <span className="ml-auto text-[14px] font-mono font-bold" style={{ color: tMeta.color }}>{inst.overallScore ?? 0}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground flex items-center gap-2">
                    <span className="font-mono">{inst.institutionId}</span>
                    {inst.countryCode && <span>· {inst.countryCode}</span>}
                    <span className="ml-auto">{inst.packagesPublished ?? 0} packages</span>
                  </div>
                </div>
              );
            })}
            {o.topInstitutions.length === 0 && (
              <div className="text-[15px] text-muted-foreground">No institutions registered.</div>
            )}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="size-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">GOVERNANCE INTELLIGENCE PRINCIPLES</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[14px] font-medium text-emerald-400 mb-0.5">Agents Advise, Never Decide</div>
            <div className="text-[14px] text-muted-foreground">Constitutional Auditor, Court Research, Council Intelligence — all monitor/advisory only. The council and courts retain decision authority.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[14px] font-medium text-cyan-400 mb-0.5">Audits Are Continuous</div>
            <div className="text-[14px] text-muted-foreground">Agents run compliance checks, precedent searches, and impact analyses. Findings feed the council + courts as evidence — never as binding action.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[14px] font-medium text-violet-400 mb-0.5">Precedents Compound</div>
            <div className="text-[14px] text-muted-foreground">Past verdicts establish binding/persuasive principles. Future cases reference them. Confidence grows with each citation — the institutional memory of governance.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[14px] font-medium text-amber-400 mb-0.5">Institutions Are Accountable</div>
            <div className="text-[14px] text-muted-foreground">Compliance, decision quality, transparency, public trust — organizations rise through trust tiers: unproven → emerging → trusted → anchor.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: AGENTS
// ===========================================================================

function AgentsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api("/api/governance-intel/agents")
      .then((d) => { if (!cancelled) setAgents(d.agents); })
      .catch(() => { if (!cancelled) setAgents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshAgents = useCallback(() => {
    api("/api/governance-intel/agents")
      .then((d) => setAgents(d.agents))
      .catch(() => setAgents([]));
  }, []);

  const runAudit = useCallback(() => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    api("/api/governance-intel/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "constitutional" }),
    })
      .then((d) => {
        setRunResult(d.run);
        // refresh agent stats
        refreshAgents();
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setRunning(false));
  }, [refreshAgents]);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Brain className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Governance Agents</span>
        <span className="text-[15px] text-muted-foreground">— advisory AI that assists governance. Monitors compliance, researches precedents, analyses impact. Never decides.</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{agents.length} agents</span>
        <button
          onClick={runAudit}
          disabled={running}
          className={cn(
            "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[14px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5",
            running && "opacity-50 cursor-wait"
          )}
        >
          {running ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
          Run Audit
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-3">
        {/* Run result banner */}
        {runResult && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-[15px] font-semibold text-emerald-300">Audit Run Completed</span>
              <span className="font-mono text-[14px] text-muted-foreground">{runResult.runId}</span>
              <span className="ml-auto text-[13px] text-muted-foreground">{runResult.durationMs ?? 0}ms</span>
            </div>
            <p className="text-[15px] text-foreground/80">{runResult.summary}</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-rose-400" />
            <span className="text-[15px] text-rose-300">{error}</span>
          </div>
        )}

        {/* Agent cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {agents.map((ag) => {
            const tMeta = AGENT_TYPE_META[ag.agentType] ?? { color: "#a1a1aa", label: ag.agentType, icon: Brain };
            const aMeta = AUTHORITY_META[ag.authority] ?? { color: "#a1a1aa", label: ag.authority };
            const Icon = tMeta.icon;
            return (
              <div key={ag.agentId} className="rounded-lg border border-border bg-card/40 p-3 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${tMeta.color}1a`, color: tMeta.color, border: `1px solid ${tMeta.color}33` }}>
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold truncate">{ag.name}</div>
                    <div className="font-mono text-[13px] text-muted-foreground">{ag.agentId}</div>
                  </div>
                </div>

                {/* Type + scope + authority pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <ColorPill color={tMeta.color} label={tMeta.label} />
                  <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] font-mono text-muted-foreground capitalize">scope: {ag.scope}</span>
                  <ColorPill color={aMeta.color} label={aMeta.label} />
                </div>

                {/* Description */}
                <p className="text-[14px] text-foreground/70 leading-snug mb-2.5 line-clamp-5">{ag.description}</p>

                {/* Capabilities */}
                <div className="mb-2.5">
                  <div className="text-[13px] uppercase tracking-wider text-muted-foreground mb-1">Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {ag.capabilities?.map((cap: string) => (
                      <span key={cap} className="rounded bg-foreground/5 px-1.5 py-0.5 text-[13px] font-mono text-foreground/80">{cap}</span>
                    ))}
                    {(!ag.capabilities || ag.capabilities.length === 0) && (
                      <span className="text-[13px] text-muted-foreground">No capabilities registered.</span>
                    )}
                  </div>
                </div>

                {/* Run stats */}
                <div className="mt-auto grid grid-cols-3 gap-1.5">
                  <div className="rounded border border-border bg-card/30 px-2 py-1.5 text-center">
                    <div className="text-[13px] text-muted-foreground uppercase">Runs</div>
                    <div className="text-[18px] font-mono font-bold text-cyan-400">{ag.totalRuns ?? 0}</div>
                  </div>
                  <div className="rounded border border-border bg-card/30 px-2 py-1.5 text-center">
                    <div className="text-[13px] text-muted-foreground uppercase">Findings</div>
                    <div className="text-[18px] font-mono font-bold text-rose-400">{ag.totalFindings ?? 0}</div>
                  </div>
                  <div className="rounded border border-border bg-card/30 px-2 py-1.5 text-center">
                    <div className="text-[13px] text-muted-foreground uppercase">Recs</div>
                    <div className="text-[18px] font-mono font-bold text-amber-400">{ag.totalRecommendations ?? 0}</div>
                  </div>
                </div>

                {/* Last run */}
                <div className="mt-2 text-[13px] text-muted-foreground flex items-center gap-1">
                  <Activity className="size-2.5" />
                  {ag.lastRunAt ? `last run ${timeAgo(ag.lastRunAt)}` : "never run"}
                </div>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <Brain className="size-8 opacity-30" />
              <span className="text-xs">No governance agents registered.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: PRECEDENTS
// ===========================================================================

function PrecedentsTab() {
  const [precedents, setPrecedents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [courtFilter, setCourtFilter] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (levelFilter) params.set("precedentLevel", levelFilter);
    if (courtFilter) params.set("courtLevel", courtFilter);
    const q = params.toString() ? `?${params.toString()}` : "";
    api(`/api/governance-intel/precedents${q}`)
      .then((d) => setPrecedents(d.precedents))
      .catch(() => setPrecedents([]))
      .finally(() => setLoading(false));
  }, [levelFilter, courtFilter]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Gavel className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Legal Precedents</span>
        <span className="text-[15px] text-muted-foreground">— past verdicts establish principles for future decisions. Institutional memory of the intelligence civilization.</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{precedents.length} precedents</span>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[14px] text-muted-foreground">level:</span>
        <button
          onClick={() => setLevelFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
            levelFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(PRECEDENT_LEVEL_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setLevelFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
              levelFilter === k ? "text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
            style={levelFilter === k ? { color: m.color, background: `${m.color}1a`, borderColor: `${m.color}33` } : undefined}
          >
            {m.label}
          </button>
        ))}
        <span className="text-[14px] text-muted-foreground ml-3">court:</span>
        <button
          onClick={() => setCourtFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
            courtFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(COURT_LEVEL_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setCourtFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
              courtFilter === k ? "text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
            style={courtFilter === k ? { color: m.color, background: `${m.color}1a`, borderColor: `${m.color}33` } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {!loading && precedents.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Gavel className="size-8 opacity-30" />
            <span className="text-xs">No precedents match the filters.</span>
          </div>
        )}
        {precedents.map((pr) => (
          <PrecedentCard key={pr.precedentId} precedent={pr} />
        ))}
      </div>
    </div>
  );
}

function PrecedentCard({ precedent: pr }: { precedent: any }) {
  const lMeta = PRECEDENT_LEVEL_META[pr.precedentLevel] ?? { color: "#a1a1aa", label: pr.precedentLevel };
  const clMeta = COURT_LEVEL_META[pr.courtLevel] ?? { color: "#a1a1aa", label: pr.courtLevel };
  const cMeta = CASE_TYPE_META[pr.caseType] ?? { color: "#a1a1aa", label: pr.caseType };

  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="font-mono text-[14px] font-semibold text-muted-foreground">{pr.precedentId}</span>
        <ColorPill color={lMeta.color} label={lMeta.label} />
        <ColorPill color={clMeta.color} label={clMeta.label} />
        <ColorPill color={cMeta.color} label={cMeta.label} />
        <span className="ml-auto text-[13px] text-muted-foreground">established {timeAgo(pr.establishedAt)}</span>
      </div>

      <div className="text-[16px] font-semibold leading-tight mb-1.5 flex items-start gap-1.5">
        <Scale className="size-3 mt-0.5 text-primary shrink-0" />
        <span>{pr.principleEstablished}</span>
      </div>

      <p className="text-[15px] text-foreground/70 leading-snug mb-2 ml-4.5">{pr.principleSummary}</p>

      <div className="flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap ml-4.5">
        <span className="flex items-center gap-1">
          <FileSearch className="size-2.5" />
          from <span className="text-foreground font-medium">{pr.caseTitle}</span>
        </span>
        <span className="font-mono">case: {pr.caseId}</span>
        <span className="font-mono">court: {pr.courtId}</span>
        <span className="flex items-center gap-1">
          <Users className="size-2.5" /> cited by <span className="text-foreground font-mono">{pr.citedByCount ?? 0}</span>
        </span>
      </div>

      {/* Applies to + confidence */}
      <div className="mt-2 ml-4.5 flex items-center gap-3 flex-wrap">
        {pr.appliesTo && pr.appliesTo.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[13px] text-muted-foreground">applies to:</span>
            {pr.appliesTo.map((at: string) => {
              const atMeta = CASE_TYPE_META[at] ?? { color: "#a1a1aa", label: at };
              return <ColorPill key={at} color={atMeta.color} label={atMeta.label} />;
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 min-w-[120px]">
          <span className="text-[13px] text-muted-foreground">confidence</span>
          <div className="w-20">
            <ConfidenceBar value={pr.confidence ?? 0} showLabel={false} size="sm" />
          </div>
          <span className="font-mono text-[14px] tnum text-muted-foreground">{((pr.confidence ?? 0) * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INSTITUTIONS
// ===========================================================================

function InstitutionsTab() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [evaluatingAll, setEvaluatingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("/api/governance-intel/institutions")
      .then((d) => { if (!cancelled) setInstitutions(d.institutions); })
      .catch(() => { if (!cancelled) setInstitutions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshInstitutions = useCallback(() => {
    api("/api/governance-intel/institutions")
      .then((d) => setInstitutions(d.institutions))
      .catch(() => setInstitutions([]));
  }, []);

  const evaluateOne = useCallback((institutionId: string) => {
    setEvaluating(institutionId);
    api("/api/governance-intel/institutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "evaluate", institutionId }),
    })
      .then(() => refreshInstitutions())
      .catch(() => {})
      .finally(() => setEvaluating(null));
  }, [refreshInstitutions]);

  const evaluateAll = useCallback(() => {
    setEvaluatingAll(true);
    api("/api/governance-intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "evaluateAll" }),
    })
      .then(() => refreshInstitutions())
      .catch(() => {})
      .finally(() => setEvaluatingAll(false));
  }, [refreshInstitutions]);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Building2 className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Institutional Reputation</span>
        <span className="text-[15px] text-muted-foreground">— accountability for organizations operating in the intelligence civilization. 4-component composite score.</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{institutions.length} institutions</span>
        <button
          onClick={evaluateAll}
          disabled={evaluatingAll}
          className={cn(
            "rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[14px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors flex items-center gap-1.5",
            evaluatingAll && "opacity-50 cursor-wait"
          )}
        >
          {evaluatingAll ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Evaluate All
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-2">
        {institutions.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Building2 className="size-8 opacity-30" />
            <span className="text-xs">No institutions registered.</span>
          </div>
        )}
        {institutions.map((inst) => (
          <InstitutionCard
            key={inst.institutionId}
            institution={inst}
            onEvaluate={evaluateOne}
            evaluating={evaluating === inst.institutionId}
          />
        ))}
      </div>
    </div>
  );
}

function InstitutionCard({
  institution: inst,
  onEvaluate,
  evaluating,
}: {
  institution: any;
  onEvaluate: (id: string) => void;
  evaluating: boolean;
}) {
  const tMeta = TRUST_TIER_META[inst.trustTier] ?? { color: "#a1a1aa", label: inst.trustTier };
  const tyMeta = INSTITUTION_TYPE_META[inst.institutionType] ?? { color: "#a1a1aa", label: inst.institutionType, icon: Building2 };
  const Icon = tyMeta.icon;

  const components = [
    { label: "Compliance",      value: inst.complianceScore ?? 0,      color: "#34d399", icon: ShieldCheck },
    { label: "Decision Quality", value: inst.decisionQualityScore ?? 0, color: "#a78bfa", icon: Scale },
    { label: "Transparency",    value: inst.transparencyScore ?? 0,    color: "#22d3ee", icon: Eye },
    { label: "Public Trust",    value: inst.publicTrustScore ?? 0,     color: "#fbbf24", icon: Users },
  ];

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `${tyMeta.color}1a`, color: tyMeta.color, border: `1px solid ${tyMeta.color}33` }}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold truncate">{inst.name}</div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="font-mono">{inst.institutionId}</span>
            <ColorPill color={tyMeta.color} label={tyMeta.label} />
            {inst.countryCode && <span>· {inst.countryCode}</span>}
          </div>
        </div>
        <ColorPill color={tMeta.color} label={tMeta.label} />
        <button
          onClick={() => onEvaluate(inst.institutionId)}
          disabled={evaluating}
          className={cn(
            "rounded-md border border-border bg-card/40 px-2 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1",
            evaluating && "opacity-50 cursor-wait"
          )}
        >
          {evaluating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5" />}
          Evaluate
        </button>
      </div>

      {/* 4-component breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        {components.map((c) => {
          const CIcon = c.icon;
          return (
            <div key={c.label} className="rounded border border-border bg-card/30 px-2 py-1.5">
              <div className="flex items-center gap-1 mb-1">
                <CIcon className="size-2.5" style={{ color: c.color }} />
                <span className="text-[13px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.value}%`, background: c.color }} />
                </div>
                <span className="font-mono text-[15px] font-bold tnum" style={{ color: c.color }}>{Math.round(c.value)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall score + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded border border-border bg-card/30 px-2.5 py-1.5">
          <span className="text-[13px] uppercase tracking-wider text-muted-foreground">Overall</span>
          <span className="text-[16px] font-mono font-bold tnum" style={{ color: tMeta.color }}>{Math.round(inst.overallScore ?? 0)}</span>
          <span className="text-[14px] text-muted-foreground">/100</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5">
            <ScrollText className="size-2.5" /> {inst.packagesPublished ?? 0} packages
          </span>
          {inst.packagesSuspended > 0 && (
            <span className="flex items-center gap-0.5 text-rose-400">
              <AlertTriangle className="size-2.5" /> {inst.packagesSuspended} suspended
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Gavel className="size-2.5" /> {inst.totalCases ?? 0} cases ({inst.casesWon ?? 0}W / {inst.casesLost ?? 0}L)
          </span>
          {inst.totalDecisions > 0 && (
            <span className="flex items-center gap-0.5">
              <Scale className="size-2.5" /> {inst.totalDecisions} decisions
            </span>
          )}
        </div>
        {inst.lastEvaluatedAt && (
          <span className="ml-auto text-[13px] text-muted-foreground">evaluated {timeAgo(inst.lastEvaluatedAt)}</span>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: AUDITS
// ===========================================================================

function AuditsTab() {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (resultFilter) params.set("result", resultFilter);
    if (typeFilter) params.set("auditType", typeFilter);
    const q = params.toString() ? `?${params.toString()}` : "";
    api(`/api/governance-intel/audits${q}`)
      .then((d) => setAudits(d.audits))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  }, [resultFilter, typeFilter]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <ShieldCheck className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Audit Runs</span>
        <span className="text-[15px] text-muted-foreground">— agent executions: constitutional audits, precedent searches, impact analyses.</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{audits.length} runs</span>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[14px] text-muted-foreground">result:</span>
        <button
          onClick={() => setResultFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
            resultFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(AUDIT_RESULT_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setResultFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
              resultFilter === k ? "text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
            style={resultFilter === k ? { color: m.color, background: `${m.color}1a`, borderColor: `${m.color}33` } : undefined}
          >
            {m.label}
          </button>
        ))}
        <span className="text-[14px] text-muted-foreground ml-3">type:</span>
        <button
          onClick={() => setTypeFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
            typeFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(AUDIT_TYPE_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setTypeFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[13px] font-medium border transition-colors",
              typeFilter === k ? "text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
            style={typeFilter === k ? { color: m.color, background: `${m.color}1a`, borderColor: `${m.color}33` } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {!loading && audits.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-8 opacity-30" />
            <span className="text-xs">No audit runs match the filters.</span>
          </div>
        )}
        {audits.map((au) => (
          <AuditCard key={au.runId} audit={au} />
        ))}
      </div>
    </div>
  );
}

function AuditCard({ audit: au }: { audit: any }) {
  const [expanded, setExpanded] = useState(false);
  const rMeta = AUDIT_RESULT_META[au.result] ?? { color: "#a1a1aa", label: au.result };
  const tMeta = AUDIT_TYPE_META[au.auditType] ?? { color: "#a1a1aa", label: au.auditType };

  const toggle = useCallback(() => setExpanded((e) => !e), []);
  const findings: any[] = au.findings ?? [];

  return (
    <div className="rounded-lg border border-border bg-card/40">
      <button onClick={toggle} className="w-full text-left px-3 py-2.5 hover:bg-card/20 transition-colors">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-[14px] font-semibold text-muted-foreground">{au.runId}</span>
          <ColorPill color={tMeta.color} label={tMeta.label} />
          <ColorPill color={rMeta.color} label={rMeta.label} />
          {au.targetType && (
            <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] font-mono text-muted-foreground">
              target: {au.targetType}{au.targetId ? `/${au.targetId}` : ""}
            </span>
          )}
          <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(au.completedAt || au.startedAt)}</span>
          <ChevronDown className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
        <div className="text-[16px] font-medium leading-tight mb-1">{au.summary}</div>
        <div className="flex items-center gap-3 text-[14px] flex-wrap">
          <span className="text-muted-foreground">
            by <span className="text-foreground font-medium">{au.agentName}</span>
          </span>
          <span className="font-mono text-[13px] text-muted-foreground">{au.agentId}</span>
          {au.findingCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <AlertTriangle className="size-2.5" /> {au.findingCount} findings
            </span>
          )}
          {au.violationCount > 0 && (
            <span className="flex items-center gap-0.5 text-rose-400">
              <AlertTriangle className="size-2.5" /> {au.violationCount} violations
            </span>
          )}
          {au.recommendationCount > 0 && (
            <span className="flex items-center gap-0.5 text-cyan-400">
              <TrendingUp className="size-2.5" /> {au.recommendationCount} recommendations
            </span>
          )}
          <span className="ml-auto font-mono text-[13px] text-muted-foreground">{au.durationMs ?? 0}ms</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-[15px] text-emerald-300">No findings — agent found no issues.</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[13px] uppercase tracking-wider text-muted-foreground mb-1">
                Findings ({findings.length})
              </div>
              {findings.map((f: any, i: number) => {
                const sMeta = FINDING_SEVERITY_META[f.severity] ?? { color: "#a1a1aa", label: f.severity };
                return (
                  <div key={i} className="rounded border border-border bg-card/30 px-2 py-1.5 flex items-start gap-2 flex-wrap">
                    <ColorPill color={sMeta.color} label={sMeta.label} />
                    {f.article && (
                      <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] font-mono text-muted-foreground">
                        {f.article}
                      </span>
                    )}
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-[14px] text-foreground/80 leading-snug">{f.description}</div>
                      {f.recommendation && (
                        <div className="text-[14px] text-muted-foreground italic mt-0.5 flex items-start gap-1">
                          <ArrowRight className="size-2.5 mt-0.5 shrink-0" />
                          <span>{f.recommendation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit metadata */}
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground pt-1 border-t border-border/50 flex-wrap">
            <span>started: {au.startedAt ? fmtDate(au.startedAt) : "—"}</span>
            <span>completed: {au.completedAt ? fmtDate(au.completedAt) : "—"}</span>
            <span className="font-mono">duration: {au.durationMs ?? 0}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
