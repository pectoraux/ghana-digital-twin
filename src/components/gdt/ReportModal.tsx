"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { REGIONS } from "@/lib/gdt/geo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Eye,
  TrendingUp,
  Users,
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Shield,
} from "lucide-react";

const REPORT_TYPES = [
  { value: "ALERT", label: "Alert", icon: AlertTriangle, color: "#f43f5e", desc: "Urgent — active incident requiring attention" },
  { value: "REPORT", label: "Report", icon: Eye, color: "#fbbf24", desc: "Observed event or situation on the ground" },
  { value: "ANALYSIS", label: "Analysis", icon: TrendingUp, color: "#a78bfa", desc: "Assessment or interpretation of intelligence" },
  { value: "DISCUSSION", label: "Discussion", icon: Users, color: "#84cc16", desc: "Question, coordination, or community discussion" },
];

const CATEGORIES = [
  "illegal_mining",
  "flood_risk",
  "deforestation",
  "water_pollution",
  "cocoa_disease",
  "infrastructure",
  "security",
  "agriculture",
  "other",
];

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function ReportModal({ open, onOpenChange, onSubmitted }: ReportModalProps) {
  const { data: session } = useSession();
  const [type, setType] = useState("REPORT");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string; confidence: number } | null>(null);

  const userId = (session?.user as any)?.id ?? "demo-user";
  const userName = session?.user?.name ?? "Demo User";
  const userRole = (session?.user as any)?.role ?? "CITIZEN";

  const estimatedConfidence = (() => {
    const base = type === "ALERT" ? 0.65 : type === "REPORT" ? 0.55 : type === "ANALYSIS" ? 0.45 : 0.35;
    return Math.round(base * 100);
  })();

  const reset = () => {
    setType("REPORT");
    setTitle("");
    setSummary("");
    setRegion("");
    setCategory("other");
    setSuccess(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !summary.trim()) {
      toast.error("Please provide a title and description");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          creatorId: userId,
          creatorName: userName,
          creatorRole: userRole,
          title: title.trim(),
          summary: summary.trim(),
          category,
          region: region || undefined,
          trustScore: 50,
          confidence: estimatedConfidence / 100,
          sourceType: "user_report",
          sourceId: `user-${userId.slice(0, 8)}`,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setSuccess({ id: data.item?.feedItemId ?? "FI-NEW", confidence: estimatedConfidence });
      toast.success("Intelligence report published!", {
        description: `${data.item?.feedItemId ?? "Report"} is now live in the feed.`,
      });
      onSubmitted?.();
    } catch (e) {
      toast.error("Failed to publish report", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open && success) {
      reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px] p-0 gap-0">
        {success ? (
          // Success state
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold">Report Published!</h2>
              <p className="text-[15px] text-muted-foreground mt-1">
                Your intelligence is now live in the feed and visible to the network.
              </p>
            </div>
            <div className="w-full rounded-xl border border-border bg-card p-4 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground">Report ID</span>
                <span className="font-mono text-[14px] font-semibold">{success.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground flex items-center gap-1">
                  <Shield className="size-3.5" /> Estimated Confidence
                </span>
                <span className="font-mono text-[14px] font-semibold text-emerald-500">{success.confidence}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3.5" /> Potential Reward
                </span>
                <span className="font-mono text-[14px] font-semibold text-amber-500">15–45 IC</span>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Earn rewards when your report is verified by community guardians.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          // Form state
          <>
            <DialogHeader className="border-b border-border px-6 py-4">
              <DialogTitle className="text-[20px] flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Report Intelligence
              </DialogTitle>
              <DialogDescription className="text-[14px]">
                Share what you observed. Your report will be published to the intelligence feed.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto gdt-scroll px-6 py-5 space-y-5">
              {/* Type selector */}
              <div className="space-y-2">
                <label className="text-[14px] font-medium">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                          active
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card hover:border-primary/20"
                        )}
                        style={active ? { borderColor: `${t.color}40`, background: `${t.color}08` } : {}}
                      >
                        <div
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ color: t.color, background: `${t.color}15` }}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium">{t.label}</div>
                          <div className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">{t.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Excavators operating near Ankobra River"
                  maxLength={120}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Be specific and factual</span>
                  <span className="text-[12px] text-muted-foreground font-mono">{title.length}/120</span>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium">Description</label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe what you observed, when, and any relevant details..."
                  rows={4}
                  maxLength={500}
                  className="resize-none text-[15px]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Include location, time, and evidence if available</span>
                  <span className="text-[12px] text-muted-foreground font-mono">{summary.length}/500</span>
                </div>
              </div>

              {/* Region + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium flex items-center gap-1">
                    <MapPin className="size-3.5" /> Region
                  </label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Confidence estimate */}
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium flex items-center gap-1.5">
                    <Shield className="size-3.5 text-teal-500" /> Estimated Confidence
                  </span>
                  <span className="font-mono text-[15px] font-bold text-emerald-500">{estimatedConfidence}%</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Based on report type. Confidence increases when guardians verify your report.
                </p>
              </div>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                Publishing as <span className="font-medium text-foreground">{userName}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !summary.trim()}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1" /> Publishing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-1" /> Publish Report
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
