"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  Eye,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Users,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
  verified: { color: "#34d399", label: "Verified" },
  broadcast: { color: "#22d3ee", label: "Broadcast" },
  fusing: { color: "#a78bfa", label: "Fusing" },
  rewarded: { color: "#fbbf24", label: "Rewarded" },
};

interface CommunityEventDetailProps {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface Witness {
  id: string;
  witnessId: string;
  witnessName?: string;
  response: string;
  note?: string;
  createdAt: string;
}

export function CommunityEventDetail({ eventId, onOpenChange }: CommunityEventDetailProps) {
  const { data: session } = useSession();
  const [event, setEvent] = useState<any>(null);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const open = !!eventId;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/community/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEvent(data.event);
      setWitnesses(data.witnesses || []);
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleWitness = async (response: string) => {
    if (!event) return;
    setBusy(response);
    try {
      const userId = (session?.user as any)?.id;
      const citizensRes = await fetch("/api/community/citizens?limit=1").then((r) => r.json()).catch(() => ({ citizens: [] }));
      const witnessId = citizensRes.citizens?.[0]?.citizenId ?? "cit-demo";
      const witnessName = session?.user?.name ?? "Demo User";

      const res = await fetch(`/api/community/events/${event.eventId}/witness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witnessId, response, note: `Witness response: ${response}`, witnessName }),
      });
      if (!res.ok) throw new Error("Failed to submit witness response");

      toast.success(`Response submitted: ${response}`, {
        description: response === "confirm" ? "You confirmed this event." : response === "reject" ? "You rejected this event." : "You marked this as unverifiable.",
      });

      // Refresh event + witnesses
      load();
    } catch (e: any) {
      toast.error("Failed to submit response", { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  const meta = event ? (EVENT_TYPE_META[event.type] ?? EVENT_TYPE_META.other) : EVENT_TYPE_META.other;
  const smeta = event ? (STATUS_META[event.status] ?? STATUS_META.created) : STATUS_META.created;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && event && (
          <>
            {/* Header */}
            <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[20px]" style={{ color: meta.color, background: `${meta.color}15` }}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] text-muted-foreground">{event.eventId}</span>
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: meta.color, background: `${meta.color}15` }}>{meta.label}</span>
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: smeta.color, background: `${smeta.color}15` }}>{smeta.label}</span>
                    <span className="ml-auto text-[12px] text-muted-foreground">{timeAgo(event.reportedAt)}</span>
                  </div>
                  <DialogTitle className="text-[18px] font-semibold mt-2 leading-tight">{event.title}</DialogTitle>
                </div>
              </div>
            </DialogHeader>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-4 space-y-4">
              {/* Description */}
              <p className="text-[15px] leading-relaxed">{event.description}</p>

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap text-[13px]">
                {event.regionId && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> {event.regionId}
                  </span>
                )}
                <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                  <Shield className="size-3.5" /> {(event.fusedConfidence * 100).toFixed(0)}% confidence
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3.5" /> {event.witnessCount} witnesses
                </span>
                {event.confirmCount > 0 && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <ThumbsUp className="size-3.5" /> {event.confirmCount} confirmed
                  </span>
                )}
                {event.rejectCount > 0 && (
                  <span className="flex items-center gap-1 text-rose-500">
                    <ThumbsDown className="size-3.5" /> {event.rejectCount} rejected
                  </span>
                )}
              </div>

              {/* Witness actions — only show if status is witnessing */}
              {event.status === "witnessing" && (
                <div className="border-y border-border py-3 space-y-2">
                  <h3 className="text-[14px] font-medium flex items-center gap-1.5">
                    <Users className="size-4" /> Your Verification
                  </h3>
                  <p className="text-[13px] text-muted-foreground">Can you confirm or reject this report based on your local knowledge?</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleWitness("confirm")}
                      disabled={!!busy}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[14px] font-medium text-emerald-500 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
                    >
                      {busy === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} Confirm
                    </button>
                    <button
                      onClick={() => handleWitness("reject")}
                      disabled={!!busy}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[14px] font-medium text-rose-500 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
                    >
                      {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4" />} Reject
                    </button>
                    <button
                      onClick={() => handleWitness("unknown")}
                      disabled={!!busy}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-1.5 text-[14px] text-muted-foreground hover:bg-card/50 transition-colors disabled:opacity-50"
                    >
                      {busy === "unknown" ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />} Can't verify
                    </button>
                  </div>
                </div>
              )}

              {/* Witness responses */}
              <div className="space-y-2">
                <h3 className="text-[15px] font-semibold flex items-center gap-2">
                  <Activity className="size-4" /> Witness Responses ({witnesses.length})
                </h3>
                {witnesses.length === 0 ? (
                  <p className="text-[14px] text-muted-foreground py-2">No witness responses yet. Be the first to verify!</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto gdt-scroll">
                    {witnesses.map((w) => {
                      const respMeta = w.response === "confirm"
                        ? { color: "#34d399", icon: CheckCircle2, label: "Confirmed" }
                        : w.response === "reject"
                        ? { color: "#fb7185", icon: XCircle, label: "Rejected" }
                        : { color: "#a1a1aa", icon: HelpCircle, label: "Can't verify" };
                      const Icon = respMeta.icon;
                      return (
                        <div key={w.id} className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/50 p-3">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ color: respMeta.color, background: `${respMeta.color}15` }}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium">{w.witnessName || "Anonymous"}</span>
                              <span className="text-[12px] font-medium" style={{ color: respMeta.color }}>{respMeta.label}</span>
                              <span className="ml-auto text-[12px] text-muted-foreground">{timeAgo(w.createdAt)}</span>
                            </div>
                            {w.note && <p className="text-[13px] text-muted-foreground mt-0.5">{w.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3 shrink-0">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5" /> Reported {timeAgo(event.reportedAt)}
                </span>
                <span className="font-mono text-muted-foreground">{event.eventId}</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
