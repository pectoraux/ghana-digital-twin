"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Loader2, Users, MapPin, Shield, Award, CheckCircle2,
  ThumbsUp, ThumbsDown, HelpCircle, Eye, TrendingUp, Zap,
  Plus, Trophy, Crown, Medal, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunityReportModal } from "@/components/gdt/CommunityReportModal";
import { CommunityEventDetail } from "@/components/gdt/CommunityEventDetail";

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const EVENT_TYPE_META: Record<string, { color: string; label: string; icon: string }> = {
  illegal_mining: { color: "#f43f5e", label: "Illegal Mining", icon: "⛏" },
  flood_risk: { color: "#38bdf8", label: "Flood Risk", icon: "🌊" },
  deforestation: { color: "#84cc16", label: "Deforestation", icon: "🌲" },
  water_pollution: { color: "#22d3ee", label: "Water Pollution", icon: "💧" },
  cocoa_disease: { color: "#fbbf24", label: "Cocoa Disease", icon: "🍫" },
  other: { color: "#a1a1aa", label: "Other", icon: "📋" },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  witnessing: { color: "#fbbf24", label: "Needs Witnesses" },
  resolved: { color: "#34d399", label: "Resolved" },
  learned: { color: "#22d3ee", label: "Learned" },
  created: { color: "#a1a1aa", label: "New" },
};

export function CommunityConsumerView() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<any[]>([]);
  const [citizens, setCitizens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"events" | "citizens">("events");
  const [busy, setBusy] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api("/api/community/events?limit=20").catch(() => ({ events: [] })),
      api("/api/community/citizens?limit=10").catch(() => ({ citizens: [] })),
    ]).then(([e, c]) => {
      setEvents(e.events || []);
      setCitizens(c.citizens || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWitness = async (eventId: string, response: string) => {
    setBusy(`${eventId}-${response}`);
    try {
      const userId = (session?.user as any)?.id;
      // Use the first citizen as the witness for demo purposes
      const citizens = await api("/api/community/citizens?limit=1").catch(() => ({ citizens: [] }));
      const witnessId = citizens.citizens?.[0]?.citizenId ?? "cit-demo";
      await fetch(`/api/community/events/${eventId}/witness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witnessId, response, note: `Witness response: ${response}` }),
      });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 md:px-6 py-3 md:py-4">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-bold flex items-center gap-2">
            <Users className="size-6 text-emerald-500" /> Community
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1 hidden sm:block">Citizen intelligence network — reports, witnesses, and community reputation</p>
        </div>
        <Button onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 shrink-0">
          <Plus className="size-4" /> <span className="hidden sm:inline">Report Incident</span>
        </Button>
      </div>

      <CommunityReportModal open={reportOpen} onOpenChange={setReportOpen} onSubmitted={load} />

      {/* Tab switcher */}
      <div className="flex items-center gap-2 border-b border-border px-4 md:px-6 py-2 overflow-x-auto">
        <button onClick={() => setTab("events")}
          className={cn("rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
            tab === "events" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
          Active Reports ({events.length})
        </button>
        <button onClick={() => setTab("citizens")}
          className={cn("rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
            tab === "citizens" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
          Top Contributors ({citizens.length})
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-3 md:space-y-4">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-foreground/15 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-24 rounded-full bg-foreground/10 animate-pulse" />
                      <div className="h-4 w-16 rounded-full bg-foreground/10 animate-pulse" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-foreground/15 animate-pulse" />
                    <div className="h-4 w-full rounded bg-foreground/10 animate-pulse" />
                    <div className="flex items-center gap-4 mt-2">
                      <div className="h-4 w-16 rounded bg-foreground/10 animate-pulse" />
                      <div className="h-4 w-20 rounded bg-foreground/10 animate-pulse" />
                      <div className="h-4 w-14 rounded bg-foreground/10 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Events tab */}
        {tab === "events" && events.map((ev) => {
          const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.other;
          const smeta = STATUS_META[ev.status] ?? STATUS_META.created;
          return (
            <div key={ev.eventId} onClick={() => setSelectedEventId(ev.eventId)} className="rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[18px]" style={{ color: meta.color, background: `${meta.color}15` }}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[14px] font-semibold text-muted-foreground">{ev.eventId}</span>
                    <span className="rounded-full px-2 py-0.5 text-[13px] font-medium" style={{ color: meta.color, background: `${meta.color}15` }}>{meta.label}</span>
                    <span className="rounded-full px-2 py-0.5 text-[13px] font-medium" style={{ color: smeta.color, background: `${smeta.color}15` }}>{smeta.label}</span>
                    <span className="ml-auto text-[14px] text-muted-foreground">{timeAgo(ev.reportedAt)}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold mt-1">{ev.title}</h3>
                  <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed">{ev.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-[14px] flex-wrap">
                    <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" /> {ev.regionId ?? "Unknown"}</span>
                    <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                      <Shield className="size-4" /> {(ev.fusedConfidence * 100).toFixed(0)}% confidence
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Eye className="size-4" /> {ev.witnessCount} witnesses</span>
                    {ev.confirmCount > 0 && <span className="flex items-center gap-1 text-emerald-500"><ThumbsUp className="size-4" /> {ev.confirmCount} confirmed</span>}
                    {ev.rejectCount > 0 && <span className="flex items-center gap-1 text-rose-500"><ThumbsDown className="size-4" /> {ev.rejectCount} rejected</span>}
                  </div>
                  {ev.status === "witnessing" && (
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={(e) => { e.stopPropagation(); handleWitness(ev.eventId, "confirm"); }} disabled={!!busy}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[14px] font-medium text-emerald-500 hover:bg-emerald-500/15 transition-colors disabled:opacity-50">
                        {busy === `${ev.eventId}-confirm` ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} Confirm
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleWitness(ev.eventId, "reject"); }} disabled={!!busy}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[14px] font-medium text-rose-500 hover:bg-rose-500/15 transition-colors disabled:opacity-50">
                        {busy === `${ev.eventId}-reject` ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4" />} Reject
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleWitness(ev.eventId, "unknown"); }} disabled={!!busy}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-1.5 text-[14px] text-muted-foreground hover:bg-card/50 transition-colors disabled:opacity-50">
                        {busy === `${ev.eventId}-unknown` ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />} Can't verify
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Citizens tab — leaderboard style */}
        {tab === "citizens" && citizens.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-5 text-amber-500" />
              <h2 className="text-[16px] font-semibold">Top Contributors Leaderboard</h2>
            </div>
            <p className="text-[13px] text-muted-foreground">Climb the ranks by reporting, verifying, and contributing to the community.</p>
          </div>
        )}
        {tab === "citizens" && citizens.map((c, i) => {
          const rankColors = ['#fbbf24', '#a1a1aa', '#fb923c'];
          const rankColor = i < 3 ? rankColors[i] : '#71717a';
          const RankIcon = i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Medal : null;
          const trustColors: Record<string, string> = { expert: '#22d3ee', verified: '#34d399', trusted: '#fbbf24', new: '#a1a1aa' };
          const trustColor = trustColors[c.trustLevel] ?? '#a1a1aa';
          return (
            <div key={c.citizenId} className={cn("rounded-xl border bg-card p-4 shadow-card transition-colors", i < 3 ? "border-amber-500/20" : "border-border")}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-12 shrink-0">
                  {RankIcon ? (
                    <RankIcon className="size-6" style={{ color: rankColor }} />
                  ) : (
                    <span className="font-mono text-[16px] font-bold text-muted-foreground">#{i + 1}</span>
                  )}
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-[16px] bg-primary/15 text-primary">
                  {c.handle.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[16px] font-medium">{c.handle}</span>
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-medium capitalize" style={{ color: trustColor, background: `${trustColor}15` }}>{c.trustLevel}</span>
                    {i === 0 && <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500"><Crown className="size-3" /> #1 Contributor</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[13px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Award className="size-3.5 text-amber-500" /> Civic {c.civicScore.toFixed(0)}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-500" /> {c.confirmedReports} confirmed</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5 text-teal-500" /> {c.totalWitnessResponses} witnessed</span>
                    {c.totalEarnings > 0 && <span className="flex items-center gap-1 text-amber-500"><Zap className="size-3.5" /> {c.totalEarnings.toFixed(0)} IC</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && tab === "events" && events.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Users className="size-8 text-emerald-500/50" />
            </div>
            <div>
              <p className="text-[16px] font-medium">No active reports in your area</p>
              <p className="text-[14px] text-muted-foreground mt-1">Be the first to report what you see. Your community needs your eyes.</p>
            </div>
            <Button onClick={() => setReportOpen(true)} className="mt-2 flex items-center gap-1.5">
              <Plus className="size-4" /> Report an Incident
            </Button>
          </div>
        )}
        {!loading && tab === "citizens" && citizens.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-amber-500/10">
              <Trophy className="size-8 text-amber-500/50" />
            </div>
            <div>
              <p className="text-[16px] font-medium">Leaderboard is warming up</p>
              <p className="text-[14px] text-muted-foreground mt-1">Start reporting and verifying to climb the ranks!</p>
            </div>
          </div>
        )}
      </div>

      {/* Community Event Detail Dialog */}
      <CommunityEventDetail
        eventId={selectedEventId}
        onOpenChange={(open) => { if (!open) setSelectedEventId(null); }}
      />
    </div>
  );
}
