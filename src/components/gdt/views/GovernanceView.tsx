"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo, fmtDate } from "@/lib/gdt/format";
import {
  Scale,
  Gavel,
  Users,
  FileText,
  Vote,
  ShieldCheck,
  ScrollText,
  Landmark,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  MinusCircle,
  Building2,
  User,
  Cpu,
  FlaskConical,
  Globe2,
  Briefcase,
  RefreshCw,
  Banknote,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

// ===========================================================================
// METADATA MAPS
// ===========================================================================

const ARTICLE_CATEGORY_META: Record<string, { color: string; label: string }> = {
  rights:      { color: "#34d399", label: "Rights" },
  obligations: { color: "#fbbf24", label: "Obligations" },
  procedures:  { color: "#22d3ee", label: "Procedures" },
  limits:      { color: "#f43f5e", label: "Limits" },
  oversight:   { color: "#a78bfa", label: "Oversight" },
};

const ENFORCEMENT_META: Record<string, { color: string; label: string }> = {
  automatic:           { color: "#34d399", label: "Automatic" },
  council_review:      { color: "#a78bfa", label: "Council Review" },
  court_arbitration:   { color: "#22d3ee", label: "Court Arbitration" },
  treaty_enforcement:  { color: "#fb923c", label: "Treaty Enforcement" },
};

const CASE_TYPE_META: Record<string, { color: string; label: string }> = {
  false_enforcement:    { color: "#f43f5e", label: "False Enforcement" },
  evidence_manipration: { color: "#fb923c", label: "Evidence Manipulation" },
  license_violation:    { color: "#fbbf24", label: "License Violation" },
  reputation_attack:    { color: "#a78bfa", label: "Reputation Attack" },
  attribution_dispute:  { color: "#22d3ee", label: "Attribution Dispute" },
  package_misconduct:   { color: "#ef4444", label: "Package Misconduct" },
};

const CASE_STATUS_META: Record<string, { color: string; label: string }> = {
  filed:        { color: "#fbbf24", label: "Filed" },
  under_review: { color: "#22d3ee", label: "Under Review" },
  hearing:      { color: "#a78bfa", label: "Hearing" },
  ruled:        { color: "#34d399", label: "Ruled" },
  appealed:     { color: "#fb923c", label: "Appealed" },
  closed:       { color: "#a1a1aa", label: "Closed" },
};

const VERDICT_RULING_META: Record<string, { color: string; label: string }> = {
  for_plaintiff: { color: "#34d399", label: "For Plaintiff" },
  for_defendant: { color: "#f43f5e", label: "For Defendant" },
  settled:       { color: "#22d3ee", label: "Settled" },
  dismissed:     { color: "#a1a1aa", label: "Dismissed" },
};

const PROPOSAL_STATUS_META: Record<string, { color: string; label: string }> = {
  proposed:     { color: "#fbbf24", label: "Proposed" },
  under_review: { color: "#22d3ee", label: "Under Review" },
  voting:       { color: "#a78bfa", label: "Voting" },
  approved:     { color: "#34d399", label: "Approved" },
  rejected:     { color: "#f43f5e", label: "Rejected" },
  enacted:      { color: "#34d399", label: "Enacted" },
};

const PROPOSAL_TYPE_META: Record<string, { color: string; label: string }> = {
  budget:      { color: "#fbbf24", label: "Budget" },
  suspension:  { color: "#f43f5e", label: "Suspension" },
  amendment:   { color: "#a78bfa", label: "Amendment" },
  treaty:      { color: "#22d3ee", label: "Treaty" },
  policy:      { color: "#34d399", label: "Policy" },
  other:       { color: "#a1a1aa", label: "Other" },
};

const CONSTITUENCY_META: Record<
  string,
  { color: string; label: string; icon: React.ElementType }
> = {
  government: { color: "#34d399", label: "Government", icon: Building2 },
  citizen:    { color: "#22d3ee", label: "Citizen",    icon: User },
  developer:  { color: "#a78bfa", label: "Developer",  icon: Cpu },
  scientific: { color: "#fbbf24", label: "Scientific", icon: FlaskConical },
  ngo:        { color: "#a3e635", label: "NGO",        icon: Briefcase },
  regional:   { color: "#38bdf8", label: "Regional",   icon: Globe2 },
};

const JURISDICTION_META: Record<string, { color: string; label: string }> = {
  national: { color: "#34d399", label: "National" },
  regional: { color: "#a78bfa", label: "Regional" },
  global:   { color: "#22d3ee", label: "Global" },
};

const AMENDMENT_TYPE_META: Record<string, { color: string; label: string }> = {
  add:     { color: "#34d399", label: "Add" },
  modify:  { color: "#fbbf24", label: "Modify" },
  repeal:  { color: "#f43f5e", label: "Repeal" },
};

type Tab = "overview" | "constitution" | "council" | "courts" | "proposals";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",    icon: Scale },
  { id: "constitution", label: "Constitution", icon: ScrollText },
  { id: "council",      label: "Council",     icon: Users },
  { id: "courts",       label: "Courts",      icon: Gavel },
  { id: "proposals",    label: "Proposals",   icon: Vote },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Small color pill helper (consistent with FederationView styling)
function ColorPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
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

export function GovernanceView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Scale className="size-4 text-primary" /> Intelligence Governance &amp; Constitutional Layer
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: intelligence-governance
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Constitution · Council · Courts · Proposals — who governs the intelligence civilization
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
        {tab === "constitution" && <ConstitutionTab />}
        {tab === "council" && <CouncilTab />}
        {tab === "courts" && <CourtsTab />}
        {tab === "proposals" && <ProposalsTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => {
    api("/api/governance-v2")
      .then((d) => setPackages(d.packages))
      .catch(() => {});
  }, []);
  if (packages.length === 0) return null;
  const p = packages[0];
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
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
    api("/api/governance-v2")
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricStat label="Constitutions" value={c.constitutions} sub={`${a.ratifiedConstitutions} ratified`} accent="#34d399" />
        <MetricStat label="Articles" value={c.articles} sub="constitutional articles" accent="#a78bfa" />
        <MetricStat label="Councils" value={c.councils} sub={`${a.activeCouncils} active`} accent="#22d3ee" />
        <MetricStat label="Members" value={c.members} sub="seated reps" accent="#fbbf24" />
        <MetricStat label="Proposals" value={c.proposals} sub={`${a.openProposals} open`} accent="#fb923c" />
        <MetricStat label="Courts" value={c.courts} sub="judicial bodies" accent="#f43f5e" />
        <MetricStat label="Cases" value={c.cases} sub={`${a.openCases} open · ${a.ruledCases} ruled`} accent="#a3e635" />
        <MetricStat label="Verdicts" value={c.verdicts} sub="binding rulings" accent="#38bdf8" />
      </div>

      {/* Active status row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <ScrollText className="size-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ratified</span>
          </div>
          <div className="text-xl font-bold tnum text-emerald-400 mt-1">{a.ratifiedConstitutions}</div>
          <div className="text-[10px] text-muted-foreground">constitutions in force</div>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Councils</span>
          </div>
          <div className="text-xl font-bold tnum text-cyan-400 mt-1">{a.activeCouncils}</div>
          <div className="text-[10px] text-muted-foreground">active governance bodies</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <Vote className="size-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Open Proposals</span>
          </div>
          <div className="text-xl font-bold tnum text-amber-400 mt-1">{a.openProposals}</div>
          <div className="text-[10px] text-muted-foreground">proposed / voting</div>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex items-center gap-2">
            <Gavel className="size-3.5 text-violet-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Open Cases</span>
          </div>
          <div className="text-xl font-bold tnum text-violet-400 mt-1">{a.openCases}</div>
          <div className="text-[10px] text-muted-foreground">filed / under review / hearing</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ruled Cases</span>
          </div>
          <div className="text-xl font-bold tnum text-emerald-400 mt-1">{a.ruledCases}</div>
          <div className="text-[10px] text-muted-foreground">with binding verdicts</div>
        </div>
      </div>

      {/* Constitution summary + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <ScrollText className="size-3" /> Constitution in Force
          </SectionLabel>
          {o.constitution ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{o.constitution.constitutionId}</span>
                <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium text-emerald-300 capitalize">
                  {o.constitution.status}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">v{o.constitution.version}</span>
              </div>
              <div className="text-[13px] font-semibold mb-1.5">{o.constitution.title}</div>
              <p className="text-[11px] text-foreground/70 leading-snug line-clamp-5 mb-2">
                {o.constitution.preamble}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <FileText className="size-2.5" /> {o.constitution.articleCount} articles
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw className="size-2.5" /> {o.constitution.amendmentCount} amendments
                </span>
                {o.constitution.ratifiedAt && (
                  <span>· ratified {fmtDate(o.constitution.ratifiedAt)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">No constitution ratified yet.</div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Gavel className="size-3" /> Recent Cases
          </SectionLabel>
          <div className="space-y-1.5">
            {o.recentCases.map((cs: any) => {
              const tMeta = CASE_TYPE_META[cs.caseType] ?? { color: "#a1a1aa", label: cs.caseType };
              const sMeta = CASE_STATUS_META[cs.status] ?? { color: "#a1a1aa", label: cs.status };
              return (
                <div key={cs.caseId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[9px] text-muted-foreground">{cs.caseId}</span>
                    <ColorPill color={tMeta.color} label={tMeta.label} />
                    <ColorPill color={sMeta.color} label={sMeta.label} />
                    <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(cs.filedAt)}</span>
                  </div>
                  <div className="text-[11px] font-medium leading-tight line-clamp-1">{cs.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span className="text-emerald-400">{cs.plaintiffName}</span>
                    <ArrowRight className="size-2.5" />
                    <span className="text-rose-400">{cs.defendantName}</span>
                  </div>
                </div>
              );
            })}
            {o.recentCases.length === 0 && (
              <div className="text-[11px] text-muted-foreground">No cases filed.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Vote className="size-3" /> Recent Proposals
          </SectionLabel>
          <div className="space-y-1.5">
            {o.recentProposals.map((p: any) => {
              const sMeta = PROPOSAL_STATUS_META[p.status] ?? { color: "#a1a1aa", label: p.status };
              return (
                <div key={p.proposalId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[9px] text-muted-foreground">{p.proposalId}</span>
                    <ColorPill color={sMeta.color} label={sMeta.label} />
                    <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(p.proposedAt)}</span>
                  </div>
                  <div className="text-[11px] font-medium leading-tight line-clamp-1">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>by <span className="text-foreground">{p.proposerName}</span></span>
                    <span className="text-emerald-400">{p.approveCount}✓</span>
                    <span className="text-rose-400">{p.rejectCount}✗</span>
                    <span className="text-muted-foreground">{p.abstainCount}∅</span>
                  </div>
                </div>
              );
            })}
            {o.recentProposals.length === 0 && (
              <div className="text-[11px] text-muted-foreground">No proposals submitted.</div>
            )}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="size-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary">GOVERNANCE PRINCIPLES</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-emerald-400 mb-0.5">Constitution</div>
            <div className="text-[10px] text-muted-foreground">Foundational rules — rights, obligations, procedures, limits, oversight. Ratified by the council.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-cyan-400 mb-0.5">Council</div>
            <div className="text-[10px] text-muted-foreground">Federated governance: governments, citizens, developers, scientists, NGOs. Quorum + approval thresholds.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-violet-400 mb-0.5">Courts</div>
            <div className="text-[10px] text-muted-foreground">Dispute resolution — false enforcement, evidence manipulation, license violations, reputation attacks.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-amber-400 mb-0.5">Proposals</div>
            <div className="text-[10px] text-muted-foreground">Change process — budgets, suspensions, amendments, treaties. Weighted voting; binding outcomes.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: CONSTITUTION
// ===========================================================================

function ConstitutionTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/governance-v2/constitution/constitution-v1")
      .then((d) => setData(d.constitution))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    api("/api/governance-v2/constitution/constitution-v1")
      .then((d) => setData(d.constitution))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  if (!data)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <ScrollText className="size-8 opacity-30" />
        <span className="text-xs">Constitution not found.</span>
        <button
          onClick={retry}
          className="mt-2 rounded-md border border-border bg-card/40 px-2.5 py-1 text-[11px] hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="px-4 py-2 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center gap-2">
        <ScrollText className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">{data.title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{data.constitutionId}</span>
        <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium text-emerald-300 capitalize">{data.status}</span>
        <span className="font-mono text-[9px] text-muted-foreground">v{data.version}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {data.articleCount} articles · {data.amendmentCount} amendments
          {data.ratifiedAt && ` · ratified ${fmtDate(data.ratifiedAt)}`}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Preamble */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Preamble</span>
          </div>
          <p className="text-[12px] text-foreground/80 leading-relaxed italic">{data.preamble}</p>
        </div>

        {/* Articles */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <FileText className="size-3" /> Articles
          </SectionLabel>
          <div className="space-y-1.5">
            {data.articles?.map((art: any) => {
              const cMeta = ARTICLE_CATEGORY_META[art.category] ?? { color: "#a1a1aa", label: art.category };
              const eMeta = ENFORCEMENT_META[art.enforcementMechanism] ?? { color: "#a1a1aa", label: art.enforcementMechanism };
              return (
                <div key={art.articleId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{art.articleId}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">#{art.number}</span>
                    <ColorPill color={cMeta.color} label={cMeta.label} />
                    <span className="text-[9px] text-muted-foreground">governs:</span>
                    <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono text-foreground/80">{art.governs}</span>
                    <span className="text-[9px] text-muted-foreground">enforcement:</span>
                    <ColorPill color={eMeta.color} label={eMeta.label} />
                    <span className="ml-auto text-[9px] text-muted-foreground capitalize">{art.status}</span>
                  </div>
                  <div className="text-[13px] font-semibold mb-1">{art.title}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug">{art.body}</p>
                </div>
              );
            })}
            {(!data.articles || data.articles.length === 0) && (
              <div className="text-[11px] text-muted-foreground">No articles.</div>
            )}
          </div>
        </div>

        {/* Amendments */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <RefreshCw className="size-3" /> Recent Amendments
          </SectionLabel>
          <div className="space-y-1.5">
            {data.recentAmendments?.map((am: any) => {
              const aMeta = AMENDMENT_TYPE_META[am.amendmentType] ?? { color: "#a1a1aa", label: am.amendmentType };
              const total = (am.voteCount ?? 0);
              const approve = am.approveCount ?? 0;
              const reject = am.rejectCount ?? 0;
              const approvePct = total > 0 ? (approve / total) * 100 : 0;
              return (
                <div key={am.amendmentId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{am.amendmentId}</span>
                    <ColorPill color={aMeta.color} label={aMeta.label} />
                    <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium capitalize",
                      am.status === "ratified" ? "bg-emerald-500/10 text-emerald-300" :
                      am.status === "rejected" ? "bg-rose-500/10 text-rose-300" :
                      "bg-amber-500/10 text-amber-300")}>
                      {am.status}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-auto">{timeAgo(am.proposedAt)}</span>
                  </div>
                  <div className="text-[12px] font-medium mb-0.5">{am.title}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{am.description}</p>
                  {am.proposedText && (
                    <div className="rounded border border-border bg-card/30 px-2 py-1.5 mb-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Proposed Text</div>
                      <p className="text-[10px] text-foreground/70 leading-snug italic line-clamp-3">{am.proposedText}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-muted-foreground">
                      proposed by <span className="text-foreground">{am.proposerName}</span>
                    </span>
                    {total > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="size-2.5 text-emerald-400" />
                          <span className="font-mono text-emerald-400">{approve}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="size-2.5 text-rose-400" />
                          <span className="font-mono text-rose-400">{reject}</span>
                        </div>
                        <div className="w-16 h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <div className="h-full bg-emerald-400" style={{ width: `${approvePct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {(!data.recentAmendments || data.recentAmendments.length === 0) && (
              <div className="text-[11px] text-muted-foreground">No amendments proposed.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: COUNCIL
// ===========================================================================

function CouncilTab() {
  const [councils, setCouncils] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [council, setCouncil] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/governance-v2/council")
      .then((d) => {
        setCouncils(d.councils);
        if (d.councils.length > 0) setSelectedId(d.councils[0].councilId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api(`/api/governance-v2/council/${encodeURIComponent(selectedId)}`)
      .then((d) => setCouncil(d.council))
      .catch(() => setCouncil(null));
    api(`/api/governance-v2/proposals?councilId=${encodeURIComponent(selectedId)}`)
      .then((d) => setProposals(d.proposals))
      .catch(() => setProposals([]));
  }, [selectedId]);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      {/* Council switcher */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Users className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Governance Council</span>
        <div className="flex items-center gap-1 ml-2">
          {councils.map((c) => {
            const active = c.councilId === selectedId;
            return (
              <button
                key={c.councilId}
                onClick={() => setSelectedId(c.councilId)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-all whitespace-nowrap border",
                  active
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">{councils.length} councils</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-4">
        {!council ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Council summary card */}
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Landmark className="size-4 text-primary" />
                <span className="text-[13px] font-semibold">{council.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{council.councilId}</span>
                <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground capitalize">
                  {council.councilType}
                </span>
                <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground capitalize">
                  scope: {council.scope}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  established {council.establishedAt ? fmtDate(council.establishedAt) : "—"}
                </span>
              </div>
              <p className="text-[11px] text-foreground/70 leading-snug mb-2.5">{council.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Seats</div>
                  <div className="text-[13px] font-mono font-semibold">
                    <span className="text-emerald-400">{council.memberCount}</span>
                    <span className="text-muted-foreground">/{council.seatCount}</span>
                  </div>
                </div>
                <div className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Quorum</div>
                  <div className="text-[13px] font-mono font-semibold text-amber-400">
                    {(council.quorumThreshold * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Approval</div>
                  <div className="text-[13px] font-mono font-semibold text-violet-400">
                    {(council.approvalThreshold * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="text-[13px] font-semibold text-emerald-400 capitalize">{council.status}</div>
                </div>
              </div>
            </div>

            {/* Members + Proposals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Users className="size-3" /> Members ({council.members?.length ?? 0})
                </SectionLabel>
                <div className="space-y-1">
                  {council.members?.map((m: any) => {
                    const meta = CONSTITUENCY_META[m.constituencyType] ?? { color: "#a1a1aa", label: m.constituencyType, icon: User };
                    const Icon = meta.icon;
                    return (
                      <div key={m.memberId} className="flex items-center gap-2 text-[11px] py-1 rounded hover:bg-card/30 px-1.5">
                        <span className="flex size-5 items-center justify-center rounded" style={{ background: `${meta.color}1a`, color: meta.color }}>
                          <Icon className="size-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{m.representativeName}</div>
                          <div className="text-[9px] text-muted-foreground truncate">{m.constituencyName}</div>
                        </div>
                        <ColorPill color={meta.color} label={meta.label} />
                        <span className="font-mono text-[10px] text-muted-foreground">×{m.votingWeight.toFixed(1)}</span>
                        {m.termEnd && (
                          <span className="text-[9px] text-muted-foreground">term {fmtDate(m.termEnd)}</span>
                        )}
                      </div>
                    );
                  })}
                  {(!council.members || council.members.length === 0) && (
                    <div className="text-[11px] text-muted-foreground">No members seated.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card/40 p-4">
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Vote className="size-3" /> Recent Proposals ({proposals.length})
                </SectionLabel>
                <div className="space-y-1.5">
                  {proposals.map((p: any) => {
                    const sMeta = PROPOSAL_STATUS_META[p.status] ?? { color: "#a1a1aa", label: p.status };
                    const tMeta = PROPOSAL_TYPE_META[p.proposalType] ?? { color: "#a1a1aa", label: p.proposalType };
                    const total = (p.voteCount ?? 0);
                    const approvePct = total > 0 ? (p.approveCount / total) * 100 : 0;
                    const rejectPct = total > 0 ? (p.rejectCount / total) * 100 : 0;
                    return (
                      <div key={p.proposalId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-mono text-[9px] text-muted-foreground">{p.proposalId}</span>
                          <ColorPill color={tMeta.color} label={tMeta.label} />
                          <ColorPill color={sMeta.color} label={sMeta.label} />
                          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(p.proposedAt)}</span>
                        </div>
                        <div className="text-[11px] font-medium leading-tight line-clamp-1 mb-1">{p.title}</div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="size-2.5" /> {p.approveCount}
                          </span>
                          <span className="flex items-center gap-1 text-rose-400">
                            <XCircle className="size-2.5" /> {p.rejectCount}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MinusCircle className="size-2.5" /> {p.abstainCount}
                          </span>
                          {total > 0 && (
                            <div className="flex-1 flex h-1 rounded-full overflow-hidden bg-foreground/10">
                              <div className="bg-emerald-400" style={{ width: `${approvePct}%` }} />
                              <div className="bg-rose-400" style={{ width: `${rejectPct}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {proposals.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">No proposals from this council.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: COURTS
// ===========================================================================

function CourtsTab() {
  const [courts, setCourts] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api("/api/governance-v2/courts"),
      api("/api/governance-v2/cases"),
    ])
      .then(([c, cs]) => {
        setCourts(c.courts);
        setCases(cs.cases);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Gavel className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Intelligence Courts</span>
        <span className="text-[11px] text-muted-foreground">— dispute resolution: false enforcement, evidence manipulation, license violations, reputation attacks</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {courts.length} courts · {cases.length} cases
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-4">
        {/* Courts strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {courts.map((c) => {
            const jMeta = JURISDICTION_META[c.jurisdiction] ?? { color: "#a1a1aa", label: c.jurisdiction };
            return (
              <div key={c.courtId} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex size-7 items-center justify-center rounded" style={{ background: `${jMeta.color}1a`, color: jMeta.color }}>
                    <Landmark className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold truncate">{c.name}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">{c.courtId}</div>
                  </div>
                  <ColorPill color={jMeta.color} label={jMeta.label} />
                </div>
                <p className="text-[10px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{c.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-2.5" /> {c.justiceCount} justices
                  </span>
                  <span className="capitalize">scope: {c.scope}</span>
                </div>
              </div>
            );
          })}
          {courts.length === 0 && (
            <div className="text-[11px] text-muted-foreground col-span-full">No courts established.</div>
          )}
        </div>

        {/* Cases */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <FileText className="size-3" /> Cases ({cases.length})
          </SectionLabel>
          <div className="space-y-1.5">
            {cases.map((cs) => (
              <CaseCard key={cs.caseId} courtCase={cs} courts={courts} />
            ))}
            {cases.length === 0 && (
              <div className="text-[11px] text-muted-foreground">No cases filed.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseCard({ courtCase: cs, courts }: { courtCase: any; courts: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggle = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!detail) {
      setLoadingDetail(true);
      api(`/api/governance-v2/cases/${encodeURIComponent(cs.caseId)}`)
        .then((d) => setDetail(d.case))
        .catch(() => setDetail(null))
        .finally(() => setLoadingDetail(false));
    }
  }, [expanded, detail, cs.caseId]);

  const tMeta = CASE_TYPE_META[cs.caseType] ?? { color: "#a1a1aa", label: cs.caseType };
  const sMeta = CASE_STATUS_META[cs.status] ?? { color: "#a1a1aa", label: cs.status };
  const courtName = courts.find((c) => c.courtId === cs.courtId)?.name ?? cs.courtId;

  return (
    <div className="rounded-lg border border-border bg-card/40">
      <button
        onClick={toggle}
        className="w-full text-left px-3 py-2.5 hover:bg-card/20 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-[10px] font-semibold text-muted-foreground">{cs.caseId}</span>
          <ColorPill color={tMeta.color} label={tMeta.label} />
          <ColorPill color={sMeta.color} label={sMeta.label} />
          <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground">{courtName}</span>
          {cs.damagesClaimed > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-400">
              <Banknote className="size-2.5" /> {cs.damagesClaimed} IC claimed
            </span>
          )}
          {cs.damagesAwarded > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-emerald-400">
              <Banknote className="size-2.5" /> {cs.damagesAwarded} IC awarded
            </span>
          )}
          <span className="ml-auto text-[9px] text-muted-foreground">filed {timeAgo(cs.filedAt)}</span>
          <ArrowRight className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
        <div className="text-[12px] font-medium leading-tight mb-1">{cs.title}</div>
        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          <span className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5">
            <span className="text-[9px] text-muted-foreground">plaintiff:</span>{" "}
            <span className="text-emerald-300 font-medium">{cs.plaintiffName}</span>
            <span className="text-[9px] text-muted-foreground"> ({cs.plaintiffType})</span>
          </span>
          <span className="text-muted-foreground">vs.</span>
          <span className="rounded border border-rose-500/20 bg-rose-500/5 px-1.5 py-0.5">
            <span className="text-[9px] text-muted-foreground">defendant:</span>{" "}
            <span className="text-rose-300 font-medium">{cs.defendantName}</span>
            <span className="text-[9px] text-muted-foreground"> ({cs.defendantType})</span>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2.5">
          {loadingDetail && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading case detail…
            </div>
          )}
          {detail && (
            <>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Description</div>
                <p className="text-[11px] text-foreground/70 leading-snug">{detail.description}</p>
              </div>

              {detail.evidenceArtifacts && detail.evidenceArtifacts.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Evidence Artifacts</div>
                  <div className="flex flex-wrap gap-1">
                    {detail.evidenceArtifacts.map((a: string) => (
                      <span key={a} className="rounded bg-foreground/5 px-1.5 py-0.5 text-[9px] font-mono text-foreground/80">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {detail.verdict ? (
                <VerdictBlock verdict={detail.verdict} />
              ) : (
                <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-amber-400" />
                  <span className="text-[11px] text-amber-300">
                    Case is {cs.status.replace("_", " ")} — no verdict issued yet.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VerdictBlock({ verdict: v }: { verdict: any }) {
  const rMeta = VERDICT_RULING_META[v.ruling] ?? { color: "#a1a1aa", label: v.ruling };
  const totalJustices = v.justiceCount ?? 0;
  const concurring = v.concurringVotes ?? 0;
  const dissenting = v.dissentingVotes ?? 0;
  return (
    <div className="rounded border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Gavel className="size-3.5 text-primary" />
        <span className="text-[10px] font-mono text-muted-foreground">{v.verdictId}</span>
        <ColorPill color={rMeta.color} label={rMeta.label} />
        {v.ruledAt && (
          <span className="text-[9px] text-muted-foreground ml-auto">ruled {fmtDate(v.ruledAt)}</span>
        )}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Summary</div>
        <p className="text-[11px] text-foreground/80 leading-snug font-medium">{v.summary}</p>
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Reasoning</div>
        <p className="text-[11px] text-foreground/70 leading-snug">{v.reasoning}</p>
      </div>

      {/* Vote split */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-card/40 px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Justices</div>
          <div className="text-[14px] font-mono font-bold">{totalJustices}</div>
        </div>
        <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-center">
          <div className="text-[9px] text-emerald-400 uppercase">Concurring</div>
          <div className="text-[14px] font-mono font-bold text-emerald-400">{concurring}</div>
        </div>
        <div className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 text-center">
          <div className="text-[9px] text-rose-400 uppercase">Dissenting</div>
          <div className="text-[14px] font-mono font-bold text-rose-400">{dissenting}</div>
        </div>
      </div>

      {/* Remedies */}
      {v.remedies && v.remedies.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Remedies</div>
          <div className="space-y-1">
            {v.remedies.map((r: any, i: number) => (
              <div key={i} className="rounded border border-border bg-card/40 px-2 py-1.5 flex items-center gap-2 text-[10px] flex-wrap">
                <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] font-medium text-violet-300">
                  {r.type.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground">target:</span>
                <span className="font-mono text-foreground">{r.target}</span>
                <span className="text-muted-foreground">action:</span>
                <span className="font-mono text-foreground/80">{r.action.replace(/_/g, " ")}</span>
                {r.amount > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-400 ml-auto">
                    <Banknote className="size-2.5" /> {r.amount} IC
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Damages */}
      {v.damagesAwarded > 0 && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
          <Banknote className="size-3.5 text-emerald-400" />
          <span className="text-[11px] text-muted-foreground">Damages awarded:</span>
          <span className="text-[14px] font-mono font-bold text-emerald-400">{v.damagesAwarded} IC</span>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// TAB: PROPOSALS
// ===========================================================================

function ProposalsTab() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("proposalType", typeFilter);
    const q = params.toString() ? `?${params.toString()}` : "";
    api(`/api/governance-v2/proposals${q}`)
      .then((d) => setProposals(d.proposals))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Vote className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Governance Proposals</span>
        <span className="text-[11px] text-muted-foreground">— council voting on budgets, suspensions, amendments, treaties</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{proposals.length} proposals</span>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground">status:</span>
        <button
          onClick={() => setStatusFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium border transition-colors",
            statusFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(PROPOSAL_STATUS_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-medium border transition-colors",
              statusFilter === k ? "text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
            style={statusFilter === k ? { color: m.color, background: `${m.color}1a`, borderColor: `${m.color}33` } : undefined}
          >
            {m.label}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-3">type:</span>
        <button
          onClick={() => setTypeFilter("")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium border transition-colors",
            typeFilter === "" ? "bg-primary/15 text-primary border-primary/30" : "bg-card/40 text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          all
        </button>
        {Object.entries(PROPOSAL_TYPE_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setTypeFilter(k)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-medium border transition-colors",
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
        {!loading && proposals.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Vote className="size-8 opacity-30" />
            <span className="text-xs">No proposals match the filters.</span>
          </div>
        )}
        {proposals.map((p) => (
          <ProposalRow key={p.proposalId} proposal={p} />
        ))}
      </div>
    </div>
  );
}

function ProposalRow({ proposal: p }: { proposal: any }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const sMeta = PROPOSAL_STATUS_META[p.status] ?? { color: "#a1a1aa", label: p.status };
  const tMeta = PROPOSAL_TYPE_META[p.proposalType] ?? { color: "#a1a1aa", label: p.proposalType };
  const total = (p.voteCount ?? 0);
  const approvePct = total > 0 ? (p.approveCount / total) * 100 : 0;
  const rejectPct = total > 0 ? (p.rejectCount / total) * 100 : 0;
  const weightedTotal = (p.weightedApprove ?? 0) + (p.weightedReject ?? 0);
  const weightedApprovePct = weightedTotal > 0 ? ((p.weightedApprove ?? 0) / weightedTotal) * 100 : 0;

  const toggle = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!detail) {
      setLoadingDetail(true);
      api(`/api/governance-v2/proposals/${encodeURIComponent(p.proposalId)}`)
        .then((d) => setDetail(d.proposal))
        .catch(() => setDetail(null))
        .finally(() => setLoadingDetail(false));
    }
  }, [expanded, detail, p.proposalId]);

  return (
    <div className="rounded-lg border border-border bg-card/40">
      <button onClick={toggle} className="w-full text-left px-3 py-2.5 hover:bg-card/20 transition-colors">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-[10px] font-semibold text-muted-foreground">{p.proposalId}</span>
          <ColorPill color={tMeta.color} label={tMeta.label} />
          <ColorPill color={sMeta.color} label={sMeta.label} />
          <span className="ml-auto text-[9px] text-muted-foreground">
            proposed {timeAgo(p.proposedAt)}
            {p.enactedAt && ` · enacted ${timeAgo(p.enactedAt)}`}
          </span>
          <ArrowRight className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
        <div className="text-[12px] font-medium leading-tight mb-1">{p.title}</div>
        <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{p.description}</p>

        {/* Proposer + vote tally */}
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <span className="text-muted-foreground">
            by <span className="text-foreground font-medium">{p.proposerName}</span>
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">{p.councilId}</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-emerald-400">
              <CheckCircle2 className="size-2.5" /> {p.approveCount}
            </span>
            <span className="flex items-center gap-0.5 text-rose-400">
              <XCircle className="size-2.5" /> {p.rejectCount}
            </span>
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <MinusCircle className="size-2.5" /> {p.abstainCount}
            </span>
            <span className="text-[9px] text-muted-foreground">{total} total votes</span>
          </div>
          {total > 0 && (
            <div className="flex-1 min-w-[80px] flex h-1.5 rounded-full overflow-hidden bg-foreground/10">
              <div className="bg-emerald-400" style={{ width: `${approvePct}%` }} />
              <div className="bg-rose-400" style={{ width: `${rejectPct}%` }} />
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          {loadingDetail && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading votes…
            </div>
          )}
          {detail && (
            <>
              {/* Details JSON */}
              {detail.details && Object.keys(detail.details).length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Proposal Details</div>
                  <div className="rounded border border-border bg-card/40 px-2 py-1.5 grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[10px]">
                    {Object.entries(detail.details).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-mono text-foreground/80">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weighted vote bar */}
              {weightedTotal > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Weighted Vote Split</div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-foreground/10">
                    <div className="bg-emerald-400" style={{ width: `${weightedApprovePct}%` }} />
                    <div className="bg-rose-400" style={{ width: `${100 - weightedApprovePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] mt-0.5">
                    <span className="text-emerald-400 font-mono">{(p.weightedApprove ?? 0).toFixed(1)} weighted approve ({weightedApprovePct.toFixed(0)}%)</span>
                    <span className="text-rose-400 font-mono">{(p.weightedReject ?? 0).toFixed(1)} weighted reject</span>
                  </div>
                </div>
              )}

              {/* Individual votes */}
              {detail.votes && detail.votes.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                    Individual Votes ({detail.votes.length})
                  </div>
                  <div className="space-y-0.5">
                    {detail.votes.map((v: any) => {
                      const voteColor =
                        v.vote === "approve" ? "#34d399" :
                        v.vote === "reject" ? "#f43f5e" : "#a1a1aa";
                      const VoteIcon =
                        v.vote === "approve" ? CheckCircle2 :
                        v.vote === "reject" ? XCircle : MinusCircle;
                      return (
                        <div key={v.voteId} className="flex items-center gap-2 text-[10px] py-0.5 rounded hover:bg-card/30 px-1.5">
                          <VoteIcon className="size-3 shrink-0" style={{ color: voteColor }} />
                          <span className="font-medium flex-1 truncate">{v.memberName}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">×{v.votingWeight?.toFixed(1) ?? "1.0"}</span>
                          <span className="rounded px-1 py-0.5 text-[9px] font-medium capitalize" style={{ color: voteColor, background: `${voteColor}1a` }}>
                            {v.vote}
                          </span>
                          {v.rationale && (
                            <span className="text-[9px] text-muted-foreground italic max-w-[200px] truncate">"{v.rationale}"</span>
                          )}
                          <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(v.votedAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
