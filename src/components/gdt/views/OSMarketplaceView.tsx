"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Boxes,
  Package,
  Users,
  LayoutGrid,
  Network,
  Star,
  Loader2,
  TrendingUp,
  ShieldCheck,
  Download,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Bot,
  Satellite,
  Brain,
  BookOpen,
  FileBadge,
  Workflow,
  MapPin,
  Zap,
} from "lucide-react";

const PACKAGE_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  agent: { color: "#a78bfa", icon: Bot, label: "Agent" },
  connector: { color: "#38bdf8", icon: Satellite, label: "Connector" },
  model: { color: "#fbbf24", icon: Brain, label: "Model" },
  knowledge: { color: "#84cc16", icon: BookOpen, label: "Knowledge" },
  policy: { color: "#f43f5e", icon: FileBadge, label: "Policy" },
  workflow: { color: "#22d3ee", icon: Workflow, label: "Workflow" },
};

const LIFECYCLE_META: Record<string, { color: string; label: string }> = {
  draft: { color: "#a1a1aa", label: "Draft" },
  experimental: { color: "#fbbf24", label: "Experimental" },
  verified: { color: "#22d3ee", label: "Verified" },
  certified: { color: "#34d399", label: "Certified" },
  official: { color: "#f43f5e", label: "Official" },
  deprecated: { color: "#71717a", label: "Deprecated" },
  archived: { color: "#52525b", label: "Archived" },
};

const DEV_TYPE_META: Record<string, { color: string; label: string }> = {
  university: { color: "#a78bfa", label: "University" },
  ngo: { color: "#84cc16", label: "NGO" },
  startup: { color: "#fbbf24", label: "Startup" },
  government: { color: "#34d399", label: "Government" },
  independent: { color: "#22d3ee", label: "Independent" },
  corporation: { color: "#f43f5e", label: "Corporation" },
};

type Tab = "overview" | "packages" | "developers" | "solutions" | "graph" | "reviews";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Boxes },
  { id: "packages", label: "Package Registry", icon: Package },
  { id: "developers", label: "Developers", icon: Users },
  { id: "solutions", label: "Solutions", icon: LayoutGrid },
  { id: "graph", label: "Intelligence Graph", icon: Network },
  { id: "reviews", label: "Reviews", icon: Star },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function OSMarketplaceView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Boxes className="size-4 text-primary" /> Intelligence OS Marketplace
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: intelligence-os
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Build · Publish · Monetize · Govern · Deploy intelligence capabilities
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
        {tab === "packages" && <PackagesTab />}
        {tab === "developers" && <DevelopersTab />}
        {tab === "solutions" && <SolutionsTab />}
        {tab === "graph" && <GraphTab />}
        {tab === "reviews" && <ReviewsTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => { api("/api/os-marketplace").then((d) => setPackages(d.packages)).catch(() => {}); }, []);
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
    api("/api/os-marketplace").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Developers" value={o.counts.developers} sub="publishers" accent="#a78bfa" />
        <MetricStat label="Packages" value={o.counts.packages} sub="intelligence capabilities" accent="#34d399" />
        <MetricStat label="Solutions" value={o.counts.solutions} sub="complete systems" accent="#22d3ee" />
        <MetricStat label="Downloads" value={o.economy.totalDownloads} sub="installs" accent="#fbbf24" />
        <MetricStat label="Dev Revenue" value={`${(o.economy.totalRevenue / 1000).toFixed(1)}K`} sub="IC earned" accent="#f43f5e" />
        <MetricStat label="Active Installs" value={o.economy.activeInstalls} sub="running deployments" accent="#fb923c" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Packages by Type</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {o.packagesByType.map((t: any) => {
              const meta = PACKAGE_TYPE_META[t.packageType] ?? PACKAGE_TYPE_META.agent;
              const Icon = meta.icon;
              return (
                <div key={t.packageType} className="rounded border border-border bg-card/30 px-2 py-1.5 text-center">
                  <Icon className="size-4 mx-auto mb-0.5" style={{ color: meta.color }} />
                  <div className="text-[16px] font-bold font-mono" style={{ color: meta.color }}>{t._count}</div>
                  <div className="text-[9px] text-muted-foreground">{meta.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2">Packages by Lifecycle Stage</SectionLabel>
          <div className="space-y-1">
            {o.packagesByStage.map((s: any) => {
              const meta = LIFECYCLE_META[s.lifecycleStage] ?? LIFECYCLE_META.draft;
              return (
                <div key={s.lifecycleStage} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1">{meta.label}</span>
                  <span className="font-mono font-semibold">{s._count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Package className="size-3" /> Top Packages</SectionLabel>
          <div className="space-y-1">
            {o.topPackages.map((p: any, i: number) => {
              const meta = PACKAGE_TYPE_META[p.packageType] ?? PACKAGE_TYPE_META.agent;
              return (
                <div key={p.packageId} className="flex items-center gap-2 text-[11px] py-0.5">
                  <span className="font-mono text-[12px] font-bold w-5 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                  <span className="flex-1 truncate">{p.displayName}</span>
                  <span className="font-mono font-semibold" style={{ color: meta.color }}>{p.marketplaceRank.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Users className="size-3" /> Top Developers</SectionLabel>
          <div className="space-y-1">
            {o.topDevelopers.map((d: any, i: number) => (
              <div key={d.developerId} className="flex items-center gap-2 text-[11px] py-0.5">
                <span className="font-mono text-[12px] font-bold w-5 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-mono font-semibold text-amber-400">{(d.totalRevenue / 1000).toFixed(1)}K</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><LayoutGrid className="size-3" /> Top Solutions</SectionLabel>
          <div className="space-y-1">
            {o.topSolutions.map((s: any) => (
              <div key={s.solutionId} className="flex items-center gap-2 text-[11px] py-0.5">
                <LayoutGrid className="size-3 text-cyan-400" />
                <span className="flex-1 truncate">{s.displayName}</span>
                <span className="font-mono font-semibold text-cyan-400">{s.deployments}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Boxes className="size-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary">INTELLIGENCE OS MARKETPLACE</span>
        </div>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          Anyone in the world can build, publish, monetize, govern, and deploy intelligence capabilities. Developers publish <span className="text-primary font-medium">packages</span> (agents, connectors, models, knowledge, policies, workflows) ranked by a marketplace score (trust + accuracy + adoption + value + freshness + cost). <span className="text-primary font-medium">Solutions</span> bundle packages into complete intelligence systems — "Illegal Mining Monitoring OS" = satellite + AI + citizen + trust + workflow. The <span className="text-primary font-medium">intelligence graph</span> maps who uses what, what solves what. Revenue flows to developers with attribution splits. This is the self-growing ecosystem layer — the platform is now a planetary intelligence operating system.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: PACKAGE REGISTRY
// ===========================================================================

function PackagesTab() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ packageType?: string }>({});

  useEffect(() => {
    const sp = new URLSearchParams();
    if (filter.packageType) sp.set("packageType", filter.packageType);
    api(`/api/os-marketplace/packages?${sp}`).then((d) => setPackages(d.packages)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Package className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Intelligence Package Registry</span>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] text-muted-foreground">Type:</span>
          {["", "agent", "connector", "model", "knowledge", "policy", "workflow"].map((t) => (
            <button key={t || "all"} onClick={() => setFilter({ packageType: t || undefined })}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                (filter.packageType ?? "") === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {t || "all"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">{packages.length} packages</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {packages.map((p, i) => {
          const meta = PACKAGE_TYPE_META[p.packageType] ?? PACKAGE_TYPE_META.agent;
          const stageMeta = LIFECYCLE_META[p.lifecycleStage] ?? LIFECYCLE_META.draft;
          const Icon = meta.icon;
          return (
            <div key={p.packageId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                    <Icon className="size-3.5" style={{ color: meta.color }} />
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{p.packageId}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: stageMeta.color, background: `${stageMeta.color}1a` }}>{stageMeta.label}</span>
                    {p.securityReviewed && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-400"><ShieldCheck className="size-2.5 inline" /> security</span>}
                    {p.conformancePassed && <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] text-cyan-400"><CheckCircle2 className="size-2.5 inline" /> conformance</span>}
                    <span className="ml-auto text-[9px] text-muted-foreground">v{p.version}</span>
                  </div>
                  <div className="text-[12px] font-medium mb-0.5">{p.displayName}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{p.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap mb-1.5">
                    <span>by <span className="font-medium" style={{ color: meta.color }}>{p.developerName}</span></span>
                    <span>category: {p.category}</span>
                    <span>rank <span className="font-mono font-semibold" style={{ color: meta.color }}>{p.marketplaceRank.toFixed(0)}</span></span>
                    <span>accuracy <span className="font-mono font-semibold">{(p.accuracy * 100).toFixed(0)}%</span></span>
                    <span className="flex items-center gap-1"><Download className="size-2.5" /> {p.downloads}</span>
                    <span className="flex items-center gap-1"><Star className="size-2.5 text-amber-400" /> {p.ratingAvg > 0 ? p.ratingAvg.toFixed(1) : "—"} ({p.ratingCount})</span>
                  </div>
                  {/* Capabilities */}
                  {p.capabilities.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] text-muted-foreground">capabilities:</span>
                      {p.capabilities.map((c: string) => (
                        <span key={c} className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono">{c}</span>
                      ))}
                    </div>
                  )}
                  {/* Pricing */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[14px] font-bold font-mono" style={{ color: p.pricePerUse === 0 && p.subscriptionPrice === 0 ? "#34d399" : "#fbbf24" }}>
                      {p.pricingModel === "free" ? "FREE" : p.pricingModel === "usage" ? `${p.pricePerUse} IC/use` : p.pricingModel === "subscription" ? `${p.subscriptionPrice} IC/mo` : `${p.pricePerUse} IC`}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{p.pricingModel}</span>
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
// TAB: DEVELOPERS
// ===========================================================================

function DevelopersTab() {
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/os-marketplace/developers").then((d) => setDevelopers(d.developers)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Users className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Intelligence Developers</span>
        <span className="text-[11px] text-muted-foreground">— a new economic actor: universities, NGOs, startups, governments</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{developers.length} developers</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {developers.map((d, i) => {
          const typeMeta = DEV_TYPE_META[d.developerType] ?? DEV_TYPE_META.independent;
          return (
            <div key={d.developerId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0")} style={{ color: typeMeta.color, background: `${typeMeta.color}1a`, border: `1px solid ${typeMeta.color}33` }}>
                  <Users className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-medium truncate">{d.name}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: typeMeta.color, background: `${typeMeta.color}1a` }}>{typeMeta.label}</span>
                    {d.countryCode && <span className="text-[9px] text-muted-foreground">{d.countryCode}</span>}
                    <span className="rounded px-1 py-0.5 text-[9px] font-medium capitalize" style={{ color: d.certificationLevel === "official" ? "#f43f5e" : d.certificationLevel === "certified" ? "#34d399" : "#fbbf24", background: `${d.certificationLevel === "official" ? "#f43f5e" : d.certificationLevel === "certified" ? "#34d399" : "#fbbf24"}1a` }}>{d.certificationLevel}</span>
                  </div>
                  {d.bio && <p className="text-[10px] text-muted-foreground line-clamp-1 mb-0.5">{d.bio}</p>}
                  <div className="grid grid-cols-4 gap-1 text-[9px]">
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Trust</span> <span className="font-mono font-semibold">{d.trustScore.toFixed(0)}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Packages</span> <span className="font-mono font-semibold">{d.packagesPublished}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Downloads</span> <span className="font-mono font-semibold">{d.totalDownloads}</span></div>
                    <div className="rounded bg-card/30 px-1.5 py-0.5"><span className="text-muted-foreground">Rating</span> <span className="font-mono font-semibold">{d.avgRating > 0 ? d.avgRating.toFixed(1) : "—"}</span></div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[18px] font-bold font-mono text-amber-400">{(d.totalRevenue / 1000).toFixed(1)}K</div>
                  <div className="text-[9px] text-muted-foreground">IC revenue</div>
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
// TAB: SOLUTIONS
// ===========================================================================

function SolutionsTab() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/os-marketplace/solutions").then((d) => setSolutions(d.solutions)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <LayoutGrid className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Intelligence Solutions</span>
        <span className="text-[11px] text-muted-foreground">— complete intelligence systems (outcome-based, not capability-based)</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{solutions.length} solutions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {solutions.map((s) => (
          <div key={s.solutionId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-stretch gap-3">
              <div className="w-1 shrink-0 rounded-full bg-cyan-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">{s.solutionId}</span>
                  <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-medium text-cyan-300">{s.problemCategory}</span>
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: LIFECYCLE_META[s.lifecycleStage]?.color ?? "#a1a1aa", background: `${LIFECYCLE_META[s.lifecycleStage]?.color ?? "#a1a1aa"}1a` }}>{LIFECYCLE_META[s.lifecycleStage]?.label ?? s.lifecycleStage}</span>
                  <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(s.publishedAt)}</span>
                </div>
                <div className="text-[13px] font-medium mb-0.5">{s.displayName}</div>
                <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{s.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap mb-1.5">
                  <span>by <span className="font-medium text-foreground">{s.developerName}</span></span>
                  <span className="flex items-center gap-1"><Package className="size-2.5" /> {s.componentCount} components</span>
                  <span className="flex items-center gap-1"><Download className="size-2.5" /> {s.deployments} deployments</span>
                  <span className="text-emerald-400">→ {s.targetOutcome}</span>
                </div>
                {/* Component packages */}
                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  <span className="text-[9px] text-muted-foreground">includes:</span>
                  {s.componentPackageIds.map((pid: string) => (
                    <span key={pid} className="rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-mono text-cyan-300">{pid}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-bold font-mono text-amber-400">{s.price.toLocaleString()} IC</span>
                  <span className="text-[9px] text-muted-foreground">{s.pricingModel}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INTELLIGENCE GRAPH
// ===========================================================================

function GraphTab() {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/os-marketplace/graph").then((d) => setGraph(d.graph)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  const nodeTypeColors: Record<string, string> = {
    package: "#34d399", developer: "#a78bfa", consumer: "#22d3ee", problem: "#f43f5e", capability: "#fbbf24", solution: "#38bdf8",
  };

  // Layout: developers left, packages center, capabilities/problems right
  const groups: Record<string, any[]> = {};
  for (const n of graph.nodes) {
    if (!groups[n.type]) groups[n.type] = [];
    groups[n.type].push(n);
  }
  const typeOrder = ["developer", "solution", "package", "capability", "problem", "consumer"];
  const positioned = new Map<string, { x: number; y: number }>();
  typeOrder.forEach((type, colIdx) => {
    const nodes = groups[type] ?? [];
    nodes.forEach((n, i) => {
      const x = 50 + colIdx * 140;
      const y = 50 + i * 45 + (100 / Math.max(1, nodes.length));
      positioned.set(n.id, { x, y });
    });
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Network className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Intelligence Graph</span>
        <span className="text-[11px] text-muted-foreground">— who uses what, what solves what, what produces what</span>
        <div className="ml-auto flex items-center gap-2">
          {Object.entries(nodeTypeColors).filter(([t]) => groups[t]).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="capitalize">{type}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto gdt-scroll p-4">
        <svg viewBox="0 0 900 500" className="w-full" style={{ maxHeight: "55vh" }}>
          {graph.edges.map((e, i) => {
            const from = positioned.get(e.source);
            const to = positioned.get(e.target);
            if (!from || !to) return null;
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#71717a" strokeWidth={0.5} strokeOpacity={0.3} />;
          })}
          {graph.nodes.map((n) => {
            const pos = positioned.get(n.id);
            if (!pos) return null;
            const color = nodeTypeColors[n.type] ?? "#a1a1aa";
            const r = n.type === "developer" ? 8 : n.type === "solution" ? 9 : 6;
            return (
              <g key={n.id}>
                <circle cx={pos.x} cy={pos.y} r={r} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />
                <text x={pos.x + r + 3} y={pos.y + 3} fontSize="7" fill="#e4e4e7">{n.label.slice(0, 20)}</text>
                <title>{n.label} ({n.type})</title>
              </g>
            );
          })}
        </svg>
        {/* Node list */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          {graph.nodes.slice(0, 12).map((n) => {
            const color = nodeTypeColors[n.type] ?? "#a1a1aa";
            return (
              <div key={n.id} className="rounded border border-border bg-card/30 px-2 py-1.5 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  <span className="font-medium truncate flex-1">{n.label}</span>
                  <span className="text-muted-foreground capitalize">{n.type}</span>
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
// TAB: REVIEWS
// ===========================================================================

function ReviewsTab() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/os-marketplace/reviews").then((d) => setReviews(d.reviews)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Star className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Package Reviews</span>
        <span className="text-[11px] text-muted-foreground">— ratings + quality assessments from consumers</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{reviews.length} reviews</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {reviews.map((r) => (
          <div key={r.reviewId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{r.reviewId}</span>
              <span className="text-[10px] text-muted-foreground">package: <span className="font-mono">{r.packageId}</span></span>
              <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(r.reviewedAt)}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-medium">{r.reviewerName}</span>
              <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] text-muted-foreground capitalize">{r.reviewerType}</span>
              <div className="flex items-center gap-0.5 ml-auto">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={cn("size-3", s <= r.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                ))}
              </div>
            </div>
            {r.reviewText && <p className="text-[11px] text-foreground/70 italic mb-1">"{r.reviewText}"</p>}
            {(r.accuracyRating || r.reliabilityRating || r.valueForMoney) && (
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                {r.accuracyRating && <span>Accuracy: <span className="font-mono font-semibold text-emerald-400">{r.accuracyRating}/5</span></span>}
                {r.reliabilityRating && <span>Reliability: <span className="font-mono font-semibold text-cyan-400">{r.reliabilityRating}/5</span></span>}
                {r.valueForMoney && <span>Value: <span className="font-mono font-semibold text-amber-400">{r.valueForMoney}/5</span></span>}
              </div>
            )}
          </div>
        ))}
        {reviews.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Star className="size-8 opacity-30" />
            <span className="text-xs">No reviews yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
