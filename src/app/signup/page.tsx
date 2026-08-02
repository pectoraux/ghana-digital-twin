"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Globe, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "CITIZEN", label: "Citizen Intelligence Contributor" },
  { value: "COMMUNITY_GUARDIAN", label: "Community Guardian" },
  { value: "INTELLIGENCE_PRODUCER", label: "Intelligence Producer" },
  { value: "ORGANIZATION_MEMBER", label: "Organization User" },
  { value: "DEVELOPER", label: "Developer" },
  { value: "RESEARCHER", label: "Researcher" },
];

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "Ghana", region: "", requestedRole: "CITIZEN", reason: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) setSuccess(true);
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 className="size-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">You're on the waitlist!</h1>
          <p className="text-sm text-muted-foreground">Thank you for your interest in the Ghana Digital Twin Intelligence Civilization. Our team will review your application and create your account.</p>
          <Button onClick={() => router.push("/login")} variant="outline">Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
            <Globe className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Join the Intelligence Civilization</h1>
          <p className="text-xs text-muted-foreground">Apply for access to the Ghana Digital Twin platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card/40 p-5">
          <div className="space-y-1.5"><Label className="text-xs">Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label className="text-xs">Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Western, Ashanti, Volta" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Interested Role</Label>
            <select value={form.requestedRole} onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Reason for joining (optional)</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} /></div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="size-4 animate-spin" /> : "Submit Application"}</Button>
          <button type="button" onClick={() => router.push("/login")} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground">Back to Login</button>
        </form>
      </div>
    </div>
  );
}
