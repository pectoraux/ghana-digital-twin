"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Loader2, MapPin, Shield, TrendingUp, Eye, CheckCircle2,
  AlertTriangle, Target, Users, Zap, Package, ChevronRight,
  Building2, Search, ThumbsUp,
} from "lucide-react";

const FEED_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ALERT: { color: "#f43f5e", icon: AlertTriangle, label: "Alert" },
  REPORT: { color: "#fbbf24", icon: Eye, label: "Report" },
  ANALYSIS: { color: "#a78bfa", icon: TrendingUp, label: "Analysis" },
  MISSION: { color: "#22d3ee", icon: Target, label: "Mission" },
  DISCUSSION: { color: "#84cc16", icon: Users, label: "Discussion" },
  ASSET: { color: "#38bdf8", icon: Package, label: "Asset" },
  ANNOUNCEMENT: { color: "#34d399", icon: CheckCircle2, label: "Announcement" },
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "ALERT", label: "Alerts" },
  { value: "REPORT", label: "Reports" },
  { value: "ANALYSIS", label: "Analysis" },
  { value: "MISSION", label: "Missions" },
  { value: "ASSET", label: "Assets" },
  { value: "ANNOUNCEMENT", label: "Announcements" },
];

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function FeedView() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams();
    if (filter) sp.set("type", filter);
    sp.set("limit", "50");
    api(`/api/feed?${sp}`).then((d) => setItems(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleLike = async (feedItemId: string) => {
    if (liked.has(feedItemId)) return;
    setBusy(feedItemId);
    try {
      const userId = (session?.user as any)?.id ?? "demo-user";
      const userName = session?.user?.name ?? "Demo User";
      await fetch("/api/feed/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedItemId, userId, userName, type: "like" }),
      });
      setLiked((prev) => new Set(prev).add(feedItemId));
      setItems((prev) => prev.map((i) => i.feedItemId === feedItemId ? { ...i, likeCount: i.likeCount + 1 } : i));
    } finally { setBusy(null); }
  };

  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()) || i.summary.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-[24px] font-bold">Intelligence Feed</h1>
        <p className="text-[15px] text-muted-foreground mt-1">Latest verified intelligence from across the network</p>
      </div>

      {/* Search + Filters */}
      <div className="border-b border-border px-6 py-3 space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search intelligence..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[14px] font-medium whitespace-nowrap transition-colors",
                filter === f.value ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed items */}
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-3">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}

        {filtered.map((item) => {
          const meta = FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT;
          const Icon = meta.icon;
          return (
            <div key={item.feedItemId} className="rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                {/* Creator avatar */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-[15px]" style={{ color: meta.color, background: `${meta.color}15` }}>
                  {item.creatorName.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium">{item.creatorName}</span>
                    <span className="text-[13px] text-muted-foreground">{item.creatorRole.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="rounded-full px-2 py-0.5 text-[13px] font-medium" style={{ color: meta.color, background: `${meta.color}15` }}>
                      {meta.label}
                    </span>
                    {item.organizationName && (
                      <span className="flex items-center gap-1 text-[13px] text-violet-500">
                        <Building2 className="size-3" /> {item.organizationName}
                      </span>
                    )}
                    <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(item.publishedAt)}</span>
                  </div>

                  {/* Title + summary */}
                  <h3 className="text-[17px] font-semibold mt-2">{item.title}</h3>
                  <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed">{item.summary}</p>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 mt-3 text-[14px]">
                    {item.region && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-4" /> {item.region}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Shield className="size-4" /> Trust {item.trustScore.toFixed(0)}
                    </span>
                    <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                      <TrendingUp className="size-4" /> {(item.confidence * 100).toFixed(0)}% confidence
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="size-4" /> {item.viewCount}
                    </span>
                    <button onClick={() => handleLike(item.feedItemId)} disabled={busy === item.feedItemId || liked.has(item.feedItemId)}
                      className={cn("flex items-center gap-1 transition-colors", liked.has(item.feedItemId) ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500")}>
                      {busy === item.feedItemId ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} {item.likeCount}
                    </button>
                  </div>
                </div>

                <ChevronRight className="size-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Eye className="size-8 opacity-30" />
            <span className="text-[15px]">No intelligence found</span>
          </div>
        )}
      </div>
    </div>
  );
}
