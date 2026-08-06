"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Loader2, Users, MapPin, Shield, Award, CheckCircle2,
  ThumbsUp, ThumbsDown, HelpCircle, Eye, TrendingUp, Zap,
} from "lucide-react";

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
      <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
        <h1 className="text-[20px] md:text-[24px] font-bold flex items-center gap-2">
          <Users className="size-6 text-emerald-500" /> Community
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1 hidden sm:block">Citizen intelligence network — reports, witnesses, and community reputation</p>
      </div>

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
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}

        {/* Events tab */}
        {tab === "events" && events.map((ev) => {
          const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.other;
          const smeta = STATUS_META[ev.status] ?? STATUS_META.created;
          return (
            <div key={ev.eventId} className="rounded-xl border border-border bg-card p-4 shadow-card">
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
                      <button onClick={() => handleWitness(ev.eventId, "confirm")} disabled={!!busy}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[14px] font-medium text-emerald-500 hover:bg-emerald-500/15 transition-colors disabled:opacity-50">
                        {busy === `${ev.eventId}-confirm` ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} Confirm
                      </button>
                      <button onClick={() => handleWitness(ev.eventId, "reject")} disabled={!!busy}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[14px] font-medium text-rose-500 hover:bg-rose-500/15 transition-colors disabled:opacity-50">
                        {busy === `${ev.eventId}-reject` ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4" />} Reject
                      </button>
                      <button onClick={() => handleWitness(ev.eventId, "unknown")} disabled={!!busy}
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

        {/* Citizens tab */}
        {tab === "citizens" && citizens.map((c, i) => (
          <div key={c.citizenId} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[18px] font-bold w-8 text-center" style={{ color: i < 3 ? "#fbbf24" : "#71717a" }}>#{i + 1}</span>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-[16px] bg-primary/15 text-primary">
                {c.handle.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-medium">{c.handle}</span>
                  <span className="rounded-full px-2 py-0.5 text-[13px] font-medium capitalize" style={{
                    color: c.trustLevel === "expert" ? "#22d3ee" : c.trustLevel === "verified" ? "#34d399" : c.trustLevel === "trusted" ? "#fbbf24" : "#a1a1aa",
                    background: `${c.trustLevel === "expert" ? "#22d3ee" : c.trustLevel === "verified" ? "#34d399" : c.trustLevel === "trusted" ? "#fbbf24" : "#a1a1aa"}15`
                  }}>{c.trustLevel}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[14px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Award className="size-4 text-amber-500" /> Civic {c.civicScore.toFixed(0)}</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="size-4 text-emerald-500" /> {c.confirmedReports} confirmed</span>
                  <span className="flex items-center gap-1"><Eye className="size-4 text-teal-500" /> {c.totalWitnessResponses} witnessed</span>
                  {c.totalEarnings > 0 && <span className="flex items-center gap-1 text-amber-500"><Zap className="size-4" /> {c.totalEarnings.toFixed(0)} IC</span>}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && tab === "events" && events.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="size-8 opacity-30" />
            <span className="text-[15px]">No community reports yet</span>
          </div>
        )}
        {!loading && tab === "citizens" && citizens.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Award className="size-8 opacity-30" />
            <span className="text-[15px]">No citizens registered yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
