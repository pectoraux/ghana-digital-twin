"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Home, Plus, Bell, User, Loader2, MapPin, Shield, TrendingUp,
  Award, CheckCircle2, XCircle, Eye, Zap, ChevronRight, LogOut,
  Building2, AlertTriangle, FileText, Target, Package,
} from "lucide-react";

const FEED_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ALERT: { color: "#f43f5e", icon: AlertTriangle, label: "Alert" },
  REPORT: { color: "#fbbf24", icon: FileText, label: "Report" },
  ANALYSIS: { color: "#a78bfa", icon: TrendingUp, label: "Analysis" },
  MISSION: { color: "#22d3ee", icon: Target, label: "Mission" },
  DISCUSSION: { color: "#84cc16", icon: User, label: "Discussion" },
  ASSET: { color: "#38bdf8", icon: Package, label: "Asset" },
  ANNOUNCEMENT: { color: "#34d399", icon: CheckCircle2, label: "Announcement" },
};

type Tab = "home" | "report" | "alerts" | "profile";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "report", label: "Report", icon: Plus },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function CommunityAppShell({ identity, session }: { identity: any; session: any }) {
  const [tab, setTab] = useState<Tab>("home");
  const user = session?.user;
  const role = (user as any)?.role ?? "CITIZEN";
  const name = user?.name ?? "User";

  const rep = identity?.reputation;
  const profile = identity?.profile;
  const org = identity?.organization;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar — user identity */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
            <span className="text-xs font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[16px] font-semibold">{name}</span>
            <span className="text-[13px] text-muted-foreground">{role.replace(/_/g, " ").toLowerCase()}</span>
          </div>
        </div>
        {/* Trust/Civic indicators */}
        {rep && (
          <div className="ml-4 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Shield className="size-3 text-cyan-400" />
              <span className="text-[15px] font-mono font-semibold text-cyan-400">{rep.trustScore.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="size-3 text-amber-400" />
              <span className="text-[15px] font-mono font-semibold text-amber-400">{rep.civicScore.toFixed(0)}</span>
            </div>
          </div>
        )}
        {org && (
          <div className="ml-2 hidden md:flex items-center gap-1">
            <Building2 className="size-3 text-violet-400" />
            <span className="text-[14px] text-muted-foreground">{org.orgName}</span>
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="ml-auto flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground">
          <LogOut className="size-3" /> Exit
        </button>
      </header>

      {/* Content area */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {tab === "home" && <HomeTab identity={identity} />}
        {tab === "report" && <ReportTab userId={(user as any)?.id} userName={name} role={role} region={profile?.region} />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "profile" && <ProfileTab identity={identity} session={session} />}
      </main>

      {/* Bottom navigation — mobile-first */}
      <nav className="flex h-16 shrink-0 items-center justify-around border-t border-border bg-card/40">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex flex-col items-center gap-1 px-4 py-2 transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-5" />
              <span className="text-[13px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ===========================================================================
// HOME TAB — Intelligence Feed
// ===========================================================================

function HomeTab({ identity }: { identity: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const sp = filter ? `?type=${filter}` : "";
    api(`/api/feed${sp}`).then((d) => setItems(d.items)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const name = identity?.profile?.displayName ?? identity?.user?.name ?? "there";
  const region = identity?.profile?.region ?? "Ghana";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      {/* Greeting */}
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-bold">{greeting}, {name.split(" ")[0]}</h1>
        <p className="text-[15px] text-muted-foreground">Your region: {region}</p>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto border-b border-border">
        {["", "ALERT", "REPORT", "ANALYSIS", "MISSION", "ASSET", "ANNOUNCEMENT"].map((t) => (
          <button key={t || "all"} onClick={() => setFilter(t)}
            className={cn("rounded-full px-2.5 py-1 text-[14px] font-medium whitespace-nowrap transition-colors",
              filter === t ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground")}>
            {t || "All"}
          </button>
        ))}
      </div>

      {/* Feed items */}
      <div className="p-3 space-y-2">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {items.map((item) => {
          const meta = FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT;
          const Icon = meta.icon;
          return (
            <div key={item.feedItemId} className="rounded-lg border border-border bg-card/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="size-7 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ color: meta.color, background: `${meta.color}1a` }}>
                  {item.creatorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-medium truncate">{item.creatorName}</span>
                    <span className="rounded px-1 py-0.5 text-[8px] font-semibold" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">{item.creatorRole.replace(/_/g, " ").toLowerCase()} · {timeAgo(item.publishedAt)}</div>
                </div>
                {item.organizationName && (
                  <span className="flex items-center gap-1 text-[13px] text-violet-400"><Building2 className="size-2.5" /> {item.organizationName}</span>
                )}
              </div>
              <h3 className="text-[17px] font-semibold mb-1">{item.title}</h3>
              <p className="text-[15px] text-foreground/70 leading-snug mb-2">{item.summary}</p>
              <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
                {item.region && <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {item.region}</span>}
                <span className="flex items-center gap-1"><Shield className="size-2.5" /> trust {item.trustScore.toFixed(0)}</span>
                <span className="flex items-center gap-1"><TrendingUp className="size-2.5" /> {(item.confidence * 100).toFixed(0)}%</span>
                <span className="flex items-center gap-1"><Eye className="size-2.5" /> {item.viewCount}</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="size-2.5" /> {item.likeCount}</span>
              </div>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Home className="size-8 opacity-30" />
            <span className="text-xs">No intelligence in your feed yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// REPORT TAB — Quick intelligence reporting (<20 seconds)
// ===========================================================================

function ReportTab({ userId, userName, role, region }: { userId: string; userName: string; role: string; region?: string }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const categories = [
    { value: "mining", label: "Illegal Mining", icon: "⛏" },
    { value: "flood", label: "Flood", icon: "🌊" },
    { value: "deforestation", label: "Deforestation", icon: "🌲" },
    { value: "water_pollution", label: "Pollution", icon: "💧" },
    { value: "infrastructure", label: "Infrastructure", icon: "🚧" },
    { value: "agriculture", label: "Agriculture", icon: "🌾" },
  ];

  const handleSubmit = async () => {
    if (!category || !description) return;
    setSubmitting(true);
    try {
      const res = await api("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REPORT",
          creatorId: userId,
          creatorName: userName,
          creatorRole: role,
          title: `${categories.find((c) => c.value === category)?.label} report`,
          summary: description,
          category,
          region: region ?? "Unknown",
          trustScore: 50,
          confidence: 0.42,
        }),
      });
      setResult(res.item);
    } finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 gap-4">
        <div className="size-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="size-8 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold">Report Submitted!</h2>
        <div className="text-center space-y-1 text-[15px] text-muted-foreground">
          <div>Event ID: <span className="font-mono font-semibold text-foreground">{result.feedItemId}</span></div>
          <div>Initial confidence: <span className="font-mono font-semibold text-amber-400">{(result.confidence * 100).toFixed(0)}%</span></div>
          <div>Nearby witnesses will be notified</div>
          <div>Potential reward: <span className="font-mono font-semibold text-emerald-400">50 IC</span></div>
        </div>
        <button onClick={() => { setResult(null); setCategory(""); setDescription(""); }}
          className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary hover:bg-primary/15">
          Report Another
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4">
      <h2 className="text-lg font-bold mb-3">Report Intelligence</h2>

      <div className="space-y-4">
        <div>
          <label className="text-[15px] font-medium text-muted-foreground mb-2 block">What happened?</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-all",
                  category === c.value ? "border-primary/40 bg-primary/10" : "border-border bg-card/30 hover:bg-card/50")}>
                <span className="text-xl">{c.icon}</span>
                <span className="text-[13px] font-medium text-center">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-muted-foreground mb-1.5 block">Where?</label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/30 px-3 py-2">
            <MapPin className="size-4 text-primary" />
            <span className="text-[15px] text-muted-foreground">GPS detected · {region ?? "Current location"}</span>
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-muted-foreground mb-1.5 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Describe what you observed..."
            className="w-full rounded-lg border border-border bg-card/30 px-3 py-2 text-[16px] resize-none" />
        </div>

        <div>
          <label className="text-[15px] font-medium text-muted-foreground mb-1.5 block">Evidence (optional)</label>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 rounded-lg border border-border bg-card/30 px-3 py-2 text-[14px] text-muted-foreground hover:bg-card/50">
              📷 Photo
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-border bg-card/30 px-3 py-2 text-[14px] text-muted-foreground hover:bg-card/50">
              🎥 Video
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-border bg-card/30 px-3 py-2 text-[14px] text-muted-foreground hover:bg-card/50">
              🎤 Audio
            </button>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={!category || !description || submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Submit Report
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// ALERTS TAB — Active alerts + witness requests
// ===========================================================================

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/feed?type=ALERT").then((d) => setAlerts(d.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold">Alerts</h2>
        <p className="text-[15px] text-muted-foreground">Active intelligence alerts + witness requests</p>
      </div>
      <div className="p-3 space-y-2">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {alerts.map((a) => {
          const meta = FEED_TYPE_META[a.type] ?? FEED_TYPE_META.ALERT;
          return (
            <div key={a.feedItemId} className="rounded-lg border p-3" style={{ borderColor: `${meta.color}40`, background: `${meta.color}08` }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-4" style={{ color: meta.color }} />
                <span className="text-[16px] font-semibold flex-1">{a.title}</span>
                <span className="text-[13px] text-muted-foreground">{timeAgo(a.publishedAt)}</span>
              </div>
              <p className="text-[15px] text-foreground/70 mb-2">{a.summary}</p>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[14px] text-emerald-400">
                  <CheckCircle2 className="size-3" /> Verify
                </button>
                <button className="flex items-center gap-1 rounded border border-border bg-card/30 px-2 py-1 text-[14px] text-muted-foreground">
                  <Eye className="size-3" /> View
                </button>
                <span className="ml-auto text-[13px] text-muted-foreground">{a.region}</span>
              </div>
            </div>
          );
        })}
        {!loading && alerts.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bell className="size-8 opacity-30" />
            <span className="text-xs">No active alerts</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// PROFILE TAB — User identity + reputation + impact
// ===========================================================================

function ProfileTab({ identity, session }: { identity: any; session: any }) {
  const user = session?.user;
  const rep = identity?.reputation;
  const profile = identity?.profile;
  const org = identity?.organization;

  if (!identity) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* Identity card */}
      <div className="rounded-lg border border-border bg-card/40 p-4 text-center">
        <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
          <span className="text-2xl font-bold text-primary">{(user?.name ?? "?").charAt(0).toUpperCase()}</span>
        </div>
        <h2 className="text-base font-bold">{profile?.displayName ?? user?.name}</h2>
        <p className="text-[15px] text-muted-foreground">{(user as any)?.role?.replace(/_/g, " ").toLowerCase()}</p>
        {org && <p className="text-[14px] text-violet-400 mt-1">{org.orgName}</p>}
        <div className="flex items-center justify-center gap-1 mt-1">
          <MapPin className="size-3 text-muted-foreground" />
          <span className="text-[14px] text-muted-foreground">{profile?.region ?? "Unknown"}, {profile?.country ?? "Ghana"}</span>
        </div>
      </div>

      {/* Reputation scores */}
      {rep && (
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reputation</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <Shield className="size-5 mx-auto mb-1 text-cyan-400" />
              <div className="text-2xl font-bold font-mono text-cyan-400">{rep.trustScore.toFixed(0)}</div>
              <div className="text-[13px] text-muted-foreground">Trust Score</div>
            </div>
            <div className="text-center">
              <Award className="size-5 mx-auto mb-1 text-amber-400" />
              <div className="text-2xl font-bold font-mono text-amber-400">{rep.civicScore.toFixed(0)}</div>
              <div className="text-[13px] text-muted-foreground">Civic Score</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="rounded bg-foreground/5 px-2 py-0.5 text-[13px] font-medium">{rep.verificationLevel}</span>
            <span className="rounded bg-foreground/5 px-2 py-0.5 text-[13px]">contribution: {rep.contributionScore}</span>
          </div>
        </div>
      )}

      {/* Impact stats */}
      {rep && (
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Impact</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-card/30 px-3 py-2">
              <FileText className="size-4 text-amber-400 mb-1" />
              <div className="text-lg font-bold font-mono">{rep.totalReports}</div>
              <div className="text-[13px] text-muted-foreground">Reports Filed</div>
            </div>
            <div className="rounded bg-card/30 px-3 py-2">
              <CheckCircle2 className="size-4 text-emerald-400 mb-1" />
              <div className="text-lg font-bold font-mono">{rep.totalVerified}</div>
              <div className="text-[13px] text-muted-foreground">Verified</div>
            </div>
            <div className="rounded bg-card/30 px-3 py-2">
              <Package className="size-4 text-cyan-400 mb-1" />
              <div className="text-lg font-bold font-mono">{rep.totalAssets}</div>
              <div className="text-[13px] text-muted-foreground">Assets</div>
            </div>
            <div className="rounded bg-card/30 px-3 py-2">
              <Target className="size-4 text-violet-400 mb-1" />
              <div className="text-lg font-bold font-mono">{rep.totalMissions}</div>
              <div className="text-[13px] text-muted-foreground">Missions</div>
            </div>
          </div>
        </div>
      )}

      {/* Bio */}
      {profile?.bio && (
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h3>
          <p className="text-[15px] text-foreground/80 leading-relaxed">{profile.bio}</p>
          {profile.interests?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.interests.map((i: string) => (
                <span key={i} className="rounded bg-foreground/5 px-1.5 py-0.5 text-[13px]">{i}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
