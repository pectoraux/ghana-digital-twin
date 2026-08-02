"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Store,
  Megaphone,
  Package,
  Target,
  DollarSign,
  Activity,
  Loader2,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Award,
  Users,
  Brain,
  Satellite,
  MapPin,
  Clock,
  Star,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  environmental_violation: { label: "Environmental Violation", color: "#f43f5e" },
  flood_risk: { label: "Flood Risk", color: "#38bdf8" },
  deforestation: { label: "Deforestation", color: "#84cc16" },
  crop_damage: { label: "Crop Damage", color: "#fbbf24" },
  water_pollution: { label: "Water Pollution", color: "#22d3ee" },
};

const PRODUCER_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  citizen: { color: "#34d399", icon: Users, label: "Citizen" },
  agent: { color: "#a78bfa", icon: Brain, label: "Agent" },
  sensor: { color: "#38bdf8", icon: Satellite, label: "Sensor" },
  organization: { color: "#fbbf24", icon: ShieldCheck, label: "Organization" },
};

const REQUESTER_TYPE_META: Record<string, { color: string; label: string }> = {
  government: { color: "#34d399", label: "Government" },
  corporate: { color: "#fbbf24", label: "Corporate" },
  ngo: { color: "#a78bfa", label: "NGO" },
  platform: { color: "#22d3ee", label: "Platform" },
  citizen: { color: "#34d399", label: "Citizen" },
};

const SHARE_META: Record<string, { color: string; label: string }> = {
  satellite: { color: "#38bdf8", label: "Satellite" },
  citizen: { color: "#34d399", label: "Citizen Reporter" },
  witness: { color: "#a78bfa", label: "Witnesses" },
  agent: { color: "#fbbf24", label: "AI Agent" },
  field: { color: "#fb923c", label: "Field Verifier" },
  platform: { color: "#71717a", label: "Platform" },
};

type Tab = "overview" | "demand" | "supply" | "bounties" | "attribution" | "transactions";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Store },
  { id: "demand", label: "Demand Feed", icon: Megaphone },
  { id: "supply", label: "Asset Catalog", icon: Package },
  { id: "bounties", label: "Bounties", icon: Target },
  { id: "attribution", label: "Value Attribution", icon: DollarSign },
  { id: "transactions", label: "Transactions", icon: Activity },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function MarketplaceView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Store className="size-4 text-primary" /> Intelligence Marketplace
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[14px] font-mono text-primary">
            package: intelligence-marketplace
          </span>
          <p className="text-[15px] text-muted-foreground hidden lg:block">
            Intelligence demand + supply + matching + value attribution + bounties
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
        {tab === "demand" && <DemandTab />}
        {tab === "supply" && <SupplyTab />}
        {tab === "bounties" && <BountiesTab />}
        {tab === "attribution" && <AttributionTab />}
        {tab === "transactions" && <TransactionsTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => { api("/api/marketplace").then((d) => setPackages(d.packages)).catch(() => {}); }, []);
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

  useEffect(() => {
    api("/api/marketplace").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Open Requests" value={o.active.openRequests} sub={`$${o.economy.requestBudget.toLocaleString()} budget`} accent="#f43f5e" />
        <MetricStat label="Listed Assets" value={o.active.listedAssets} sub="ranked by IQS" accent="#34d399" />
        <MetricStat label="Open Bounties" value={o.active.openBounties} sub={`$${o.economy.bountyBudget.toLocaleString()} budget`} accent="#fbbf24" />
        <MetricStat label="Transactions" value={o.counts.transactions} sub="completed" accent="#22d3ee" />
        <MetricStat label="Distributed" value={`$${o.economy.totalDistributed.toFixed(0)}`} sub="total value" accent="#a78bfa" />
        <MetricStat label="Attributions" value={o.counts.attributions} sub="value splits" accent="#fb923c" />
      </div>

      {/* Assets by category + requests by type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Assets by Category</SectionLabel>
          <div className="space-y-1.5">
            {o.assetsByCategory.map((c: any) => {
              const meta = CATEGORY_META[c.category] ?? { color: "#a1a1aa" };
              return (
                <div key={c.category} className="flex items-center gap-2 text-[15px]">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1">{meta.label ?? c.category}</span>
                  <span className="font-mono font-semibold">{c._count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Requests by Requester Type</SectionLabel>
          <div className="space-y-1.5">
            {o.requestsByType.map((r: any) => {
              const meta = REQUESTER_TYPE_META[r.requesterType] ?? { color: "#a1a1aa" };
              return (
                <div key={r.requesterType} className="flex items-center gap-2 text-[15px]">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1">{meta.label ?? r.requesterType}</span>
                  <span className="font-mono font-semibold">{r._count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top assets + recent bounties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><TrendingUp className="size-3" /> Top Assets by IQS</SectionLabel>
          <div className="space-y-1">
            {o.topAssets.map((a: any, i: number) => {
              const meta = PRODUCER_TYPE_META[a.producerType] ?? PRODUCER_TYPE_META.citizen;
              const Icon = meta.icon;
              return (
                <div key={a.assetId} className="flex items-center gap-2 text-[15px] py-1">
                  <span className="font-mono text-[18px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                  <Icon className="size-3" style={{ color: meta.color }} />
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className="font-mono font-semibold" style={{ color: meta.color }}>{(a.iqs * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground">{a.price === 0 ? "free" : `$${a.price}`}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Target className="size-3" /> Recent Bounties</SectionLabel>
          <div className="space-y-1">
            {o.recentBounties.map((b: any) => (
              <div key={b.bountyId} className="flex items-center gap-2 text-[15px] py-1">
                <Target className="size-3 text-amber-400" />
                <span className="flex-1 truncate">{b.title}</span>
                <span className="font-mono font-semibold text-amber-400">${b.totalBudget}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Store className="size-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">INTELLIGENCE MARKETPLACE</span>
        </div>
        <p className="text-[15px] text-foreground/80 leading-relaxed">
          The marketplace turns intelligence into a tradable asset. Organizations post <span className="text-primary font-medium">requests</span> (demand) —
          what intelligence they need and their budget. Producers publish <span className="text-primary font-medium">assets</span> (supply) — citizen reports,
          agent outputs, satellite feeds. The matching engine connects them. <span className="text-primary font-medium">Value attribution</span> splits rewards
          across all contributors: satellite 30% + citizen 25% + witnesses 20% + agent 15% + field 10%. <span className="text-primary font-medium">Bounties</span>
          enable active production — an org posts a problem, producers submit intelligence, rewards are distributed on verification.
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-[14px]">
          <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">Intelligence Quality Score = trust + accuracy + evidence + freshness + cost</span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: DEMAND FEED (Intelligence Requests)
// ===========================================================================

function DemandTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/marketplace/requests").then((d) => setRequests(d.requests)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Megaphone className="size-4 text-rose-400" />
        <span className="text-xs font-semibold">Intelligence Demand</span>
        <span className="text-[15px] text-muted-foreground">— organizations post what intelligence they need</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{requests.length} requests</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {requests.map((r) => {
          const catMeta = CATEGORY_META[r.category] ?? { color: "#a1a1aa" };
          const typeMeta = REQUESTER_TYPE_META[r.requesterType] ?? { color: "#a1a1aa" };
          return (
            <div key={r.requestId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: catMeta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[14px] font-semibold text-muted-foreground">{r.requestId}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: typeMeta.color, background: `${typeMeta.color}1a` }}>{typeMeta.label}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: catMeta.color, background: `${catMeta.color}1a` }}>{catMeta.label ?? r.category}</span>
                    <span className={cn("rounded px-1 py-0.5 text-[13px] font-medium", r.status === "open" ? "bg-emerald-500/10 text-emerald-300" : "bg-foreground/10 text-muted-foreground")}>{r.status}</span>
                    <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="text-[16px] font-medium mb-0.5">{r.title}</div>
                  <p className="text-[15px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{r.description}</p>
                  <div className="flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {r.geography}</span>
                    <span className="flex items-center gap-1"><Clock className="size-2.5" /> {r.timeframe}</span>
                    <span>min conf <span className="font-mono font-semibold">{(r.minConfidence * 100).toFixed(0)}%</span></span>
                    {r.evidenceRequired.length > 0 && <span>evidence: {r.evidenceRequired.join(" + ")}</span>}
                    <span className="flex items-center gap-1 text-emerald-400"><DollarSign className="size-2.5" /> budget ${r.budget.toLocaleString()}</span>
                    <span className="text-amber-400">${r.pricePerAsset}/asset</span>
                    {r.matchCount > 0 && <span className="text-cyan-400">{r.matchCount} matches</span>}
                  </div>
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
// TAB: ASSET CATALOG (Supply, ranked by IQS)
// ===========================================================================

function SupplyTab() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api("/api/marketplace/assets").then((d) => setAssets(d.assets)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (assetId: string) => {
    setBusy(assetId);
    try {
      await api(`/api/marketplace/assets/${assetId}/purchase`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: "demo-buyer", buyerName: "Demo Buyer" }),
      });
      // refresh
      api("/api/marketplace/assets").then((d) => setAssets(d.assets));
    } finally { setBusy(null); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Package className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Intelligence Assets</span>
        <span className="text-[15px] text-muted-foreground">— ranked by Intelligence Quality Score (IQS)</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{assets.length} assets</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {assets.map((a, i) => {
          const meta = PRODUCER_TYPE_META[a.producerType] ?? PRODUCER_TYPE_META.citizen;
          const catMeta = CATEGORY_META[a.category] ?? { color: "#a1a1aa" };
          const Icon = meta.icon;
          return (
            <div key={a.assetId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[18px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                    <Icon className="size-3.5" style={{ color: meta.color }} />
                    <span className="font-mono text-[14px] font-semibold text-muted-foreground">{a.assetId}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: catMeta.color, background: `${catMeta.color}1a` }}>{catMeta.label ?? a.category}</span>
                    {/* IQS badge */}
                    <span className="rounded px-1.5 py-0.5 text-[14px] font-bold font-mono" style={{ color: a.iqs >= 0.8 ? "#34d399" : a.iqs >= 0.6 ? "#fbbf24" : "#fb923c", background: `${a.iqs >= 0.8 ? "#34d399" : a.iqs >= 0.6 ? "#fbbf24" : "#fb923c"}1a` }}>
                      IQS {(a.iqs * 100).toFixed(0)}
                    </span>
                    <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(a.publishedAt)}</span>
                  </div>
                  <div className="text-[16px] font-medium mb-0.5">{a.title}</div>
                  <p className="text-[15px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{a.description}</p>
                  <div className="flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap mb-1.5">
                    <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {a.geography}</span>
                    <span>by <span className="font-medium" style={{ color: meta.color }}>{a.producerName}</span></span>
                    <span>conf <span className="font-mono font-semibold">{(a.confidence * 100).toFixed(0)}%</span></span>
                    <span>trust <span className="font-mono font-semibold">{(a.trustScore * 100).toFixed(0)}%</span></span>
                    <span>evidence <span className="font-mono font-semibold">{(a.evidenceQuality * 100).toFixed(0)}%</span></span>
                    <span>fresh <span className="font-mono">{a.freshnessHours.toFixed(0)}h</span></span>
                    {a.purchaseCount > 0 && <span className="text-cyan-400">{a.purchaseCount} purchases</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-bold font-mono" style={{ color: a.price === 0 ? "#34d399" : "#fbbf24" }}>
                      {a.price === 0 ? "FREE" : `$${a.price}`}
                    </span>
                    <span className="text-[13px] text-muted-foreground">{a.pricingModel}</span>
                    <button onClick={() => handlePurchase(a.assetId)} disabled={busy === a.assetId}
                      className="ml-auto flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[14px] text-primary hover:bg-primary/15 disabled:opacity-50">
                      {busy === a.assetId ? <Loader2 className="size-3 animate-spin" /> : <DollarSign className="size-3" />}
                      {a.price === 0 ? "Acquire" : "Purchase"}
                    </button>
                  </div>
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
// TAB: BOUNTIES (Active Production)
// ===========================================================================

function BountiesTab() {
  const [bounties, setBounties] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api("/api/marketplace/bounties").then((d) => {
      setBounties(d.bounties);
      if (d.bounties.length > 0 && !selected) setSelected(d.bounties[0].bountyId);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      api(`/api/marketplace/bounties/${selected}/submissions`).then((d) => setSubmissions(d.submissions)).catch(() => {});
    }
  }, [selected]);

  const handleAccept = async (submissionId: string) => {
    setBusy(submissionId);
    try {
      await api(`/api/marketplace/submissions/${submissionId}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: "ui-reviewer", note: "Accepted via Marketplace UI" }),
      });
      if (selected) api(`/api/marketplace/bounties/${selected}/submissions`).then((d) => setSubmissions(d.submissions));
      load();
    } finally { setBusy(null); }
  };

  const handleReject = async (submissionId: string) => {
    setBusy(submissionId);
    try {
      await api(`/api/marketplace/submissions/${submissionId}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: "ui-reviewer", note: "Rejected via Marketplace UI" }),
      });
      if (selected) api(`/api/marketplace/bounties/${selected}/submissions`).then((d) => setSubmissions(d.submissions));
    } finally { setBusy(null); }
  };

  return (
    <div className="h-full flex">
      {/* Bounty list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <Target className="size-4 text-amber-400" />
          <span className="text-xs font-semibold">Intelligence Bounties</span>
          <span className="text-[15px] text-muted-foreground">— active production: problem → submissions → rewards</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {bounties.map((b) => {
            const catMeta = CATEGORY_META[b.category] ?? { color: "#a1a1aa" };
            const typeMeta = REQUESTER_TYPE_META[b.sponsorType] ?? { color: "#a1a1aa" };
            const active = selected === b.bountyId;
            const pct = b.totalBudget > 0 ? (b.distributedTotal / b.totalBudget) * 100 : 0;
            return (
              <button key={b.bountyId} onClick={() => setSelected(b.bountyId)}
                className={cn("w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-card/60")}>
                <div className="flex items-stretch gap-3">
                  <div className="w-1 shrink-0 rounded-full" style={{ background: catMeta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[14px] font-semibold text-muted-foreground">{b.bountyId}</span>
                      <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: typeMeta.color, background: `${typeMeta.color}1a` }}>{b.sponsorName}</span>
                      <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: catMeta.color, background: `${catMeta.color}1a` }}>{catMeta.label ?? b.category}</span>
                      <span className={cn("rounded px-1 py-0.5 text-[13px] font-medium", b.status === "accepting" ? "bg-emerald-500/10 text-emerald-300" : "bg-foreground/10 text-muted-foreground")}>{b.status}</span>
                    </div>
                    <div className="text-[16px] font-medium mb-0.5">{b.title}</div>
                    <p className="text-[15px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{b.description}</p>
                    <div className="flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap mb-1.5">
                      <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {b.geography}</span>
                      <span className="flex items-center gap-1 text-amber-400"><DollarSign className="size-2.5" /> ${b.totalBudget} budget</span>
                      <span className="text-amber-400">${b.rewardPerSubmission}/submission</span>
                      <span>{b.submissionCount} submitted · {b.acceptedCount} accepted</span>
                    </div>
                    {/* Budget progress */}
                    <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submissions panel */}
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <SectionLabel>Submissions {selected ? `· ${selected}` : ""}</SectionLabel>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {submissions.map((s) => {
            const meta = PRODUCER_TYPE_META[s.producerType] ?? PRODUCER_TYPE_META.citizen;
            return (
              <div key={s.submissionId} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[14px] font-semibold text-muted-foreground">{s.submissionId}</span>
                  <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                  <span className="text-[14px] flex-1 truncate">{s.producerName}</span>
                  <span className="font-mono text-[14px] font-semibold" style={{ color: s.iqs >= 0.7 ? "#34d399" : "#fbbf24" }}>IQS {(s.iqs * 100).toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-1.5">
                  <span>conf {(s.confidence * 100).toFixed(0)}%</span>
                  <span>trust {(s.trustScore * 100).toFixed(0)}%</span>
                  <span className={cn("ml-auto rounded px-1 py-0.5 font-medium",
                    s.status === "rewarded" ? "bg-emerald-500/10 text-emerald-300" :
                    s.status === "rejected" ? "bg-rose-500/10 text-rose-300" :
                    s.status === "pending" ? "bg-amber-500/10 text-amber-300" : "bg-foreground/10 text-muted-foreground")}>
                    {s.status}
                  </span>
                </div>
                {s.rewardAmount > 0 && <div className="text-[14px] text-amber-400 mb-1">Reward: ${s.rewardAmount.toFixed(2)}</div>}
                {s.status === "pending" && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleAccept(s.submissionId)} disabled={!!busy}
                      className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[14px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                      {busy === s.submissionId ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Accept
                    </button>
                    <button onClick={() => handleReject(s.submissionId)} disabled={!!busy}
                      className="flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 text-[14px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
                      <XCircle className="size-3" /> Reject
                    </button>
                  </div>
                )}
                {s.reviewNote && <div className="text-[13px] text-muted-foreground mt-1 italic">{s.reviewNote}</div>}
              </div>
            );
          })}
          {submissions.length === 0 && <div className="text-[15px] text-muted-foreground italic">No submissions yet for this bounty</div>}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: VALUE ATTRIBUTION
// ===========================================================================

function AttributionTab() {
  const [attributions, setAttributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/marketplace/attribution").then((d) => setAttributions(d.attributions)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <DollarSign className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Value Attribution</span>
        <span className="text-[15px] text-muted-foreground">— multi-source contribution splitting</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{attributions.length} attributions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-2">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}

        {/* Default split explainer */}
        <div className="rounded-lg border border-border bg-card/30 p-3">
          <SectionLabel className="mb-2">Default Contribution Split</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: "satellite", share: 0.30, icon: Satellite },
              { key: "citizen", share: 0.25, icon: Users },
              { key: "witness", share: 0.20, icon: Users },
              { key: "agent", share: 0.15, icon: Brain },
              { key: "field", share: 0.10, icon: CheckCircle2 },
            ].map(({ key, share, icon: Icon }) => {
              const meta = SHARE_META[key];
              return (
                <div key={key} className="rounded border border-border bg-card/40 px-2 py-1.5 text-center">
                  <Icon className="size-3 mx-auto mb-0.5" style={{ color: meta.color }} />
                  <div className="text-[13px] text-muted-foreground">{meta.label}</div>
                  <div className="text-[18px] font-bold font-mono" style={{ color: meta.color }}>{(share * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {attributions.map((a) => (
          <div key={a.attributionId} className="rounded-lg border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-[14px] font-semibold text-violet-300">{a.attributionId}</span>
              <span className="text-[16px] font-bold font-mono text-amber-400">${a.totalAmount.toFixed(2)}</span>
              {a.bountyId && <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[13px] text-amber-300">bounty: {a.bountyId}</span>}
              {a.citizenEventId && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[13px] text-emerald-300">event: {a.citizenEventId}</span>}
              {a.transactionId && <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[13px] text-cyan-300">tx: {a.transactionId}</span>}
              <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(a.attributedAt)}</span>
            </div>
            {/* Recipients */}
            <div className="space-y-1">
              {Object.entries(a.recipients).map(([recipientId, info]: [string, any]) => {
                const meta = SHARE_META[info.role] ?? { color: "#a1a1aa", label: info.role };
                return (
                  <div key={recipientId} className="flex items-center gap-2 text-[14px] rounded border border-border/60 bg-card/20 px-2 py-1">
                    <span className="size-2 rounded-full" style={{ background: meta.color }} />
                    <span className="font-mono text-[13px] text-muted-foreground truncate flex-1">{recipientId}</span>
                    <span className="text-muted-foreground">{meta.label}</span>
                    <span className="font-mono font-semibold" style={{ color: meta.color }}>${info.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground text-[13px]">{(info.share * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {attributions.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <DollarSign className="size-8 opacity-30" />
            <span className="text-xs">No value attributions yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: TRANSACTIONS
// ===========================================================================

function TransactionsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/marketplace/transactions").then((d) => setTransactions(d.transactions)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Activity className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Transactions</span>
        <span className="text-[15px] text-muted-foreground">— marketplace purchase history</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{transactions.length} transactions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {transactions.map((t) => (
          <div key={t.transactionId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[14px] font-semibold text-cyan-300">{t.transactionId}</span>
              <span className={cn("rounded px-1 py-0.5 text-[13px] font-medium",
                t.status === "completed" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>{t.status}</span>
              <span className="ml-auto text-[16px] font-bold font-mono text-amber-400">${t.amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <span>buyer: <span className="font-medium text-foreground">{t.buyerName}</span></span>
              <ArrowRight className="size-2.5" />
              <span>seller: <span className="font-medium text-foreground">{t.sellerName}</span></span>
              {t.assetId && <span>· asset: <span className="font-mono">{t.assetId}</span></span>}
              {t.requestId && <span>· request: <span className="font-mono">{t.requestId}</span></span>}
            </div>
            {t.attributionId && <div className="text-[13px] text-violet-400 mt-1">attribution: <span className="font-mono">{t.attributionId}</span></div>}
          </div>
        ))}
        {transactions.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Activity className="size-8 opacity-30" />
            <span className="text-xs">No transactions yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
