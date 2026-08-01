"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Coins,
  FileBadge,
  GitFork,
  TrendingUp,
  Bot,
  Umbrella,
  Loader2,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
  Award,
  Brain,
  Users,
  Satellite,
  CheckCircle2,
  Target,
  Clock,
  Zap,
} from "lucide-react";

const LICENSE_TYPE_META: Record<string, { color: string; label: string }> = {
  open_intelligence: { color: "#34d399", label: "Open Intelligence" },
  government_only: { color: "#fbbf24", label: "Government Only" },
  commercial: { color: "#22d3ee", label: "Commercial" },
  exclusive: { color: "#f43f5e", label: "Exclusive" },
  time_limited_exclusive: { color: "#a78bfa", label: "Time-Limited Exclusive" },
};

const TIER_META: Record<string, { color: string; label: string }> = {
  amateur: { color: "#a1a1aa", label: "Amateur" },
  emerging: { color: "#fbbf24", label: "Emerging" },
  professional: { color: "#22d3ee", label: "Professional" },
  expert: { color: "#34d399", label: "Expert" },
  elite: { color: "#f43f5e", label: "Elite" },
};

const TX_TYPE_META: Record<string, { color: string; icon: React.ElementType }> = {
  deposit: { color: "#34d399", icon: ArrowDownLeft },
  purchase: { color: "#22d3ee", icon: ArrowUpRight },
  reward: { color: "#fbbf24", icon: Award },
  royalty: { color: "#a78bfa", icon: GitFork },
  platform_fee: { color: "#71717a", icon: DollarSign },
};

const PRODUCER_TYPE_ICON: Record<string, React.ElementType> = {
  citizen: Users,
  agent: Brain,
  sensor: Satellite,
  organization: ShieldCheck,
};

type Tab = "overview" | "credits" | "licensing" | "lineage" | "producers" | "agents" | "insurance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Coins },
  { id: "credits", label: "Credits Ledger", icon: DollarSign },
  { id: "licensing", label: "Licensing", icon: FileBadge },
  { id: "lineage", label: "Lineage & Royalties", icon: GitFork },
  { id: "producers", label: "Producer Scores", icon: TrendingUp },
  { id: "agents", label: "Agent Economy", icon: Bot },
  { id: "insurance", label: "Insurance", icon: Umbrella },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function FinanceView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Coins className="size-4 text-primary" /> Intelligence Finance
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: intelligence-finance
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Credits · Licensing · Lineage royalties · Producer scores · Agent economy · Insurance
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
        {tab === "credits" && <CreditsTab />}
        {tab === "licensing" && <LicensingTab />}
        {tab === "lineage" && <LineageTab />}
        {tab === "producers" && <ProducersTab />}
        {tab === "agents" && <AgentsTab />}
        {tab === "insurance" && <InsuranceTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => { api("/api/finance").then((d) => setPackages(d.packages)).catch(() => {}); }, []);
  if (packages.length === 0) return null;
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
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

  useEffect(() => {
    api("/api/finance").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Credits in Circulation" value={o.economy.creditsInCirculation.toLocaleString()} sub="IC units" accent="#fbbf24" />
        <MetricStat label="Total Deposited" value={o.economy.totalDeposited.toLocaleString()} sub="consumer budgets" accent="#34d399" />
        <MetricStat label="Agent Revenue" value={o.economy.totalAgentRevenue.toLocaleString()} sub="AI earnings" accent="#a78bfa" />
        <MetricStat label="Royalties Paid" value={o.economy.totalRoyalties.toFixed(0)} sub="lineage distributions" accent="#22d3ee" />
        <MetricStat label="Credit Accounts" value={o.counts.accounts} sub="producers + consumers" accent="#f43f5e" />
        <MetricStat label="Open Policies" value={o.economy.openPolicies} sub="insurance markets" accent="#fb923c" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><TrendingUp className="size-3" /> Top Producers by Market Score</SectionLabel>
          <div className="space-y-1">
            {o.topProducers.map((p: any, i: number) => {
              const tier = TIER_META[p.marketTier] ?? TIER_META.amateur;
              const Icon = PRODUCER_TYPE_ICON[p.producerType] ?? Users;
              return (
                <div key={p.producerId} className="flex items-center gap-2 text-[11px] py-1">
                  <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                  <Icon className="size-3" style={{ color: tier.color }} />
                  <span className="flex-1 truncate">{p.producerName}</span>
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                  <span className="font-mono text-[14px] font-bold" style={{ color: tier.color }}>{p.marketScore.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Finance Components</SectionLabel>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {[
              { label: "Credit Accounts", value: o.counts.accounts, icon: DollarSign, color: "#fbbf24" },
              { label: "Transactions", value: o.counts.transactions, icon: ArrowRight, color: "#22d3ee" },
              { label: "Licenses", value: o.counts.licenses, icon: FileBadge, color: "#34d399" },
              { label: "Asset Lineages", value: o.counts.lineages, icon: GitFork, color: "#a78bfa" },
              { label: "Royalty Distributions", value: o.counts.royalties, icon: Award, color: "#fb923c" },
              { label: "Producer Scores", value: o.counts.scores, icon: TrendingUp, color: "#f43f5e" },
              { label: "Agent Revenue Records", value: o.counts.agentRevenue, icon: Bot, color: "#38bdf8" },
              { label: "Insurance Policies", value: o.counts.policies, icon: Umbrella, color: "#84cc16" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded border border-border bg-card/30 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3" style={{ color }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
                <div className="font-mono text-[16px] font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="size-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary">INTELLIGENCE FINANCE PROTOCOL</span>
        </div>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          Intelligence Credits are a <span className="text-primary font-medium">non-speculative accounting unit</span> — not cryptocurrency.
          Consumers deposit credits (budget), producers earn them (rewards/royalties/sales). Every asset has a <span className="text-primary font-medium">license</span> defining
          ownership and usage terms. When intelligence is derived from other intelligence (asset lineage), <span className="text-primary font-medium">royalties</span> flow
          to original contributors — like intellectual property. <span className="text-primary font-medium">Producer Market Scores</span> enable professional intelligence
          producers. <span className="text-primary font-medium">Agents earn revenue</span> with allocation splits (developer 70% / training data 15% / infrastructure 10% / platform 5%).
          <span className="text-primary font-medium"> Insurance</span> creates prediction markets — producers predict outcomes, payouts based on accuracy.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: CREDITS LEDGER
// ===========================================================================

function CreditsTab() {
  const [data, setData] = useState<{ accounts: any[]; transactions: any[] }>({ accounts: [], transactions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/finance/credits").then((d) => setData({ accounts: d.accounts, transactions: d.transactions })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex">
      {/* Accounts */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <DollarSign className="size-4 text-amber-400" />
          <span className="text-xs font-semibold">Credit Accounts</span>
          <span className="text-[11px] text-muted-foreground">— Intelligence Credits (IC) balances</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {data.accounts.map((a) => (
            <div key={a.accountId} className="rounded-lg border border-border bg-card/40 px-3 py-2 flex items-center gap-3">
              <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0",
                a.ownerType === "organization" ? "bg-emerald-500/10 text-emerald-400" :
                a.ownerType === "agent" ? "bg-violet-500/10 text-violet-400" :
                a.ownerType === "citizen" ? "bg-cyan-500/10 text-cyan-400" : "bg-foreground/10 text-muted-foreground")}>
                {a.ownerType === "organization" ? <ShieldCheck className="size-4" /> : a.ownerType === "agent" ? <Bot className="size-4" /> : <Users className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium truncate">{a.ownerName}</div>
                <div className="text-[9px] text-muted-foreground">{a.ownerType} · {a.accountId}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[16px] font-bold font-mono text-amber-400">{a.balance.toLocaleString()} <span className="text-[9px] text-muted-foreground">IC</span></div>
                <div className="text-[9px] text-muted-foreground">
                  earned {a.totalEarned.toFixed(0)} · spent {a.totalSpent.toFixed(0)} · deposited {a.totalDeposited.toFixed(0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        <div className="px-3 py-2 border-b border-border"><SectionLabel>Transaction Ledger ({data.transactions.length})</SectionLabel></div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1">
          {data.transactions.map((t) => {
            const meta = TX_TYPE_META[t.type] ?? { color: "#a1a1aa", icon: ArrowRight };
            const Icon = meta.icon;
            return (
              <div key={t.transactionId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className="size-3" style={{ color: meta.color }} />
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{t.type}</span>
                  <span className="ml-auto font-mono text-[12px] font-bold" style={{ color: meta.color }}>+{t.amount.toFixed(0)} IC</span>
                </div>
                <div className="text-[10px] text-foreground/70">{t.description}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {t.fromOwnerName ?? "platform"} → {t.toOwnerName ?? "platform"}
                </div>
              </div>
            );
          })}
          {data.transactions.length === 0 && <div className="text-[11px] text-muted-foreground italic">No transactions yet</div>}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: LICENSING
// ===========================================================================

function LicensingTab() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/finance/licenses").then((d) => setLicenses(d.licenses)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <FileBadge className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Intelligence Licensing</span>
        <span className="text-[11px] text-muted-foreground">— ownership + usage terms per asset</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{licenses.length} licenses</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {licenses.map((l) => {
          const meta = LICENSE_TYPE_META[l.licenseType] ?? { color: "#a1a1aa", label: l.licenseType };
          return (
            <div key={l.licenseId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{l.licenseId}</span>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">asset: <span className="font-mono">{l.assetId}</span></span>
                <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(l.issuedAt)}</span>
              </div>
              <div className="text-[11px] mb-1.5">Owner: <span className="font-medium">{l.ownerName}</span></div>
              <div className="flex items-center gap-2 text-[9px] flex-wrap mb-1.5">
                <span className={cn("rounded px-1 py-0.5", l.commercialUse ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                  {l.commercialUse ? "✓" : "✗"} Commercial
                </span>
                <span className={cn("rounded px-1 py-0.5", l.governmentUse ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                  {l.governmentUse ? "✓" : "✗"} Government
                </span>
                <span className={cn("rounded px-1 py-0.5", l.redistributionAllowed ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                  {l.redistributionAllowed ? "✓" : "✗"} Redistribution
                </span>
                <span className={cn("rounded px-1 py-0.5", l.attributionRequired ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                  {l.attributionRequired ? "✓" : "✗"} Attribution
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground">Royalty rate:</span>
                <span className="font-mono font-semibold text-violet-400">{(l.royaltyRate * 100).toFixed(0)}%</span>
                <span className="text-muted-foreground">of downstream value</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: LINEAGE & ROYALTIES
// ===========================================================================

function LineageTab() {
  const [lineages, setLineages] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("/api/finance/lineage"), api("/api/finance/royalties")])
      .then(([l, r]) => { setLineages(l.lineages); setRoyalties(r.royalties); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-3 space-y-4">
      {/* Lineages */}
      <div>
        <SectionLabel className="mb-2 flex items-center gap-1.5"><GitFork className="size-3" /> Asset Lineage Chains ({lineages.length})</SectionLabel>
        <div className="space-y-1.5">
          {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-4 animate-spin text-primary" /></div>}
          {lineages.map((l) => (
            <div key={l.lineageId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{l.lineageId}</span>
                <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-300">{l.derivationType}</span>
                <span className="text-[10px] text-muted-foreground">depth {l.depth}</span>
                <span className="ml-auto text-[10px]">Asset: <span className="font-mono">{l.assetId}</span></span>
              </div>
              {/* Lineage chain visualization */}
              <div className="flex items-center gap-1 flex-wrap">
                {l.lineageChain.map((node: any, i: number) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={cn("rounded px-1.5 py-0.5 text-[9px] border",
                      node.role === "self" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card/30 text-muted-foreground")}>
                      {node.role === "self" ? "→ " : ""}{node.assetId.slice(0, 12)}
                      <span className="text-muted-foreground/60 ml-1">d{node.depth}</span>
                    </div>
                    {i < l.lineageChain.length - 1 && <ArrowRight className="size-2.5 text-muted-foreground/50" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Royalties */}
      <div>
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Award className="size-3" /> Royalty Distributions ({royalties.length})</SectionLabel>
        <div className="space-y-1.5">
          {royalties.map((r) => (
            <div key={r.royaltyId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] font-semibold text-violet-300">{r.royaltyId}</span>
                <span className="text-[10px] text-muted-foreground">from asset: <span className="font-mono">{r.sourceAssetId}</span></span>
                <span className="ml-auto font-mono text-[14px] font-bold text-violet-400">{r.totalRoyaltyAmount.toFixed(2)} IC</span>
              </div>
              <div className="space-y-0.5">
                {r.royaltyRecipients.map((rec: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] rounded border border-border/60 bg-card/20 px-2 py-0.5">
                    <span className="font-mono text-[9px] text-muted-foreground truncate flex-1">{rec.producerId}</span>
                    <span className="text-muted-foreground">depth {rec.depth}</span>
                    <span className="text-muted-foreground">rate {(rec.royaltyRate * 100).toFixed(0)}%</span>
                    <span className="font-mono font-semibold text-violet-400">{rec.amount.toFixed(2)} IC</span>
                  </div>
                ))}
              </div>
              {r.royaltyRecipients.length === 0 && <div className="text-[10px] text-muted-foreground italic">No recipients</div>}
            </div>
          ))}
          {royalties.length === 0 && !loading && (
            <div className="text-[11px] text-muted-foreground italic py-2">No royalty distributions yet — royalties flow when derivative assets generate value</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: PRODUCER SCORES
// ===========================================================================

function ProducersTab() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/finance/scores").then((d) => setScores(d.scores)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <TrendingUp className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Producer Market Scores</span>
        <span className="text-[11px] text-muted-foreground">— composite: trust + civic + IQS + value created</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{scores.length} producers</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {scores.map((s, i) => {
          const tier = TIER_META[s.marketTier] ?? TIER_META.amateur;
          const Icon = PRODUCER_TYPE_ICON[s.producerType] ?? Users;
          return (
            <div key={s.producerId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0")} style={{ color: tier.color, background: `${tier.color}1a` }}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-medium truncate">{s.producerName}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[9px]">
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Trust</span> <span className="font-mono font-semibold">{s.trustScore.toFixed(0)}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Civic</span> <span className="font-mono font-semibold">{s.civicScore.toFixed(0)}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">IQS</span> <span className="font-mono font-semibold">{s.iqsContribution.toFixed(0)}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Value</span> <span className="font-mono font-semibold text-amber-400">{s.valueCreated.toFixed(0)}</span></div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[22px] font-bold font-mono" style={{ color: tier.color }}>{s.marketScore.toFixed(0)}</div>
                  <div className="text-[9px] text-muted-foreground">market score</div>
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
// TAB: AGENT ECONOMY
// ===========================================================================

function AgentsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/finance/agents").then((d) => setAgents(d.agents)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Bot className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Agent Economy</span>
        <span className="text-[11px] text-muted-foreground">— agents as economic actors earning revenue</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{agents.length} agents</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {agents.map((a) => (
          <div key={a.agentId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="size-4 text-violet-400" />
              <span className="text-[12px] font-medium">{a.agentName}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{a.agentId}</span>
              <span className="ml-auto text-[18px] font-bold font-mono text-amber-400">{a.totalRevenue.toFixed(0)} <span className="text-[9px] text-muted-foreground">IC</span></span>
            </div>
            {/* Revenue allocation */}
            <div className="mb-2">
              <div className="text-[9px] text-muted-foreground mb-1">Revenue Allocation (total {a.totalRevenue.toFixed(0)} IC)</div>
              <div className="flex h-2 rounded-full overflow-hidden bg-foreground/10">
                <div className="h-full bg-violet-400" style={{ width: `${a.developerShare * 100}%` }} title={`Developer ${(a.developerShare * 100).toFixed(0)}%`} />
                <div className="h-full bg-cyan-400" style={{ width: `${a.trainingDataShare * 100}%` }} title={`Training Data ${(a.trainingDataShare * 100).toFixed(0)}%`} />
                <div className="h-full bg-amber-400" style={{ width: `${a.infrastructureShare * 100}%` }} title={`Infrastructure ${(a.infrastructureShare * 100).toFixed(0)}%`} />
                <div className="h-full bg-rose-400" style={{ width: `${a.platformShare * 100}%` }} title={`Platform ${(a.platformShare * 100).toFixed(0)}%`} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[9px]">
              <div className="rounded bg-violet-500/10 px-1.5 py-1 text-center">
                <div className="text-muted-foreground">Developer {(a.developerShare * 100).toFixed(0)}%</div>
                <div className="font-mono font-semibold text-violet-300">{a.developerPaid.toFixed(0)} IC</div>
              </div>
              <div className="rounded bg-cyan-500/10 px-1.5 py-1 text-center">
                <div className="text-muted-foreground">Training {(a.trainingDataShare * 100).toFixed(0)}%</div>
                <div className="font-mono font-semibold text-cyan-300">{a.trainingDataPaid.toFixed(0)} IC</div>
              </div>
              <div className="rounded bg-amber-500/10 px-1.5 py-1 text-center">
                <div className="text-muted-foreground">Infra {(a.infrastructureShare * 100).toFixed(0)}%</div>
                <div className="font-mono font-semibold text-amber-300">{a.infrastructurePaid.toFixed(0)} IC</div>
              </div>
              <div className="rounded bg-rose-500/10 px-1.5 py-1 text-center">
                <div className="text-muted-foreground">Platform {(a.platformShare * 100).toFixed(0)}%</div>
                <div className="font-mono font-semibold text-rose-300">{a.platformPaid.toFixed(0)} IC</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
              <span>{a.totalOutputs} outputs</span>
              <span>{a.totalConsumers} consumers</span>
              {a.lastEarnedAt && <span className="flex items-center gap-1"><Clock className="size-2.5" /> last earned {timeAgo(a.lastEarnedAt)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INSURANCE (Prediction Markets)
// ===========================================================================

function InsuranceTab() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPolicies = useCallback(() => {
    api("/api/finance/insurance").then((d) => {
      setPolicies(d.policies);
      if (d.policies.length > 0 && !selected) setSelected(d.policies[0].policyId);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selected]);

  const loadPredictions = useCallback((policyId: string) => {
    api(`/api/finance/insurance/${policyId}`).then((d) => setPredictions(d.predictions)).catch(() => {});
  }, []);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  useEffect(() => {
    if (selected) loadPredictions(selected);
  }, [selected, loadPredictions]);

  return (
    <div className="h-full flex">
      {/* Policy list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <Umbrella className="size-4 text-cyan-400" />
          <span className="text-xs font-semibold">Intelligence Insurance</span>
          <span className="text-[11px] text-muted-foreground">— prediction markets with accuracy-based payouts</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {policies.map((p) => {
            const active = selected === p.policyId;
            return (
              <button key={p.policyId} onClick={() => setSelected(p.policyId)}
                className={cn("w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-card/60")}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">{p.policyId}</span>
                  <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium",
                    p.status === "open" ? "bg-emerald-500/10 text-emerald-300" :
                    p.status === "resolved" ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300")}>{p.status}</span>
                  {p.outcome && <span className="rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-semibold capitalize">{p.outcome}</span>}
                  <span className="ml-auto font-mono text-[14px] font-bold text-amber-400">{p.totalPayout} IC</span>
                </div>
                <div className="text-[12px] font-medium mb-0.5">{p.title}</div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{p.insurerName}</span>
                  <span>· {p.category}</span>
                  <span>· {p.predictionCount} predictions</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Predictions panel */}
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        <div className="px-3 py-2 border-b border-border"><SectionLabel>Predictions {selected ? `· ${selected}` : ""}</SectionLabel></div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {predictions.map((p) => (
            <div key={p.predictionId} className="rounded-lg border border-border bg-card/40 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{p.predictionId}</span>
                <span className={cn("rounded px-1 py-0.5 text-[9px] font-semibold capitalize",
                  p.predictedOutcome === "confirmed" ? "bg-emerald-500/10 text-emerald-300" :
                  p.predictedOutcome === "denied" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300")}>
                  {p.predictedOutcome}
                </span>
                <span className="text-[10px] flex-1 truncate">{p.predictorName}</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground mb-1">
                <span>confidence {(p.confidence * 100).toFixed(0)}%</span>
                <span>trust {(p.trustScore * 100).toFixed(0)}%</span>
              </div>
              {p.reasoning && <div className="text-[10px] text-foreground/70 italic mb-1">{p.reasoning}</div>}
              {p.accuracyScore !== null && p.accuracyScore !== undefined && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] text-muted-foreground">accuracy:</span>
                  <span className="font-mono text-[10px] font-bold" style={{ color: p.accuracyScore >= 0.8 ? "#34d399" : p.accuracyScore >= 0.5 ? "#fbbf24" : "#f43f5e" }}>
                    {(p.accuracyScore * 100).toFixed(0)}%
                  </span>
                  <span className="ml-auto font-mono text-[12px] font-bold text-amber-400">+{p.payoutAmount.toFixed(0)} IC</span>
                </div>
              )}
            </div>
          ))}
          {predictions.length === 0 && <div className="text-[11px] text-muted-foreground italic">No predictions yet for this policy</div>}
        </div>
      </div>
    </div>
  );
}
