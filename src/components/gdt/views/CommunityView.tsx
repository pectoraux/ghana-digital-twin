"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Users,
  Radio,
  Eye,
  Award,
  Bell,
  Network,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Brain,
  RefreshCw,
  Satellite,
  Zap,
  ArrowRight,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

// ---- Domain formatting (shared with Command Center) ----

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  illegal_mining: { label: "Illegal Mining", color: "#f43f5e", icon: "⛏" },
  flood_risk: { label: "Flood Risk", color: "#38bdf8", icon: "🌊" },
  deforestation: { label: "Deforestation", color: "#84cc16", icon: "🌲" },
  cocoa_disease: { label: "Cocoa Disease", color: "#fbbf24", icon: "🍫" },
  water_pollution: { label: "Water Pollution", color: "#22d3ee", icon: "💧" },
  land_degradation: { label: "Land Degradation", color: "#a78bfa", icon: "🏜" },
  other: { label: "Other", color: "#a1a1aa", icon: "📋" },
};

const SEVERITY_META: Record<string, { color: string; bg: string }> = {
  low: { color: "#34d399", bg: "#34d3991a" },
  moderate: { color: "#fbbf24", bg: "#fbbf241a" },
  high: { color: "#fb923c", bg: "#fb923c1a" },
  critical: { color: "#f43f5e", bg: "#f43f5e1a" },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  created: { color: "#a1a1aa", label: "Created" },
  broadcast: { color: "#fbbf24", label: "Broadcast" },
  witnessing: { color: "#fbbf24", label: "Witnessing" },
  fusing: { color: "#a78bfa", label: "Fusing" },
  verified: { color: "#22d3ee", label: "Verified" },
  resolved: { color: "#34d399", label: "Resolved" },
  rewarded: { color: "#34d399", label: "Rewarded" },
  learned: { color: "#22d3ee", label: "Learned" },
};

const TRUST_META: Record<string, { color: string; label: string }> = {
  new: { color: "#a1a1aa", label: "New" },
  trusted: { color: "#fbbf24", label: "Trusted" },
  verified: { color: "#34d399", label: "Verified" },
  expert: { color: "#22d3ee", label: "Expert" },
  certified: { color: "#a78bfa", label: "Certified" },
  official: { color: "#f43f5e", label: "Official" },
};

const PRODUCER_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  agent: { color: "#a78bfa", icon: Brain, label: "Agent" },
  citizen: { color: "#34d399", icon: Users, label: "Citizen" },
  sensor: { color: "#38bdf8", icon: Satellite, label: "Sensor" },
  organization: { color: "#fbbf24", icon: ShieldCheck, label: "Organization" },
  researcher: { color: "#f43f5e", icon: Network, label: "Researcher" },
};

type Tab = "feed" | "witness" | "citizens" | "rewards" | "subscriptions" | "producers";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "feed", label: "Event Feed", icon: Radio },
  { id: "witness", label: "Witness Queue", icon: Eye },
  { id: "citizens", label: "Citizens", icon: Users },
  { id: "rewards", label: "Rewards", icon: Award },
  { id: "subscriptions", label: "Subscriptions", icon: Bell },
  { id: "producers", label: "Intelligence Producers", icon: Network },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function CommunityView() {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" /> Community Intelligence Network
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: community-intelligence
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Citizens are intelligence producers · Witness validation · Civic scores · Rewards
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
        {tab === "feed" && <FeedTab />}
        {tab === "witness" && <WitnessTab />}
        {tab === "citizens" && <CitizensTab />}
        {tab === "rewards" && <RewardsTab />}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "producers" && <ProducersTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => {
    api("/api/community/packages").then((d) => setPackages(d.packages)).catch(() => {});
  }, []);
  if (packages.length === 0) return null;
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
      <ShieldCheck className="size-3 text-emerald-400" />
      <span>{packages.length} packages</span>
      <span>·</span>
      <span className="font-mono">{packages.reduce((s, p) => s + p.provides.length, 0)} capabilities</span>
    </div>
  );
}

// ===========================================================================
// TAB: EVENT FEED
// ===========================================================================

function FeedTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string }>({});
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/api/community/events?limit=100${filter.status ? `&status=${filter.status}` : ""}`)
      .then((d) => {
        setEvents(d.events);
        if (d.events.length > 0 && !selected) setSelected(d.events[0].eventId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api("/api/community").then((d) => setOverview(d.overview)).catch(() => {});
  }, [filter, selected]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full flex">
      {/* Left: event list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Overview metrics */}
        {overview && (
          <div className="border-b border-border px-4 py-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <MetricStat label="Active Events" value={overview.events.active} accent="#f43f5e" />
              <MetricStat label="Pending Witness" value={overview.events.pendingWitness} accent="#fbbf24" />
              <MetricStat label="Verified" value={overview.events.verified} accent="#34d399" />
              <MetricStat label="Citizens" value={overview.citizens.total} sub={`avg ${(overview.citizens.avgScore).toFixed(0)}`} accent="#22d3ee" />
              <MetricStat label="Accuracy" value={overview.events.accuracy !== null ? `${(overview.events.accuracy * 100).toFixed(0)}%` : "—"} accent={overview.events.accuracy >= 0.8 ? "#34d399" : "#fbbf24"} />
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="px-4 py-1.5 border-b border-border flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Status:</span>
          {["", "witnessing", "verified", "resolved", "learned"].map((s) => (
            <button key={s || "all"} onClick={() => setFilter({ status: s || undefined })}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                (filter.status ?? "") === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {s || "all"}
            </button>
          ))}
        </div>

        {/* Event list */}
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {events.map((ev) => {
            const tmeta = TYPE_META[ev.type] ?? TYPE_META.other;
            const smeta = SEVERITY_META[ev.severity] ?? SEVERITY_META.moderate;
            const stmeta = STATUS_META[ev.status] ?? { color: "#a1a1aa", label: ev.status };
            const active = selected === ev.eventId;
            return (
              <button
                key={ev.eventId}
                onClick={() => setSelected(ev.eventId)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-card/60"
                )}
              >
                <div className="flex items-stretch gap-3">
                  <div className="w-1 shrink-0 rounded-full" style={{ background: tmeta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground">{ev.eventId}</span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>
                        {tmeta.icon} {tmeta.label}
                      </span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase" style={{ color: smeta.color, background: smeta.bg }}>
                        {ev.severity}
                      </span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ color: stmeta.color, background: `${stmeta.color}14` }}>
                        {stmeta.label}
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
                        <Clock className="size-2.5" /> {timeAgo(ev.reportedAt)}
                      </span>
                    </div>
                    <div className="text-[12px] font-medium mb-0.5 truncate">{ev.title}</div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {ev.regionId ?? "—"}</span>
                      <span>fused <span className="font-mono font-semibold" style={{ color: tmeta.color }}>{(ev.fusedConfidence * 100).toFixed(0)}%</span></span>
                      <span className="flex items-center gap-1"><Eye className="size-2.5" /> {ev.witnessCount} witnesses ({ev.confirmCount}✓ {ev.rejectCount}✗)</span>
                      {ev.fusedIncidentId && <span className="text-primary/70 flex items-center gap-1"><ArrowRight className="size-2.5" /> {ev.fusedIncidentId}</span>}
                      {ev.outcome && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="size-2.5" /> {ev.outcome}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && events.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Radio className="size-8 opacity-30" />
              <span className="text-xs">No community events yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: event detail */}
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        {selected ? <EventDetail eventId={selected} /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            <Radio className="size-8 opacity-30 mr-2" /> Select an event
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetail({ eventId }: { eventId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/community/events/${eventId}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const ev = data.event;
  const witnesses = data.witnesses || [];
  const tmeta = TYPE_META[ev.type] ?? TYPE_META.other;

  const handleFuse = async () => {
    setBusy("fuse");
    try { await api(`/api/community/events/${eventId}/fuse`, { method: "POST" }); } finally { setBusy(null); }
  };
  const handleResolve = async (outcome: string) => {
    setBusy(outcome);
    try { await api(`/api/community/events/${eventId}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note: `Resolved via Community UI as ${outcome}` }) }); } finally { setBusy(null); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] font-semibold text-muted-foreground">{ev.eventId}</span>
          <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>{tmeta.label}</span>
        </div>
        <div className="text-[12px] font-medium">{ev.title}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-3">
        {/* Description */}
        <div>
          <SectionLabel className="mb-1">Claim</SectionLabel>
          <p className="text-[11px] text-foreground/80 leading-relaxed">{ev.description}</p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-muted-foreground">Reporter</div>
            <div className="font-mono">{ev.citizenId}</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-muted-foreground">Region</div>
            <div className="font-mono">{ev.regionId ?? "—"}</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-muted-foreground">Self-confidence</div>
            <div className="font-mono font-semibold">{(ev.selfConfidence * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-muted-foreground">Fused confidence</div>
            <div className="font-mono font-semibold" style={{ color: tmeta.color }}>{(ev.fusedConfidence * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Witnesses */}
        <div>
          <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Eye className="size-3" /> Witnesses ({witnesses.length})</SectionLabel>
          <div className="space-y-1">
            {witnesses.map((w: any) => {
              const color = w.response === "confirm" ? "#34d399" : w.response === "reject" ? "#f43f5e" : "#a1a1aa";
              const Icon = w.response === "confirm" ? ThumbsUp : w.response === "reject" ? ThumbsDown : HelpCircle;
              return (
                <div key={w.responseId} className="rounded border border-border bg-card/30 px-2 py-1.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className="size-3" style={{ color }} />
                    <span className="font-mono text-[10px] font-medium">{w.witnessId}</span>
                    <span className="text-[9px] rounded px-1 py-0.5" style={{ color, background: `${color}1a` }}>{w.response}</span>
                    <span className="ml-auto text-[9px] text-muted-foreground">civic {w.witnessCivicScore}</span>
                  </div>
                  {w.note && <div className="text-[10px] text-foreground/70">{w.note}</div>}
                  {w.distanceToEventM && <div className="text-[9px] text-muted-foreground mt-0.5">{(w.distanceToEventM / 1000).toFixed(1)}km away</div>}
                </div>
              );
            })}
            {witnesses.length === 0 && <div className="text-[10px] text-muted-foreground italic">No witness responses yet</div>}
          </div>
        </div>

        {/* Outcome */}
        {ev.outcome && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <SectionLabel className="mb-1">Outcome</SectionLabel>
            <div className="text-[11px] font-semibold text-emerald-300 mb-0.5">{ev.outcome}</div>
            {ev.resolutionNote && <div className="text-[10px] text-foreground/70">{ev.resolutionNote}</div>}
            {ev.rewardDistributed && <div className="text-[9px] text-amber-400 mt-1 flex items-center gap-1"><DollarSign className="size-2.5" /> Reward distributed</div>}
          </div>
        )}

        {/* Actions */}
        {!ev.outcome && (
          <div className="space-y-1.5">
            {ev.fusedConfidence >= 0.5 && !ev.fusedIncidentId && (
              <button onClick={handleFuse} disabled={busy === "fuse"}
                className="w-full flex items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] text-primary hover:bg-primary/15 disabled:opacity-50">
                {busy === "fuse" ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
                Fuse to Incident
              </button>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => handleResolve("confirmed")} disabled={!!busy}
                className="flex items-center justify-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                {busy === "confirmed" ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Confirm
              </button>
              <button onClick={() => handleResolve("false_positive")} disabled={!!busy}
                className="flex items-center justify-center gap-1 rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 text-[10px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
                {busy === "false_positive" ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />} False Positive
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: WITNESS QUEUE
// ===========================================================================

function WitnessTab() {
  const [queue, setQueue] = useState<any[]>([]);
  const [citizenId, setCitizenId] = useState<string>("");
  const [citizens, setCitizens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api("/api/community/citizens?limit=20").then((d) => {
      setCitizens(d.citizens);
      if (d.citizens.length > 0) setCitizenId(d.citizens[0].citizenId);
    }).catch(() => {});
  }, []);

  const loadQueue = useCallback(() => {
    if (!citizenId) return;
    api(`/api/community/witness/queue?citizenId=${citizenId}&limit=20`)
      .then((d) => setQueue(d.queue))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [citizenId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleWitness = async (eventId: string, response: string) => {
    setBusy(`${eventId}-${response}`);
    try {
      await api(`/api/community/events/${eventId}/witness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witnessId: citizenId, response, note: `Witness response: ${response}` }),
      });
      loadQueue();
    } finally { setBusy(null); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Eye className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Witness Queue</span>
        <span className="text-[11px] text-muted-foreground">— the Waze mechanism: nearby citizens validate reports</span>
        <select
          value={citizenId}
          onChange={(e) => setCitizenId(e.target.value)}
          className="ml-auto rounded border border-border bg-card px-2 py-1 text-[11px]"
        >
          {citizens.map((c) => <option key={c.citizenId} value={c.citizenId}>{c.handle} ({c.civicScore})</option>)}
        </select>
        <button onClick={loadQueue} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {queue.map((ev) => {
          const tmeta = TYPE_META[ev.type] ?? TYPE_META.other;
          const smeta = SEVERITY_META[ev.severity] ?? SEVERITY_META.moderate;
          return (
            <div key={ev.eventId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: tmeta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{ev.eventId}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: tmeta.color, background: `${tmeta.color}1a` }}>{tmeta.label}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase" style={{ color: smeta.color, background: smeta.bg }}>{ev.severity}</span>
                  </div>
                  <div className="text-[12px] font-medium mb-0.5">{ev.title}</div>
                  <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{ev.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {ev.regionId ?? "—"}</span>
                    <span>fused {(ev.fusedConfidence * 100).toFixed(0)}%</span>
                    <span>{ev.witnessCount} witnesses so far</span>
                  </div>
                  {/* Witness buttons */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleWitness(ev.eventId, "confirm")} disabled={!!busy}
                      className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                      {busy === `${ev.eventId}-confirm` ? <Loader2 className="size-3 animate-spin" /> : <ThumbsUp className="size-3" />} Confirm
                    </button>
                    <button onClick={() => handleWitness(ev.eventId, "reject")} disabled={!!busy}
                      className="flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
                      {busy === `${ev.eventId}-reject` ? <Loader2 className="size-3 animate-spin" /> : <ThumbsDown className="size-3" />} Reject
                    </button>
                    <button onClick={() => handleWitness(ev.eventId, "unknown")} disabled={!!busy}
                      className="flex items-center gap-1 rounded border border-border bg-card/30 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50">
                      {busy === `${ev.eventId}-unknown` ? <Loader2 className="size-3 animate-spin" /> : <HelpCircle className="size-3" />} Can't verify
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && queue.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Eye className="size-8 opacity-30" />
            <span className="text-xs">No events pending witness validation in your region</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: CITIZENS (Leaderboard with Civic Scores)
// ===========================================================================

function CitizensTab() {
  const [citizens, setCitizens] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    api("/api/community/citizens?limit=50")
      .then((d) => {
        setCitizens(d.citizens);
        if (d.citizens.length > 0 && !selected) setSelected(d.citizens[0].citizenId);
        // Load scores for all citizens
        return Promise.all(d.citizens.map((c: any) =>
          api(`/api/community/citizens/${c.citizenId}/score`).then((s) => [c.citizenId, s.score]).catch(() => [c.citizenId, null])
        ));
      })
      .then((entries) => {
        const map: Record<string, any> = {};
        for (const [id, score] of entries) if (score) (map as any)[id as string] = score;
        setScores(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full flex">
      {/* Leaderboard */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <Users className="size-4 text-emerald-400" />
          <span className="text-xs font-semibold">Citizen Leaderboard</span>
          <span className="text-[11px] text-muted-foreground">— ranked by Civic Score (prediction accuracy, not popularity)</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{citizens.length} citizens</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {citizens.map((c, i) => {
            const trust = TRUST_META[c.trustLevel] ?? TRUST_META.new;
            const active = selected === c.citizenId;
            const score = scores[c.citizenId];
            return (
              <button
                key={c.citizenId}
                onClick={() => setSelected(c.citizenId)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-card/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-medium truncate">{c.handle}</span>
                      <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: trust.color, background: `${trust.color}1a` }}>{trust.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{c.citizenId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{c.confirmedReports} confirmed</span>
                      <span>{c.falseReports} false</span>
                      <span>{c.totalWitnessResponses} witnesses</span>
                      <span className="flex items-center gap-1 text-amber-400"><DollarSign className="size-2.5" />{c.totalEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* Score gauge */}
                  <div className="text-right shrink-0">
                    <div className="text-[20px] font-bold font-mono" style={{ color: c.civicScore >= 65 ? "#34d399" : c.civicScore >= 50 ? "#fbbf24" : "#fb923c" }}>
                      {c.civicScore}
                    </div>
                    <div className="text-[9px] text-muted-foreground">/ 100</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: civic score breakdown */}
      <div className="hidden w-[340px] shrink-0 border-l border-border bg-card/20 lg:flex flex-col">
        {selected ? <CivicScoreDetail citizenId={selected} score={scores[selected]} /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            <Users className="size-8 opacity-30 mr-2" /> Select a citizen
          </div>
        )}
      </div>
    </div>
  );
}

function CivicScoreDetail({ citizenId, score }: { citizenId: string; score: any }) {
  const [citizen, setCitizen] = useState<any>(null);
  useEffect(() => {
    api(`/api/community/citizens/${citizenId}`).then((d) => setCitizen(d.citizen)).catch(() => {});
  }, [citizenId]);

  if (!citizen) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  const factors = score?.factors;
  const weights = score?.weights;
  const factorLabels: Record<string, { label: string; icon: React.ElementType }> = {
    accuracy: { label: "Historical Accuracy", icon: CheckCircle2 },
    evidenceQuality: { label: "Evidence Quality", icon: ShieldCheck },
    witnessAgreement: { label: "Witness Agreement", icon: ThumbsUp },
    locationRelevance: { label: "Location Relevance", icon: MapPin },
    responseReliability: { label: "Response Reliability", icon: Clock },
    contributionDiversity: { label: "Contribution Diversity", icon: Network },
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 border-b border-border">
        <div className="text-[12px] font-semibold">{citizen.handle}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{citizen.citizenId}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-3">
        {/* Overall score */}
        <div className="rounded-lg border border-border bg-card/40 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Civic Score</div>
          <div className="text-[36px] font-bold font-mono" style={{ color: citizen.civicScore >= 65 ? "#34d399" : citizen.civicScore >= 50 ? "#fbbf24" : "#fb923c" }}>
            {citizen.civicScore}
          </div>
          <div className="text-[10px] text-muted-foreground">/ 100 · {TRUST_META[citizen.trustLevel]?.label ?? citizen.trustLevel}</div>
          {score?.trendDelta !== null && score?.trendDelta !== undefined && (
            <div className={cn("text-[10px] mt-1 flex items-center justify-center gap-1", score.trendDelta >= 0 ? "text-emerald-400" : "text-rose-400")}>
              <TrendingUp className={cn("size-3", score.trendDelta < 0 && "rotate-180")} />
              {score.trendDelta >= 0 ? "+" : ""}{score.trendDelta} from last update
            </div>
          )}
        </div>

        {/* Factor breakdown */}
        {factors && (
          <div>
            <SectionLabel className="mb-2">Score Factors</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(factorLabels).map(([key, { label, icon: Icon }]) => {
                const value = factors[key];
                const weight = weights?.[key] ?? 0;
                const color = value >= 0.7 ? "#34d399" : value >= 0.5 ? "#fbbf24" : "#fb923c";
                return (
                  <div key={key} className="rounded border border-border bg-card/30 px-2 py-1.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="size-3" style={{ color }} />
                      <span className="text-[11px] flex-1">{label}</span>
                      <span className="font-mono text-[10px] font-semibold" style={{ color }}>{(value * 100).toFixed(0)}%</span>
                      <span className="text-[9px] text-muted-foreground">w {(weight * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground">Reports</div>
            <div className="font-mono text-[14px] font-semibold">{citizen.totalReports}</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground">Confirmed</div>
            <div className="font-mono text-[14px] font-semibold text-emerald-400">{citizen.confirmedReports}</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground">False</div>
            <div className="font-mono text-[14px] font-semibold text-rose-400">{citizen.falseReports}</div>
          </div>
          <div className="rounded border border-border bg-card/30 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground">Earnings</div>
            <div className="font-mono text-[14px] font-semibold text-amber-400">${citizen.totalEarnings.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: REWARDS
// ===========================================================================

function RewardsTab() {
  const [data, setData] = useState<{ pools: any[]; distributions: any[] }>({ pools: [], distributions: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api("/api/community/rewards").then((d) => setData({ pools: d.pools, distributions: d.distributions })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDistributed = data.distributions.reduce((s, d) => s + d.totalAmount, 0);
  const totalBudget = data.pools.reduce((s, p) => s + p.totalBudget, 0);
  const totalRemaining = data.pools.reduce((s, p) => s + (p.totalBudget - p.distributedTotal), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Award className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Incentive Economy</span>
        <span className="text-[11px] text-muted-foreground">— bounty pools + contributor payments</span>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Budget: <span className="font-mono font-semibold text-foreground">${totalBudget.toFixed(0)}</span></span>
          <span>Distributed: <span className="font-mono font-semibold text-amber-400">${totalDistributed.toFixed(0)}</span></span>
          <span>Remaining: <span className="font-mono font-semibold text-emerald-400">${totalRemaining.toFixed(0)}</span></span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
        {/* Reward pools */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Award className="size-3" /> Reward Pools ({data.pools.length})</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.pools.map((p) => {
              const pct = p.totalBudget > 0 ? (p.distributedTotal / p.totalBudget) * 100 : 0;
              const funderColor = p.funder === "government" ? "#34d399" : p.funder === "corporate" ? "#fbbf24" : p.funder === "platform" ? "#22d3ee" : "#a78bfa";
              return (
                <div key={p.poolId} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-6 rounded-md flex items-center justify-center font-bold text-[10px]" style={{ color: funderColor, background: `${funderColor}1a` }}>
                      {p.funderName.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold truncate">{p.name}</div>
                      <div className="text-[9px] text-muted-foreground">{p.funderName} · {p.funder}</div>
                    </div>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: funderColor, background: `${funderColor}1a` }}>
                      {TYPE_META[p.category]?.label ?? p.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{p.description}</p>
                  <div className="flex items-center gap-3 text-[10px] mb-1.5">
                    <span className="font-mono font-semibold text-amber-400">${p.amountPerEvent}</span>
                    <span className="text-muted-foreground">/ event</span>
                    <span className="ml-auto text-muted-foreground">${p.distributedTotal.toFixed(0)} / ${p.totalBudget.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  {/* Split */}
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span>Split:</span>
                    <span className="text-emerald-400">{(p.splitReporter * 100).toFixed(0)}% reporter</span>
                    <span>·</span>
                    <span className="text-cyan-400">{(p.splitWitnesses * 100).toFixed(0)}% witnesses</span>
                    <span>·</span>
                    <span className="text-violet-400">{(p.splitEvidence * 100).toFixed(0)}% evidence</span>
                    <span>·</span>
                    <span>{(p.splitPlatform * 100).toFixed(0)}% platform</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distributions */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5"><DollarSign className="size-3" /> Distributions ({data.distributions.length})</SectionLabel>
          <div className="space-y-1.5">
            {data.distributions.map((d) => (
              <div key={d.distributionId} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] font-semibold text-amber-300">{d.distributionId}</span>
                  <span className="text-[10px] text-muted-foreground">→ {d.eventId}</span>
                  <span className="ml-auto font-mono text-[14px] font-bold text-amber-400">${d.totalAmount.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px]">
                  <div className="rounded bg-card/30 px-1.5 py-1 text-center">
                    <div className="text-muted-foreground">Reporter</div>
                    <div className="font-mono font-semibold text-emerald-400">${d.reporterAmount.toFixed(2)}</div>
                  </div>
                  <div className="rounded bg-card/30 px-1.5 py-1 text-center">
                    <div className="text-muted-foreground">Witnesses</div>
                    <div className="font-mono font-semibold text-cyan-400">${d.witnessesAmount.toFixed(2)}</div>
                  </div>
                  <div className="rounded bg-card/30 px-1.5 py-1 text-center">
                    <div className="text-muted-foreground">Evidence</div>
                    <div className="font-mono font-semibold text-violet-400">${d.evidenceAmount.toFixed(2)}</div>
                  </div>
                  <div className="rounded bg-card/30 px-1.5 py-1 text-center">
                    <div className="text-muted-foreground">Platform</div>
                    <div className="font-mono font-semibold">${d.platformAmount.toFixed(2)}</div>
                  </div>
                </div>
                {/* Recipients */}
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">Recipients:</span>
                  {Object.entries(d.recipientBreakdown).map(([id, amount]: [string, any]) => (
                    id !== "platform" && (
                      <span key={id} className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-mono">
                        {id.slice(0, 10)}: ${amount.toFixed(2)}
                      </span>
                    )
                  ))}
                </div>
              </div>
            ))}
            {data.distributions.length === 0 && !loading && (
              <div className="text-[11px] text-muted-foreground italic">No reward distributions yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: SUBSCRIPTIONS
// ===========================================================================

function SubscriptionsTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/community/subscriptions")
      .then((d) => setSubs(d.subscriptions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Bell className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Regional Subscriptions</span>
        <span className="text-[11px] text-muted-foreground">— users subscribe to region/category/risk → get alerts on verified events</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{subs.length} subscriptions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {subs.map((s) => (
          <div key={s.subscriptionId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{s.subscriptionId}</span>
              <span className="text-[11px] font-medium">{s.citizenId}</span>
              {s.alertCount > 0 && (
                <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-semibold text-cyan-400">
                  <Bell className="size-2.5" /> {s.alertCount} alerts
                </span>
              )}
              <span className="ml-auto text-[9px] text-muted-foreground">{s.active ? "active" : "inactive"}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              {s.regionId ? (
                <span className="flex items-center gap-1 rounded bg-foreground/5 px-1.5 py-0.5"><MapPin className="size-2.5" /> {s.regionId}</span>
              ) : (
                <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-muted-foreground">All regions</span>
              )}
              {s.categories.length > 0 ? (
                s.categories.map((c: string) => (
                  <span key={c} className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: TYPE_META[c]?.color ?? "#a1a1aa", background: `${TYPE_META[c]?.color ?? "#a1a1aa"}1a` }}>
                    {TYPE_META[c]?.label ?? c}
                  </span>
                ))
              ) : (
                <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-muted-foreground">All categories</span>
              )}
              <span className="rounded bg-foreground/5 px-1.5 py-0.5">≥ {s.minSeverity}</span>
              {s.verifiedOnly && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">verified only</span>}
              <span className="rounded bg-foreground/5 px-1.5 py-0.5">conf ≥ {(s.minConfidence * 100).toFixed(0)}%</span>
            </div>
            {s.lastAlertAt && (
              <div className="text-[9px] text-muted-foreground mt-1">Last alert: {timeAgo(s.lastAlertAt)}</div>
            )}
          </div>
        ))}
        {!loading && subs.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bell className="size-8 opacity-30" />
            <span className="text-xs">No subscriptions yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INTELLIGENCE PRODUCERS (unified reputation graph)
// ===========================================================================

function ProducersTab() {
  const [producers, setProducers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api(`/api/community/producers?limit=50${filter ? `&type=${filter}` : ""}`)
      .then((d) => setProducers(d.producers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <Network className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Intelligence Producer Reputation Graph</span>
        <span className="text-[11px] text-muted-foreground">— unified: agents + citizens + sensors + organizations</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Type:</span>
          {["", "agent", "citizen", "sensor", "organization"].map((t) => (
            <button key={t || "all"} onClick={() => setFilter(t)}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                (filter ?? "") === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {t || "all"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {producers.map((p, i) => {
          const meta = PRODUCER_TYPE_META[p.producerType] ?? PRODUCER_TYPE_META.citizen;
          const trust = TRUST_META[p.trustLevel] ?? TRUST_META.new;
          const Icon = meta.icon;
          const pct = p.reputationScore * 100;
          return (
            <div key={p.producerId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px] font-bold w-6 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
                <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0")} style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-medium truncate">{p.name}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                    <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: trust.color, background: `${trust.color}1a` }}>{trust.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.producerId}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{p.totalContributions} contributions</span>
                    <span className="text-emerald-400">{p.confirmedContributions} confirmed</span>
                    {p.falseContributions > 0 && <span className="text-rose-400">{p.falseContributions} false</span>}
                  </div>
                </div>
                {/* Reputation score */}
                <div className="text-right shrink-0">
                  <div className="text-[18px] font-bold font-mono" style={{ color: pct >= 70 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#fb923c" }}>
                    {pct.toFixed(0)}<span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground">reputation</div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && producers.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Network className="size-8 opacity-30" />
            <span className="text-xs">No intelligence producers yet</span>
          </div>
        )}

        {/* Architecture explainer */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Network className="size-4 text-primary" />
            <span className="text-[11px] font-semibold text-primary">UNIFIED REPUTATION GRAPH</span>
          </div>
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            Every intelligence producer — whether an AI agent, a citizen, a sensor, or an organization —
            has a unified reputation score. Citizens with high civic scores carry the same weight as
            certified agents. This is the third intelligence source: <span className="text-primary font-medium">machine intelligence</span> (satellites/agents) +
            <span className="text-primary font-medium"> agent intelligence</span> (reasoning) +
            <span className="text-primary font-medium"> human intelligence</span> (community). Together they form a true national intelligence network.
          </p>
        </div>
      </div>
    </div>
  );
}
