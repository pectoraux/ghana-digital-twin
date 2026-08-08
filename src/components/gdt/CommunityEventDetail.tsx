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
  Camera,
  ShieldCheck,
  AlertTriangle,
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

interface EventPhoto {
  photoId: string;
  thumbnailUrl: string;
  capturedAt?: string;
  gpsLat?: number;
  gpsLng?: number;
  accuracyM?: number;
  locationVerified: boolean;
  fileSizeKb: number;
  width: number;
  height: number;
  uploadedAt: string;
}

export function CommunityEventDetail({ eventId, onOpenChange }: CommunityEventDetailProps) {
  const { data: session } = useSession();
  const [event, setEvent] = useState<any>(null);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [activePhoto, setActivePhoto] = useState<EventPhoto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const open = !!eventId;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [eventRes, photosRes] = await Promise.all([
        fetch(`/api/community/events/${eventId}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/community/events/${eventId}/photos`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!eventRes) {
        setEvent(null);
        return;
      }
      setEvent(eventRes.event);
      setWitnesses(eventRes.witnesses || []);
      setPhotos(photosRes?.photos ?? []);
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
    <>
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
                      {event.hasPhoto && (
                        <span className="rounded-full px-2 py-0.5 text-[12px] font-medium text-teal-500 bg-teal-500/15 flex items-center gap-1">
                          <Camera className="size-3" /> Photo
                        </span>
                      )}
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

                {/* Photo Evidence */}
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold flex items-center gap-2">
                    <Camera className="size-4 text-teal-500" /> Photo Evidence
                    {photos.length > 0 && (
                      <span className="text-[12px] text-muted-foreground font-normal">({photos.length})</span>
                    )}
                  </h3>
                  {photos.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 text-center">
                      <Camera className="size-5 text-muted-foreground/50 mx-auto" />
                      <p className="text-[13px] text-muted-foreground mt-1">No photo evidence attached</p>
                      <p className="text-[12px] text-muted-foreground/80">Citizen reports can include geotagged photo proof.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p) => (
                        <button
                          key={p.photoId}
                          onClick={() => setActivePhoto(p)}
                          className={cn(
                            "relative group aspect-square rounded-lg overflow-hidden border border-border bg-card",
                            "hover:border-teal-500/40 transition-all"
                          )}
                          aria-label={`View photo ${p.photoId}`}
                        >
                          { }
                          <img
                            src={p.thumbnailUrl}
                            alt={`Photo evidence ${p.photoId}`}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-1 right-1 flex items-center gap-0.5">
                            {p.locationVerified ? (
                              <span
                                className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
                                title="Location verified — photo GPS matches event"
                              >
                                <ShieldCheck className="size-3" />
                              </span>
                            ) : (
                              <span
                                className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm"
                                title="Location not verified — photo GPS missing or far from event"
                              >
                                <AlertTriangle className="size-3" />
                              </span>
                            )}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                            <div className="text-[11px] font-mono text-white/90 truncate">{p.photoId}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {photos.length > 0 && (
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="size-3 text-emerald-500" /> Verified — GPS matches event (≤500m)
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="size-3 text-amber-500" /> Unverified — GPS missing or far
                      </span>
                    </div>
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

      {/* Photo lightbox */}
      <Dialog open={!!activePhoto} onOpenChange={(o) => { if (!o) setActivePhoto(null); }}>
        <DialogContent className="max-w-[640px] p-0 gap-0 overflow-hidden">
          {activePhoto && (
            <>
              <DialogHeader className="border-b border-border px-5 py-3 shrink-0">
                <DialogTitle className="text-[16px] flex items-center gap-2">
                  <Camera className="size-4 text-teal-500" /> Photo Evidence
                  <span className="font-mono text-[13px] text-muted-foreground">{activePhoto.photoId}</span>
                  {activePhoto.locationVerified ? (
                    <span className="inline-flex items-center gap-1 ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[12px] font-medium text-emerald-500">
                      <ShieldCheck className="size-3" /> Location verified ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[12px] font-medium text-amber-500">
                      <AlertTriangle className="size-3" /> Location not verified
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="bg-black/90 flex items-center justify-center p-3">
                { }
                <img
                  src={activePhoto.thumbnailUrl}
                  alt={`Full photo evidence ${activePhoto.photoId}`}
                  className="max-h-[60vh] w-auto object-contain rounded-lg"
                />
              </div>

              <div className="px-5 py-4 grid grid-cols-2 gap-3 text-[13px] border-t border-border">
                <div>
                  <div className="text-muted-foreground text-[12px]">Captured</div>
                  <div className="font-medium">{activePhoto.capturedAt ? timeAgo(activePhoto.capturedAt) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px]">Uploaded</div>
                  <div className="font-medium">{timeAgo(activePhoto.uploadedAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px]">Dimensions</div>
                  <div className="font-medium">{activePhoto.width}×{activePhoto.height}px</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px]">File size</div>
                  <div className="font-medium">{activePhoto.fileSizeKb} KB</div>
                </div>
                {activePhoto.gpsLat != null && activePhoto.gpsLng != null && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-[12px] flex items-center gap-1">
                      <MapPin className="size-3" /> GPS Coordinates
                      {typeof activePhoto.accuracyM === "number" && (
                        <span className="text-muted-foreground/70">±{activePhoto.accuracyM.toFixed(0)}m</span>
                      )}
                    </div>
                    <div className="font-mono text-[13px]">
                      {activePhoto.gpsLat.toFixed(5)}, {activePhoto.gpsLng.toFixed(5)}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 pt-1">
                <Button variant="outline" className="w-full" onClick={() => setActivePhoto(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
