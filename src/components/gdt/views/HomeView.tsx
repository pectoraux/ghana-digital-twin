"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Loader2, MapPin, Shield, Award, TrendingUp, Zap, Users,
  AlertTriangle, Target, CheckCircle2, ChevronRight, Activity,
  Building2, Eye, Brain, Radio,
} from "lucide-react";

const FEED_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ALERT: { color: "#f43f5e", icon: AlertTriangle, label: "Alert" },
  REPORT: { color: "#fbbf24", icon: Eye, label: "Report" },
  ANALYSIS: { color: "#a78bfa", icon: TrendingUp, label: "Analysis" },
  MISSION: { color: "#22d3ee", icon: Target, label: "Mission" },
  ANNOUNCEMENT: { color: "#34d399", icon: CheckCircle2, label: "Announcement" },
  ASSET: { color: "#38bdf8", icon: Zap, label: "Asset" },
  DISCUSSION: { color: "#84cc16", icon: Users, label: "Discussion" },
};

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function HomeView() {
  const { data: session } = useSession();
  const setView = useGDT((s) => s.setView);
  const [identity, setIdentity] = useState<any>(null);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    Promise.all([
      api(`/api/identity?userId=${userId}`).catch(() => ({ identity: null })),
      api("/api/feed?limit=5").catch(() => ({ items: [] })),
      api("/api/missions?limit=3").catch(() => ({ missions: [] })),
    ]).then(([idRes, feedRes, missionRes]) => {
      setIdentity(idRes.identity);
      setFeedItems(feedRes.items || []);
      setMissions(missionRes.missions || []);
    }).finally(() => setLoading(false));
  }, [session]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const name = identity?.profile?.displayName ?? session?.user?.name ?? "there";
  const firstName = name.split(" ")[0];
  const region = identity?.profile?.region ?? "Ghana";
  const rep = identity?.reputation;
  const org = identity?.organization;
  const role = (session?.user as any)?.role ?? "CITIZEN";

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-[28px] font-bold">{greeting}, {firstName}</h1>
          <p className="text-[15px] text-muted-foreground mt-1 flex items-center gap-2">
            <MapPin className="size-4" /> {region}, Ghana
            {org && <><span>·</span><Building2 className="size-4" /> {org.orgName}</>}
          </p>
        </div>

        {/* Reputation snapshot */}
        {rep && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Shield className="size-5 text-teal-500 mb-2" />
              <div className="text-[32px] font-bold font-mono">{rep.trustScore.toFixed(0)}</div>
              <div className="text-[13px] text-muted-foreground">Trust Score</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Award className="size-5 text-amber-500 mb-2" />
              <div className="text-[32px] font-bold font-mono">{rep.civicScore.toFixed(0)}</div>
              <div className="text-[13px] text-muted-foreground">Civic Score</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Eye className="size-5 text-emerald-500 mb-2" />
              <div className="text-[32px] font-bold font-mono">{rep.totalReports}</div>
              <div className="text-[13px] text-muted-foreground">Reports Filed</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <CheckCircle2 className="size-5 text-violet-500 mb-2" />
              <div className="text-[32px] font-bold font-mono">{rep.totalVerified}</div>
              <div className="text-[13px] text-muted-foreground">Verified</div>
            </div>
          </div>
        )}

        {/* Intelligence Pulse */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="size-5 text-primary" />
            <h2 className="text-[20px] font-semibold">Intelligence Pulse</h2>
            <span className="ml-auto text-[13px] text-muted-foreground">{feedItems.length} new events</span>
            <button onClick={() => setView("feed")} className="text-[14px] font-medium text-primary hover:underline">View All →</button>
          </div>
          <div className="space-y-3">
            {feedItems.length === 0 && (
              <div className="text-[15px] text-muted-foreground py-4 text-center">No recent intelligence in your area</div>
            )}
            {feedItems.map((item) => {
              const meta = FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT;
              const Icon = meta.icon;
              return (
                <div key={item.feedItemId} onClick={() => setView("feed")} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 hover:bg-accent/30 transition-colors cursor-pointer">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ color: meta.color, background: `${meta.color}15` }}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium truncate">{item.title}</span>
                      <span className="text-[13px] text-muted-foreground shrink-0">{timeAgo(item.publishedAt)}</span>
                    </div>
                    <p className="text-[14px] text-muted-foreground line-clamp-1 mt-0.5">{item.summary}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[13px]">
                      <span className="text-muted-foreground">by {item.creatorName}</span>
                      {item.region && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3" /> {item.region}</span>}
                      <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                        {item.confidence > 0 ? `${(item.confidence * 100).toFixed(0)}% confidence` : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Missions */}
        {missions.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Target className="size-5 text-cyan-500" />
              <h2 className="text-[20px] font-semibold">Active Missions</h2>
              <button onClick={() => setView("missions")} className="ml-auto text-[14px] font-medium text-primary hover:underline">View All →</button>
            </div>
            <div className="space-y-3">
              {missions.map((m) => (
                <div key={m.id} onClick={() => setView("missions")} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 hover:bg-accent/30 transition-colors cursor-pointer">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500">
                    <Target className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{m.title}</div>
                    <p className="text-[14px] text-muted-foreground line-clamp-1">{m.reasoning}</p>
                    <div className="flex items-center gap-3 mt-1 text-[13px]">
                      <span className="flex items-center gap-1 text-amber-500"><Zap className="size-3" /> EVI {m.evi?.toFixed(2)}</span>
                      <span className="text-muted-foreground">{m.priority}</span>
                      <span className="text-muted-foreground">{m.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => setView("feed")} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-all">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Zap className="size-5" /></div>
            <span className="text-[14px] font-medium">Report Event</span>
          </button>
          <button onClick={() => setView("community")} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-all">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="size-5" /></div>
            <span className="text-[14px] font-medium">Verify Event</span>
          </button>
          <button onClick={() => setView("rewards")} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-all">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500"><Award className="size-5" /></div>
            <span className="text-[14px] font-medium">View Rewards</span>
          </button>
          <button onClick={() => setView("missions")} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-all">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500"><Brain className="size-5" /></div>
            <span className="text-[14px] font-medium">Join Missions</span>
          </button>
        </div>
      </div>
    </div>
  );
}
