"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MapPin,
  Shield,
  TrendingUp,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Flag,
  Send,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Target,
  Package,
} from "lucide-react";

const FEED_TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ALERT: { color: "#f43f5e", icon: AlertTriangle, label: "Alert" },
  REPORT: { color: "#fbbf24", icon: Eye, label: "Report" },
  ANALYSIS: { color: "#a78bfa", icon: TrendingUp, label: "Analysis" },
  MISSION: { color: "#22d3ee", icon: Target, label: "Mission" },
  DISCUSSION: { color: "#84cc16", icon: MessageCircle, label: "Discussion" },
  ASSET: { color: "#38bdf8", icon: Package, label: "Asset" },
  ANNOUNCEMENT: { color: "#34d399", icon: CheckCircle2, label: "Announcement" },
};

interface FeedItemDetailProps {
  feedItemId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface Comment {
  id: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface FeedItem {
  feedItemId: string;
  type: string;
  creatorName: string;
  creatorRole: string;
  organizationName?: string;
  title: string;
  summary: string;
  body?: string;
  category: string;
  region?: string;
  trustScore: number;
  confidence: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
}

export function FeedItemDetail({ feedItemId, onOpenChange }: FeedItemDetailProps) {
  const { data: session } = useSession();
  const setView = useGDT((s) => s.setView);
  const [item, setItem] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const open = !!feedItemId;

  const load = useCallback(async () => {
    if (!feedItemId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed/${feedItemId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setItem(data.item);
      setComments(data.comments || []);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [feedItemId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleLike = async () => {
    if (!item || liked) return;
    setBusy(true);
    try {
      const userId = (session?.user as any)?.id ?? "demo-user";
      const userName = session?.user?.name ?? "Demo User";
      await fetch("/api/feed/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedItemId: item.feedItemId, userId, userName, type: "like" }),
      });
      setLiked(true);
      setItem((prev) => prev ? { ...prev, likeCount: prev.likeCount + 1 } : prev);
      toast.success("Liked!");
    } catch {
      toast.error("Failed to like");
    } finally {
      setBusy(false);
    }
  };

  const handleComment = async () => {
    if (!item || !commentText.trim()) return;
    setCommenting(true);
    try {
      const userId = (session?.user as any)?.id ?? "demo-user";
      const userName = session?.user?.name ?? "Demo User";
      const res = await fetch("/api/feed/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedItemId: item.feedItemId, userId, userName, type: "comment", content: commentText.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setComments((prev) => [{
        id: data.engagement?.id ?? Date.now().toString(),
        userName: userName,
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
      }, ...prev]);
      setCommentText("");
      setItem((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      toast.success("Comment posted!");
    } catch {
      toast.error("Failed to comment");
    } finally {
      setCommenting(false);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?feed=${item.feedItemId}`);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleVerify = () => {
    onOpenChange(false);
    setView("community");
    toast.info("Navigate to Community to verify this report");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && item && (
          <>
            {/* Header */}
            <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
              <div className="flex items-start gap-3">
                {(() => {
                  const meta = FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT;
                  const Icon = meta.icon;
                  return (
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-[15px]"
                      style={{ color: meta.color, background: `${meta.color}15` }}
                    >
                      <Icon className="size-5" />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium">{item.creatorName}</span>
                    <span className="text-[13px] text-muted-foreground">{item.creatorRole.replace(/_/g, " ").toLowerCase()}</span>
                    {(() => {
                      const meta = FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT;
                      return (
                        <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: meta.color, background: `${meta.color}15` }}>
                          {meta.label}
                        </span>
                      );
                    })()}
                    {item.organizationName && (
                      <span className="flex items-center gap-1 text-[12px] text-violet-500">
                        <Building2 className="size-3" /> {item.organizationName}
                      </span>
                    )}
                    <span className="ml-auto text-[12px] text-muted-foreground">{timeAgo(item.publishedAt)}</span>
                  </div>
                  <DialogTitle className="text-[18px] font-semibold mt-2 leading-tight">{item.title}</DialogTitle>
                </div>
              </div>
            </DialogHeader>

            {/* Body — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-4 space-y-4">
              {/* Summary */}
              <p className="text-[15px] leading-relaxed">{item.summary}</p>

              {/* Full body if present */}
              {item.body && (
                <div className="rounded-lg border border-border bg-card/50 p-3">
                  <p className="text-[14px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.body}</p>
                </div>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap text-[13px]">
                {item.region && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> {item.region}
                  </span>
                )}
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Shield className="size-3.5 text-teal-500" /> Trust {item.trustScore.toFixed(0)}
                </span>
                <span className="flex items-center gap-1 font-medium" style={{ color: (FEED_TYPE_META[item.type] ?? FEED_TYPE_META.REPORT).color }}>
                  <TrendingUp className="size-3.5" /> {(item.confidence * 100).toFixed(0)}% confidence
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3.5" /> {item.viewCount} views
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ThumbsUp className="size-3.5" /> {item.likeCount}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MessageCircle className="size-3.5" /> {item.commentCount}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 border-y border-border py-3">
                <button
                  onClick={handleLike}
                  disabled={busy || liked}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[14px] font-medium transition-colors",
                    liked
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />}
                  {liked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => document.getElementById("comment-input")?.focus()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  <MessageCircle className="size-4" /> Comment
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  <Share2 className="size-4" /> Share
                </button>
                <button
                  onClick={handleVerify}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[14px] font-medium text-emerald-500 hover:bg-emerald-500/15 transition-colors"
                >
                  <CheckCircle2 className="size-4" /> Verify
                </button>
              </div>

              {/* Comments section */}
              <div className="space-y-3">
                <h3 className="text-[15px] font-semibold flex items-center gap-2">
                  <MessageCircle className="size-4" /> Comments ({comments.length})
                </h3>

                {/* Comment input */}
                <div className="flex items-start gap-2">
                  <textarea
                    id="comment-input"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    rows={2}
                    maxLength={300}
                    className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleComment();
                      }
                    }}
                  />
                  <Button
                    onClick={handleComment}
                    disabled={commenting || !commentText.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    {commenting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>

                {/* Comment list */}
                {comments.length === 0 ? (
                  <p className="text-[14px] text-muted-foreground py-2">No comments yet. Start the conversation!</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary text-[12px] font-bold">
                            {c.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[14px] font-medium">{c.userName}</span>
                          <span className="text-[12px] text-muted-foreground ml-auto">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-[14px] text-muted-foreground leading-relaxed">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer — report ID + flag */}
            <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
              <span className="font-mono text-[12px] text-muted-foreground">{item.feedItemId}</span>
              <button
                onClick={() => toast.info("Report flagged for review")}
                className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-rose-500 transition-colors"
              >
                <Flag className="size-3.5" /> Flag
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
