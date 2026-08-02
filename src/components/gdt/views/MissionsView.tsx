"use client";

import { useEffect, useState } from "react";
import { fetchMissions, planMissions, completeMission, updateSchedule, fetchSchedule } from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Crosshair,
  Loader2,
  Zap,
  Satellite,
  Radar,
  Plane,
  Users,
  ClipboardCheck,
  Gauge,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
} from "lucide-react";

const MISSION_ICONS: Record<string, React.ElementType> = {
  satellite_revisit: Satellite,
  sar_tasking: Radar,
  drone: Plane,
  community: Users,
  inspector: ClipboardCheck,
  iot: Gauge,
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

export function MissionsView() {
  const [missions, setMissions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedule, setSchedule] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([fetchMissions(), fetchSchedule()])
      .then(([m, s]) => {
        setMissions(m.missions);
        setStats(m.stats);
        setTypes(m.types);
        setSchedule(s.schedules || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePlan = async () => {
    setPlanning(true);
    try {
      // plan missions for all observations with uncertain hypotheses
      // find observations with primary hypotheses below 75% confidence
      const obsRes = await fetch("/api/observations?limit=50");
      const obsData = await obsRes.json();
      let totalCreated = 0;
      for (const obs of obsData.observations) {
        const result = await planMissions({ observationId: obs.id });
        totalCreated += result.created || 0;
      }
      load();
    } finally { setPlanning(false); }
  };

  const handleSchedule = async () => {
    setScheduling(true);
    try { await updateSchedule(); } finally { setScheduling(false); load(); }
  };

  const handleComplete = async (missionId: string) => {
    await completeMission(missionId, "success");
    load();
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: mission list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Crosshair className="size-4 text-primary" /> Mission Planning
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {stats?.total ?? 0} missions · {stats?.urgent ?? 0} urgent
            </span>
            <p className="text-[15px] text-muted-foreground hidden lg:block">
              Autonomous evidence acquisition · EVI-optimized
            </p>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleSchedule}
                disabled={scheduling}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {scheduling ? <Loader2 className="size-3.5 animate-spin" /> : <Calendar className="size-3.5" />}
                Update Schedule
              </button>
              <button
                onClick={handlePlan}
                disabled={planning}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
              >
                {planning ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                Plan Missions
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Total" value={stats?.total ?? 0} accent="#34d399" />
            <MetricStat label="Planned" value={stats?.planned ?? 0} sub="awaiting execution" accent="#fbbf24" />
            <MetricStat label="Urgent" value={stats?.urgent ?? 0} sub="high priority" accent="#f43f5e" />
            <MetricStat label="Completed" value={stats?.completed ?? 0} sub="evidence collected" accent="#2dd4bf" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && missions.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Crosshair className="size-8 opacity-30" />
              <span className="text-xs">No missions planned. Click "Plan Missions" to identify<br />what evidence the system needs next.</span>
            </div>
          )}
          {missions.map((m) => {
            const Icon = MISSION_ICONS[m.type] ?? Crosshair;
            const color = MISSION_COLORS[m.type] ?? "#a1a1aa";
            const priColor = PRIORITY_COLORS[m.priority] ?? "#71717a";
            return (
              <div key={m.id} className="flex items-stretch gap-3 rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <div className="w-1 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className="size-3.5" style={{ color }} />
                    <span className="text-[16px] font-medium truncate flex-1">{m.title}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: priColor, background: `${priColor}1a` }}>
                      {m.priority}
                    </span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-medium text-muted-foreground bg-foreground/5">
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[14px] text-muted-foreground mb-1">
                    <span className="flex items-center gap-1"><TrendingUp className="size-2.5" /> info gain {(m.informationGain * 100).toFixed(0)}%</span>
                    <span className="flex items-center gap-1"><DollarSign className="size-2.5" /> {m.cost === 0 ? "free" : `$${m.cost}`}</span>
                    <span className="flex items-center gap-1 font-mono font-semibold" style={{ color }}>EVI {m.evi > 1 ? m.evi.toFixed(1) : m.evi.toFixed(3)}</span>
                    <span className="flex items-center gap-1"><Clock className="size-2.5" /> {timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="text-[15px] text-foreground/70 leading-snug line-clamp-2">{m.reasoning}</p>
                  {m.status === "planned" && (
                    <button
                      onClick={() => handleComplete(m.id)}
                      className="mt-1.5 flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[14px] text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="size-3" /> Mark Complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: mission types + schedule */}
      <div className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Crosshair className="size-3.5 text-primary" /> Mission Types
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-4">
          {/* mission type reference */}
          <div>
            <SectionLabel className="mb-2">EVI Reference Table</SectionLabel>
            <div className="space-y-1">
              {types.map((t) => {
                const Icon = MISSION_ICONS[t.type] ?? Crosshair;
                const color = MISSION_COLORS[t.type] ?? "#a1a1aa";
                const evi = t.baseCost > 0 ? t.baseInfoGain / t.baseCost : t.baseInfoGain * 100;
                return (
                  <div key={t.type} className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="size-3" style={{ color }} />
                      <span className="text-[15px] font-medium">{t.label}</span>
                      <span className="ml-auto font-mono text-[13px] font-semibold" style={{ color }}>
                        EVI {evi > 1 ? evi.toFixed(1) : evi.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                      <span>gain {(t.baseInfoGain * 100).toFixed(0)}%</span>
                      <span>{t.baseCost === 0 ? "free" : `$${t.baseCost}`}</span>
                      <span>{t.estimatedTime}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* autonomous schedule */}
          {schedule.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Observation Schedule</SectionLabel>
              <div className="space-y-1">
                {schedule.slice(0, 10).map((s) => {
                  const tierColor = s.tier === "high" ? "#f43f5e" : s.tier === "medium" ? "#fbbf24" : "#34d399";
                  return (
                    <div key={s.tileId} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2 py-1 text-[14px]">
                      <span className="size-2 rounded-full" style={{ background: tierColor }} />
                      <span className="font-mono text-muted-foreground truncate flex-1">{s.tileId}</span>
                      <span style={{ color: tierColor }}>{s.tier}</span>
                      <span className="text-muted-foreground">{s.frequency}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* architecture explanation */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="size-4 text-primary" />
              <span className="text-[15px] font-semibold text-primary">AUTONOMOUS INTELLIGENCE LOOP</span>
            </div>
            <p className="text-[16px] text-foreground/80 leading-relaxed">
              The platform actively decides what evidence it needs next. For each uncertain hypothesis,
              it identifies missing evidence and creates missions ranked by Expected Value of Information
              (EVI = information gain ÷ cost). The loop closes: observe → reason → plan → collect → re-observe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
