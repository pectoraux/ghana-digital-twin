"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Building2, Wallet, Target, ScrollText, Store, Users, Loader2,
  TrendingUp, DollarSign, CheckCircle2, Brain, MapPin, Clock,
  ArrowRight, ShieldCheck, Zap,
} from "lucide-react";

const ORG_TYPE_META: Record<string, { color: string; label: string }> = {
  environmental: { color: "#34d399", label: "Environmental" },
  disaster: { color: "#22d3ee", label: "Disaster" },
  wildlife: { color: "#fbbf24", label: "Wildlife" },
  agricultural: { color: "#84cc16", label: "Agricultural" },
  infrastructure: { color: "#a78bfa", label: "Infrastructure" },
};

const TIER_META: Record<string, { color: string; label: string }> = {
  unproven: { color: "#a1a1aa", label: "Unproven" },
  emerging: { color: "#fbbf24", label: "Emerging" },
  trusted: { color: "#22d3ee", label: "Trusted" },
  elite: { color: "#34d399", label: "Elite" },
};

const TX_TYPE_META: Record<string, { color: string }> = {
  income: { color: "#34d399" }, expense: { color: "#f43f5e" }, allocation: { color: "#fbbf24" }, transfer: { color: "#22d3ee" },
};

const OBJ_STATUS_META: Record<string, { color: string; label: string }> = {
  active: { color: "#fbbf24", label: "Active" }, achieved: { color: "#34d399", label: "Achieved" }, missed: { color: "#f43f5e", label: "Missed" }, abandoned: { color: "#71717a", label: "Abandoned" },
};

const SERVICE_TYPE_META: Record<string, { color: string }> = {
  monitoring: { color: "#22d3ee" }, investigation: { color: "#a78bfa" }, prediction: { color: "#fbbf24" }, response: { color: "#f43f5e" }, advisory: { color: "#34d399" },
};

type Tab = "overview" | "organizations" | "treasury" | "objectives" | "services";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "treasury", label: "Treasury", icon: Wallet },
  { id: "objectives", label: "Objectives", icon: Target },
  { id: "services", label: "Services", icon: Store },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function AioView() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-primary" /> Autonomous Intelligence Organizations
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">package: autonomous-organizations</span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">Digital institutions native to the intelligence economy</p>
        </div>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => { const active = tab === t.id; const Icon = t.icon; return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                active ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent")}>
              <Icon className="size-3.5" />{t.label}
            </button>
          );})}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab />}
        {tab === "organizations" && <OrganizationsTab />}
        {tab === "treasury" && <TreasuryTab />}
        {tab === "objectives" && <ObjectivesTab />}
        {tab === "services" && <ServicesTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/aio").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;
  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Organizations" value={o.active.activeOrgs} sub={`${o.counts.orgs} total`} accent="#34d399" />
        <MetricStat label="Treasury Balance" value={`${(o.economy.totalTreasuryBalance / 1000).toFixed(0)}K`} sub="IC total" accent="#fbbf24" />
        <MetricStat label="Total Revenue" value={`${(o.economy.totalOrgRevenue / 1000).toFixed(0)}K`} sub="IC lifetime" accent="#22d3ee" />
        <MetricStat label="Agents Employed" value={o.active.totalAgentsEmployed} sub="under contract" accent="#a78bfa" />
        <MetricStat label="Objectives" value={o.active.activeObjectives} sub={`${o.active.achievedObjectives} achieved`} accent="#f43f5e" />
        <MetricStat label="Services" value={o.counts.services} sub="marketplace offerings" accent="#fb923c" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Building2 className="size-3" /> Organizations by Trust</SectionLabel>
          <div className="space-y-1">
            {o.organizations.map((org: any) => {
              const tier = TIER_META[org.reputationTier] ?? TIER_META.unproven;
              const typeMeta = ORG_TYPE_META[org.orgType] ?? ORG_TYPE_META.environmental;
              return (
                <div key={org.orgId} className="flex items-center gap-2 text-[11px] py-1">
                  <span className="size-2 rounded-full" style={{ background: typeMeta.color }} />
                  <span className="flex-1 truncate font-medium">{org.displayName}</span>
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                  <span className="font-mono font-semibold" style={{ color: tier.color }}>{org.trustScore.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Wallet className="size-3" /> Recent Treasury Activity</SectionLabel>
          <div className="space-y-1">
            {o.recentTransactions.map((t: any) => {
              const meta = TX_TYPE_META[t.type] ?? TX_TYPE_META.income;
              return (
                <div key={t.transactionId} className="flex items-center gap-2 text-[11px] py-1">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1 truncate">{t.description}</span>
                  <span className="font-mono font-semibold" style={{ color: meta.color }}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2"><Building2 className="size-4 text-primary" /><span className="text-[11px] font-semibold text-primary">AUTONOMOUS INTELLIGENCE ORGANIZATIONS</span></div>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          AIOs are digital institutions native to the intelligence economy. They have identity, own assets, employ agents, receive funding, publish intelligence, execute workflows, are governed by charters, audited by governance agents, earn revenue, and can be dissolved. Like a company but native to the intelligence economy. Like a DAO but with constitutional governance. Like an agent swarm but legally/economically bounded.
        </p>
      </div>
    </div>
  );
}

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/aio/organizations").then((d) => { setOrgs(d.organizations); if (d.organizations.length > 0 && !selected) setSelected(d.organizations[0].orgId); }).catch(() => {}).finally(() => setLoading(false)); }, [selected]);
  useEffect(() => { if (selected) api(`/api/aio/organizations/${selected}`).then((d) => setDetail(d.organization)).catch(() => {}); }, [selected]);
  return (
    <div className="h-full flex">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2"><Building2 className="size-4 text-emerald-400" /><span className="text-xs font-semibold">Organizations</span><span className="ml-auto text-[10px] text-muted-foreground">{orgs.length} orgs</span></div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {orgs.map((org) => {
            const tier = TIER_META[org.reputationTier] ?? TIER_META.unproven;
            const typeMeta = ORG_TYPE_META[org.orgType] ?? ORG_TYPE_META.environmental;
            const active = selected === org.orgId;
            return (
              <button key={org.orgId} onClick={() => setSelected(org.orgId)}
                className={cn("w-full text-left rounded-lg border px-3 py-2.5 transition-all", active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-card/60")}>
                <div className="flex items-stretch gap-3">
                  <div className="w-1 shrink-0 rounded-full" style={{ background: typeMeta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground">{org.orgId}</span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: typeMeta.color, background: `${typeMeta.color}1a` }}>{typeMeta.label}</span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tier.color, background: `${tier.color}1a` }}>{tier.label}</span>
                      <span className={cn("rounded px-1 py-0.5 text-[9px]", org.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{org.status}</span>
                      <span className="ml-auto font-mono text-[12px] font-bold text-amber-400">{(org.treasuryBalance / 1000).toFixed(0)}K IC</span>
                    </div>
                    <div className="text-[12px] font-medium mb-0.5">{org.displayName}</div>
                    <p className="text-[11px] text-foreground/70 leading-snug line-clamp-1 mb-1">{org.mission}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>founder: {org.founderName}</span>
                      <span className="flex items-center gap-1"><Users className="size-2.5" /> {org.agentCount} agents</span>
                      <span className="flex items-center gap-1"><Target className="size-2.5" /> {org.objectiveCount} objectives</span>
                      <span>trust {org.trustScore.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        <div className="px-3 py-2 border-b border-border"><SectionLabel>Organization Detail</SectionLabel></div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-3">
          {detail ? (<>
            <div><SectionLabel className="mb-1">Mission</SectionLabel><p className="text-[11px] text-foreground/80">{detail.mission}</p></div>
            {detail.treasury && (
              <div><SectionLabel className="mb-1">Treasury</SectionLabel>
                <div className="text-[18px] font-bold font-mono text-amber-400">{detail.treasury.balance.toLocaleString()} IC</div>
                <div className="text-[10px] text-muted-foreground">income: {detail.treasury.totalIncome.toLocaleString()} · expenses: {detail.treasury.totalExpenses.toLocaleString()}</div>
              </div>
            )}
            {detail.agentContracts?.length > 0 && (
              <div><SectionLabel className="mb-1">Employed Agents ({detail.agentContracts.length})</SectionLabel>
                <div className="space-y-1">{detail.agentContracts.map((c: any) => (
                  <div key={c.contractId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                    <div className="flex items-center gap-2"><Brain className="size-3 text-violet-400" /><span className="text-[11px] font-medium flex-1 truncate">{c.agentName}</span></div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">role: {c.role} · budget: {c.budgetAllocation.toLocaleString()} IC/mo</div>
                  </div>
                ))}</div>
              </div>
            )}
            {detail.objectives?.length > 0 && (
              <div><SectionLabel className="mb-1">Objectives ({detail.objectives.length})</SectionLabel>
                <div className="space-y-1">{detail.objectives.map((obj: any) => {
                  const smeta = OBJ_STATUS_META[obj.status] ?? OBJ_STATUS_META.active;
                  return (
                    <div key={obj.objectiveId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                      <div className="flex items-center gap-2 mb-1"><span className="text-[11px] font-medium flex-1 truncate">{obj.title}</span><span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: smeta.color, background: `${smeta.color}1a` }}>{smeta.label}</span></div>
                      <ConfidenceBar value={obj.progressPercent / 100} showLabel={false} size="sm" />
                      <div className="text-[9px] text-muted-foreground mt-0.5">{obj.currentValue}/{obj.targetValue}{obj.unit} · {obj.progressPercent.toFixed(0)}%</div>
                    </div>
                  );
                })}</div>
              </div>
            )}
            {detail.charter && (
              <div><SectionLabel className="mb-1">Charter ({detail.charter.ruleCount} rules)</SectionLabel>
                <p className="text-[10px] text-muted-foreground italic mb-1">{detail.charter.preamble.slice(0, 120)}...</p>
                <div className="space-y-0.5">{detail.charter.rules.map((r: any, i: number) => (
                  <div key={i} className="text-[10px] text-foreground/70">#{r.number}: {r.title}</div>
                ))}</div>
              </div>
            )}
          </>) : <div className="text-[11px] text-muted-foreground">Select an organization</div>}
        </div>
      </div>
    </div>
  );
}

function TreasuryTab() {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/aio/treasury").then((d) => setTxs(d.transactions)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2"><Wallet className="size-4 text-amber-400" /><span className="text-xs font-semibold">Treasury Transactions</span><span className="text-[11px] text-muted-foreground">— institutional economics</span><span className="ml-auto text-[10px] text-muted-foreground">{txs.length} transactions</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {txs.map((t) => {
          const meta = TX_TYPE_META[t.type] ?? TX_TYPE_META.income;
          return (
            <div key={t.transactionId} className="rounded-lg border border-border bg-card/40 px-3 py-2 flex items-center gap-3">
              <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0")} style={{ color: meta.color, background: `${meta.color}1a` }}>
                {t.type === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-muted-foreground">{t.transactionId}</span><span className="rounded px-1 py-0.5 text-[9px]" style={{ color: meta.color, background: `${meta.color}1a` }}>{t.category}</span></div>
                <div className="text-[11px] text-foreground/70 truncate">{t.description}</div>
                <div className="text-[9px] text-muted-foreground">org: {t.orgId} {t.counterpartyName ? `· ${t.counterpartyName}` : ""}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[14px] font-bold" style={{ color: meta.color }}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</div>
                <div className="text-[9px] text-muted-foreground">balance: {t.balanceAfter.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObjectivesTab() {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/aio/objectives").then((d) => setObjectives(d.objectives)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2"><Target className="size-4 text-rose-400" /><span className="text-xs font-semibold">Organization Objectives</span><span className="text-[11px] text-muted-foreground">— goals with metrics + progress</span><span className="ml-auto text-[10px] text-muted-foreground">{objectives.length} objectives</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {objectives.map((obj) => {
          const smeta = OBJ_STATUS_META[obj.status] ?? OBJ_STATUS_META.active;
          return (
            <div key={obj.objectiveId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{obj.objectiveId}</span>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: smeta.color, background: `${smeta.color}1a` }}>{smeta.label}</span>
                <span className="text-[10px] text-muted-foreground">org: {obj.orgId}</span>
              </div>
              <div className="text-[12px] font-medium mb-1">{obj.title}</div>
              <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{obj.description}</p>
              <ConfidenceBar value={obj.progressPercent / 100} showLabel={false} />
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span>target: {obj.targetValue}{obj.unit}</span>
                <span>current: {obj.currentValue}{obj.unit}</span>
                <span className="font-mono font-semibold" style={{ color: smeta.color }}>{obj.progressPercent.toFixed(0)}%</span>
                {obj.deadline && <span className="flex items-center gap-1"><Clock className="size-2.5" /> {new Date(obj.deadline).toLocaleDateString("en-GB")}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServicesTab() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/aio/services").then((d) => setServices(d.services)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2"><Store className="size-4 text-cyan-400" /><span className="text-xs font-semibold">Organization Services</span><span className="text-[11px] text-muted-foreground">— intelligence as a service</span><span className="ml-auto text-[10px] text-muted-foreground">{services.length} services</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {services.map((s) => {
          const meta = SERVICE_TYPE_META[s.serviceType] ?? SERVICE_TYPE_META.monitoring;
          return (
            <div key={s.serviceId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{s.serviceId}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{s.serviceType}</span>
                    <span className="text-[10px] text-muted-foreground">by {s.orgName}</span>
                    <span className="ml-auto font-mono text-[14px] font-bold text-amber-400">{s.price.toLocaleString()} IC/{s.pricingModel === "subscription" ? "mo" : "use"}</span>
                  </div>
                  <div className="text-[12px] font-medium mb-0.5">{s.name}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{s.description}</p>
                  {s.includes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] text-muted-foreground">includes:</span>
                      {s.includes.map((p: string) => <span key={p} className="rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-mono text-cyan-300">{p}</span>)}
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

// Fix missing import
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
