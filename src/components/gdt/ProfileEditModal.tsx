"use client";

import { useState, useEffect } from "react";
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
  User,
  MapPin,
  FileText,
  Sparkles,
  X,
  Plus,
  Check,
} from "lucide-react";

interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProfile: {
    displayName: string;
    bio: string | null;
    region: string | null;
    interests: string[];
    skills: string[];
  } | null;
  onSaved?: () => void;
}

const SUGGESTED_INTERESTS = [
  "Illegal Mining",
  "Flood Monitoring",
  "Deforestation",
  "Water Quality",
  "Cocoa Farming",
  "Wildlife",
  "Infrastructure",
  "Climate",
  "Community Safety",
];

const SUGGESTED_SKILLS = [
  "Drone Piloting",
  "GPS Mapping",
  "Photography",
  "Data Analysis",
  "Field Research",
  "Report Writing",
  "Social Media",
  "First Aid",
  "Community Organizing",
];

export function ProfileEditModal({ open, onOpenChange, initialProfile, onSaved }: ProfileEditModalProps) {
  const { data: session } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [region, setRegion] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialProfile) {
      setDisplayName(initialProfile.displayName ?? "");
      setBio(initialProfile.bio ?? "");
      setRegion(initialProfile.region ?? "");
      setInterests(initialProfile.interests ?? []);
      setSkills(initialProfile.skills ?? []);
      setNewInterest("");
      setNewSkill("");
    }
  }, [open, initialProfile]);

  const userId = (session?.user as any)?.id;

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  };

  const addCustomInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed]);
      setNewInterest("");
    }
  };

  const addCustomSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setNewSkill("");
    }
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("You must be logged in");
      return;
    }
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/identity?userId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          region: region || undefined,
          interests,
          skills,
        }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const data = await res.json();
      toast.success("Profile updated!", {
        description: "Your changes have been saved.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to update profile", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
          <DialogTitle className="text-[20px] flex items-center gap-2">
            <User className="size-5 text-primary" />
            Edit Profile
          </DialogTitle>
          <DialogDescription className="text-[14px]">
            Update your display name, bio, region, interests, and skills.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-5 space-y-5">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium flex items-center gap-1.5">
              <FileText className="size-3.5" /> Bio
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself..."
              rows={3}
              maxLength={300}
              className="resize-none text-[15px]"
            />
            <div className="flex justify-end">
              <span className="text-[12px] text-muted-foreground font-mono">{bio.length}/300</span>
            </div>
          </div>

          {/* Region */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium flex items-center gap-1.5">
              <MapPin className="size-3.5" /> Region
            </label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select your region" />
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

          {/* Interests */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium">Interests</label>
            <p className="text-[12px] text-muted-foreground">What intelligence topics do you care about?</p>
            {/* Selected interests */}
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {interests.map((interest) => (
                  <span
                    key={interest}
                    className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[13px] font-medium text-primary"
                  >
                    {interest}
                    <button
                      onClick={() => toggleInterest(interest)}
                      className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Suggested interests */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_INTERESTS.filter((i) => !interests.includes(i)).map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  <Plus className="size-3" />
                  {interest}
                </button>
              ))}
            </div>
            {/* Custom interest input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest(); } }}
                placeholder="Add custom interest..."
                maxLength={30}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-[14px] outline-none focus:border-primary/40"
              />
              <Button onClick={addCustomInterest} size="sm" variant="outline" disabled={!newInterest.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium">Skills</label>
            <p className="text-[12px] text-muted-foreground">What can you contribute to the network?</p>
            {/* Selected skills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[13px] font-medium text-emerald-500"
                  >
                    {skill}
                    <button
                      onClick={() => toggleSkill(skill)}
                      className="ml-0.5 rounded-full hover:bg-emerald-500/20 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Suggested skills */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground hover:border-emerald-500/30 transition-colors"
                >
                  <Plus className="size-3" />
                  {skill}
                </button>
              ))}
            </div>
            {/* Custom skill input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                placeholder="Add custom skill..."
                maxLength={30}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-[14px] outline-none focus:border-primary/40"
              />
              <Button onClick={addCustomSkill} size="sm" variant="outline" disabled={!newSkill.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4 flex items-center justify-between shrink-0">
          <span className="text-[13px] text-muted-foreground">
            Changes are visible to the community immediately.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" /> Saving...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-1" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
