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
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  AlertTriangle,
  Droplets,
  TreePine,
  Waves,
  Leaf,
  Mountain,
  FileQuestion,
  Navigation,
} from "lucide-react";

const INCIDENT_TYPES = [
  { value: "illegal_mining", label: "Illegal Mining", icon: Mountain, color: "#f43f5e", desc: "Excavators, galamsey, unlicensed mining" },
  { value: "flood_risk", label: "Flood Risk", icon: Waves, color: "#38bdf8", desc: "Rising water, dam overflow, flood warning" },
  { value: "deforestation", label: "Deforestation", icon: TreePine, color: "#84cc16", desc: "Tree cutting, canopy loss, forest degradation" },
  { value: "water_pollution", label: "Water Pollution", icon: Droplets, color: "#22d3ee", desc: "Discolored water, chemical spill, contamination" },
  { value: "cocoa_disease", label: "Cocoa Disease", icon: Leaf, color: "#fbbf24", desc: "CSSVD, swollen shoot, black pod disease" },
  { value: "land_degradation", label: "Land Degradation", icon: AlertTriangle, color: "#fb923c", desc: "Erosion, soil damage, quarry activity" },
  { value: "other", label: "Other", icon: FileQuestion, color: "#a1a1aa", desc: "Other environmental or community concern" },
];

const SEVERITIES = [
  { value: "low", label: "Low", color: "#34d399", desc: "Minor concern, no immediate threat" },
  { value: "moderate", label: "Moderate", color: "#fbbf24", desc: "Significant, needs attention" },
  { value: "high", label: "High", color: "#fb923c", desc: "Serious, action recommended" },
  { value: "critical", label: "Critical", color: "#f43f5e", desc: "Urgent, immediate threat" },
];

interface CommunityReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function CommunityReportModal({ open, onOpenChange, onSubmitted }: CommunityReportModalProps) {
  const { data: session } = useSession();
  const [type, setType] = useState("illegal_mining");
  const [severity, setSeverity] = useState("moderate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [regionId, setRegionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ eventId: string; confidence: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [location, setLocation] = useState<{ lng: number; lat: number } | null>(null);

  const citizenId = (session?.user as any)?.citizenId;

  const detectLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude });
          setDetectingLocation(false);
          toast.success("Location detected!", {
            description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          });
        },
        () => {
          // Fallback: simulate a location in Ghana
          setLocation({ lng: -2.07, lat: 5.1 }); // Western Region
          setDetectingLocation(false);
          toast.info("Using approximate location (Western Region)");
        },
        { timeout: 5000 }
      );
    } else {
      setLocation({ lng: -2.07, lat: 5.1 });
      setDetectingLocation(false);
      toast.info("Using approximate location (Western Region)");
    }
  };

  const estimatedConfidence = (() => {
    const base = severity === "critical" ? 0.7 : severity === "high" ? 0.6 : severity === "moderate" ? 0.5 : 0.4;
    const locBonus = location ? 0.1 : 0;
    return Math.round((base + locBonus) * 100);
  })();

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please provide a title and description");
      return;
    }
    if (!citizenId) {
      toast.error("No citizen profile linked to your account");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/community/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId,
          type,
          severity,
          title: title.trim(),
          description: description.trim(),
          regionId: regionId || undefined,
          location: location ?? undefined,
          selfConfidence: estimatedConfidence / 100,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setSuccess({ eventId: data.event?.eventId ?? "CE-NEW", confidence: estimatedConfidence });
      toast.success("Incident reported!", {
        description: `${data.event?.eventId ?? "Event"} is now in the witness queue.`,
      });
      onSubmitted?.();
    } catch (e) {
      toast.error("Failed to submit report", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setType("illegal_mining");
    setSeverity("moderate");
    setTitle("");
    setDescription("");
    setRegionId("");
    setLocation(null);
    setSuccess(null);
  };

  const handleClose = (open: boolean) => {
    if (!open && success) reset();
    onOpenChange(open);
  };

  const selectedType = INCIDENT_TYPES.find((t) => t.value === type) ?? INCIDENT_TYPES[0];
  const selectedSeverity = SEVERITIES.find((s) => s.value === severity) ?? SEVERITIES[1];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[540px] p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        {success ? (
          // Success state
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold">Incident Reported!</h2>
              <p className="text-[15px] text-muted-foreground mt-1">
                Your report is now in the witness verification queue. Nearby citizens will be asked to confirm or reject it.
              </p>
            </div>
            <div className="w-full rounded-xl border border-border bg-card p-4 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground">Event ID</span>
                <span className="font-mono text-[14px] font-semibold">{success.eventId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3.5" /> Initial Confidence
                </span>
                <span className="font-mono text-[14px] font-semibold text-emerald-500">{success.confidence}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> Severity
                </span>
                <span className="font-mono text-[14px] font-semibold" style={{ color: selectedSeverity.color }}>
                  {selectedSeverity.label}
                </span>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Earn rewards when witnesses verify your report. Check the Community tab for updates.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          // Form state
          <>
            <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
              <DialogTitle className="text-[20px] flex items-center gap-2">
                <AlertTriangle className="size-5 text-rose-500" />
                Report Incident
              </DialogTitle>
              <DialogDescription className="text-[14px]">
                Report an environmental or community incident for witness verification.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-5 space-y-5">
              {/* Incident type selector */}
              <div className="space-y-2">
                <label className="text-[14px] font-medium">Incident Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {INCIDENT_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                          active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/20"
                        )}
                        style={active ? { borderColor: `${t.color}40`, background: `${t.color}08` } : {}}
                      >
                        <div
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ color: t.color, background: `${t.color}15` }}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium">{t.label}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{t.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity selector */}
              <div className="space-y-2">
                <label className="text-[14px] font-medium">Severity</label>
                <div className="grid grid-cols-4 gap-2">
                  {SEVERITIES.map((s) => {
                    const active = severity === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setSeverity(s.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all",
                          active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/20"
                        )}
                        style={active ? { borderColor: `${s.color}40`, background: `${s.color}08` } : {}}
                      >
                        <div
                          className="flex size-5 items-center justify-center rounded-full"
                          style={{ background: s.color }}
                        />
                        <span className="text-[12px] font-medium">{s.label}</span>
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
                <div className="flex justify-end">
                  <span className="text-[12px] text-muted-foreground font-mono">{title.length}/120</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you observed, when, and any relevant details..."
                  rows={4}
                  maxLength={500}
                  className="resize-none text-[15px]"
                />
                <div className="flex justify-end">
                  <span className="text-[12px] text-muted-foreground font-mono">{description.length}/500</span>
                </div>
              </div>

              {/* Region + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium flex items-center gap-1">
                    <MapPin className="size-3.5" /> Region
                  </label>
                  <Select value={regionId} onValueChange={setRegionId}>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium flex items-center gap-1">
                    <Navigation className="size-3.5" /> GPS Location
                  </label>
                  <Button
                    variant="outline"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="w-full"
                  >
                    {detectingLocation ? (
                      <><Loader2 className="size-4 animate-spin mr-1" /> Detecting...</>
                    ) : location ? (
                      <><CheckCircle2 className="size-4 mr-1 text-emerald-500" /> {location.lat.toFixed(2)}, {location.lng.toFixed(2)}</>
                    ) : (
                      <><Navigation className="size-4 mr-1" /> Detect Location</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Confidence estimate */}
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-teal-500" /> Estimated Confidence
                  </span>
                  <span className="font-mono text-[15px] font-bold text-emerald-500">{estimatedConfidence}%</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Based on severity + location accuracy. Confidence increases when witnesses confirm your report.
                </p>
              </div>
            </div>

            <DialogFooter className="border-t border-border px-5 py-4 flex items-center justify-between shrink-0">
              <span className="text-[13px] text-muted-foreground">
                Reporting as <span className="font-medium text-foreground">{session?.user?.name}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim()}>
                  {submitting ? (
                    <><Loader2 className="size-4 animate-spin mr-1" /> Submitting...</>
                  ) : (
                    <><AlertTriangle className="size-4 mr-1" /> Submit Report</>
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
