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
  Target,
  Zap,
  TrendingUp,
  DollarSign,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  ChevronRight,
  Navigation,
} from "lucide-react";

interface MissionDetailProps {
  mission: any | null;
  onOpenChange: (open: boolean) => void;
}

interface Participant {
  id: string;
  userName: string;
  role: string;
  status: string;
  joinedAtLabel: string;
}

export function MissionDetail({ mission, onOpenChange }: MissionDetailProps) {
  const { data: session } = useSession();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  const open = !!mission;

  const load = useCallback(async () => {
    if (!mission?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}/join`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
        const userId = (session?.user as any)?.id;
        setHasJoined((data.participants || []).some((p: any) => p.userId === userId));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [mission?.id, session]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleJoin = async () => {
    if (!mission?.id) return;
    const userId = (session?.user as any)?.id;
    const userName = session?.user?.name;
    if (!userId || !userName) {
      toast.error("You must be logged in");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to join");
      }
      const data = await res.json();
      toast.success("Mission joined!", {
        description: `You are now a contributor on "${mission.title.slice(0, 40)}..."`,
      });
      setHasJoined(true);
      setParticipants((prev) => [
        { id: data.participation.id, userName, role: "contributor", status: "active", joinedAtLabel: "just now" },
        ...prev,
      ]);
    } catch (e: any) {
      toast.error("Failed to join mission", { description: e.message });
    } finally {
      setJoining(false);
    }
  };

  if (!mission) return null;

  const typeLabel = mission.type?.replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase()) ?? "Mission";
  const priorityColor =
    mission.priority === "critical" ? "#f43f5e" :
    mission.priority === "high" ? "#fbbf24" :
    mission.priority === "medium" ? "#22d3ee" : "#34d399";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500">
              <Target className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[12px] font-medium text-cyan-500">
                  {typeLabel}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: priorityColor, background: `${priorityColor}15` }}>
                  {mission.priority} priority
                </span>
                <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[12px]">{mission.status}</span>
              </div>
              <DialogTitle className="text-[18px] font-semibold mt-2 leading-tight">{mission.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-4 space-y-4">
          {/* Description / Reasoning */}
          <div>
            <h3 className="text-[14px] font-medium text-muted-foreground mb-1">Mission Brief</h3>
            <p className="text-[15px] leading-relaxed">{mission.reasoning || mission.description || "No description available."}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-1">
                <Zap className="size-3.5" /> EVI Score
              </div>
              <div className="text-[20px] font-bold font-mono">{mission.evi?.toFixed(2) ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-1">
                <TrendingUp className="size-3.5" /> Info Gain
              </div>
              <div className="text-[20px] font-bold font-mono">{((mission.informationGain ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-1">
                <DollarSign className="size-3.5" /> Cost
              </div>
              <div className="text-[20px] font-bold font-mono">{mission.cost === 0 ? "Free" : `$${mission.cost}`}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-1">
                <MapPin className="size-3.5" /> Location
              </div>
              <div className="text-[14px] font-medium font-mono truncate">
                {mission.targetLat?.toFixed(2) ?? "—"}, {mission.targetLng?.toFixed(2) ?? "—"}
              </div>
            </div>
          </div>

          {/* Target area */}
          <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Navigation className="size-3.5" /> Coverage Radius
              </span>
              <span className="font-mono font-medium">{(mission.targetRadiusM / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" /> Created
              </span>
              <span className="font-medium">{timeAgo(mission.createdAt)}</span>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              <Users className="size-4" /> Participants ({participants.length})
            </h3>
            {loading ? (
              <div className="flex h-12 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-2">No participants yet. Be the first to join!</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto gdt-scroll">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary text-[12px] font-bold">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[14px] font-medium">{p.userName}</span>
                    <span className="text-[12px] text-muted-foreground">{p.role}</span>
                    <span className="ml-auto text-[12px] text-muted-foreground">joined {p.joinedAtLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer — Join button */}
        <div className="border-t border-border px-5 py-4 flex items-center justify-between shrink-0">
          <div className="text-[13px] text-muted-foreground">
            {hasJoined ? (
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="size-4" /> You've joined this mission
              </span>
            ) : (
              <span>Earn rewards when the mission completes</span>
            )}
          </div>
          {hasJoined ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <Button onClick={handleJoin} disabled={joining || mission.status !== "planned"}>
              {joining ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" /> Joining...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-1" /> Join Mission
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
