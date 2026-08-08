"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import { MissionDetail } from "@/components/gdt/MissionDetail";
import {
  Loader2, Target, Zap, DollarSign, Users, MapPin, Clock,
  TrendingUp, ChevronRight, CheckCircle2, Crosshair,
  Satellite, Plane, Radar, ClipboardCheck,
} from "lucide-react";

const MISSION_ICONS: Record<string, React.ElementType> = {
  satellite_revisit: Satellite,
  sar_tasking: Radar,
  drone: Plane,
  community: Users,
  inspector: ClipboardCheck,
  iot: Zap,
};

const MISSION_COLORS: Record<string, string> = {
  satellite_revisit: "#34d399",
  sar_tasking: "#a78bfa",
  drone: "#22d3ee",
  community: "#84cc16",
  inspector: "#fbbf24",
  iot: "#fb923c",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#f43f5e",
  high: "#fb923c",
  normal: "#fbbf24",
  low: "#34d399",
};

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function MissionsConsumerView() {
  const [missions, setMissions] = useState<any[]>([]);
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"missions" | "bounties">("missions");
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [participantStats, setParticipantStats] = useState<Record<string, { participants: number }>>({});

  const load = useCallback(() => {
    Promise.all([
      api("/api/missions?limit=20").catch(() => ({ missions: [] })),
      api("/api/marketplace/bounties?status=open").catch(() => ({ bounties: [] })),
    ]).then(([m, b]) => {
      const missionList = m.missions || [];
      setMissions(missionList);
      setBounties(b.bounties || []);
      // Load participant counts in batch
      const ids = missionList.map((mi: any) => mi.id).filter(Boolean).join(",");
      if (ids) {
        fetch(`/api/missions/stats?ids=${ids}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.stats) setParticipantStats(data.stats); })
          .catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
        <h1 className="text-[20px] md:text-[24px] font-bold flex items-center gap-2">
          <Target className="size-6 text-cyan-500" /> Missions
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1 hidden sm:block">Join intelligence missions and earn rewards</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 border-b border-border px-4 md:px-6 py-2 overflow-x-auto">
        <button onClick={() => setTab("missions")}
          className={cn("rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
            tab === "missions" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
          Active Missions ({missions.length})
        </button>
        <button onClick={() => setTab("bounties")}
          className={cn("rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
            tab === "bounties" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
          Intelligence Bounties ({bounties.length})
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-3 md:space-y-4">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-foreground/15 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-48 rounded bg-foreground/15 animate-pulse" />
                      <div className="h-4 w-16 rounded-full bg-foreground/10 animate-pulse" />
                    </div>
                    <div className="h-4 w-full rounded bg-foreground/10 animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-foreground/10 animate-pulse" />
                    <div className="flex items-center gap-4 mt-2">
                      <div className="h-4 w-20 rounded bg-foreground/10 animate-pulse" />
                      <div className="h-4 w-16 rounded bg-foreground/10 animate-pulse" />
                      <div className="h-4 w-14 rounded bg-foreground/10 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Missions tab */}
        {tab === "missions" && missions.map((m) => {
          const Icon = MISSION_ICONS[m.type] ?? Crosshair;
          const color = MISSION_COLORS[m.type] ?? "#a1a1aa";
          const priColor = PRIORITY_COLORS[m.priority] ?? "#71717a";
          return (
            <div key={m.id} onClick={() => setSelectedMission(m)} className="rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}15` }}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[17px] font-semibold">{m.title}</h3>
                    <span className="rounded-full px-2 py-0.5 text-[13px] font-medium" style={{ color: priColor, background: `${priColor}15` }}>
                      {m.priority}
                    </span>
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[13px]">{m.status}</span>
                  </div>
                  <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{m.reasoning}</p>
                  <div className="flex items-center gap-3 md:gap-4 mt-3 text-[14px] flex-wrap">
                    <span className="flex items-center gap-1 font-medium" style={{ color }}>
                      <Zap className="size-4" /> EVI {m.evi?.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="size-4" /> {(m.informationGain * 100).toFixed(0)}% info gain
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="size-4" /> {m.cost === 0 ? "Free" : `$${m.cost}`}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-4" /> {timeAgo(m.createdAt)}
                    </span>
                  </div>

                  {/* Progress + participants */}
                  {(() => {
                    const participants = participantStats[m.id]?.participants ?? 0;
                    const progressPct = Math.min(100, Math.round((m.informationGain ?? 0) * 100));
                    const targetPct = 75;
                    return (
                      <div className="mt-3 space-y-1.5">
                        {/* Progress bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progressPct}%`,
                                background: progressPct >= targetPct ? '#34d399' : color,
                              }}
                            />
                          </div>
                          <span className="text-[12px] font-mono text-muted-foreground shrink-0">
                            {progressPct}% / {targetPct}%
                          </span>
                        </div>
                        {/* Participants + join button row */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                            <Users className="size-3.5" /> {participants} {participants === 1 ? 'participant' : 'participants'}
                          </span>
                          {m.status === "planned" && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedMission(m); }} className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[14px] font-medium text-primary hover:bg-primary/15 transition-colors">
                              <CheckCircle2 className="size-4" /> Join Mission
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <ChevronRight className="size-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          );
        })}

        {/* Bounties tab */}
        {tab === "bounties" && bounties.map((b) => (
          <div key={b.bountyId} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <DollarSign className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[17px] font-semibold">{b.title}</h3>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[13px] font-medium text-emerald-500">
                    {b.status}
                  </span>
                </div>
                <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed">{b.description}</p>
                <div className="flex items-center gap-3 md:gap-4 mt-3 text-[14px] flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-amber-500">
                    <DollarSign className="size-4" /> {b.rewardPerSubmission?.toLocaleString()} IC per submission
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="size-4" /> {b.submissionCount} submitted · {b.acceptedCount} accepted
                  </span>
                  {b.geography && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-4" /> {b.geography}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="size-4" /> {(b.totalBudget / 1000).toFixed(0)}K IC budget
                  </span>
                </div>
                <button className="mt-3 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[14px] font-medium text-primary hover:bg-primary/15 transition-colors">
                  <Target className="size-4" /> Submit Intelligence
                </button>
              </div>
              <ChevronRight className="size-5 text-muted-foreground shrink-0 mt-1" />
            </div>
          </div>
        ))}

        {!loading && tab === "missions" && missions.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Target className="size-8 opacity-30" />
            <span className="text-[15px]">No active missions</span>
          </div>
        )}
        {!loading && tab === "bounties" && bounties.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <DollarSign className="size-8 opacity-30" />
            <span className="text-[15px]">No open bounties</span>
          </div>
        )}
      </div>

      {/* Mission Detail Dialog */}
      <MissionDetail
        mission={selectedMission}
        onOpenChange={(open) => { if (!open) setSelectedMission(null); }}
      />
    </div>
  );
}
