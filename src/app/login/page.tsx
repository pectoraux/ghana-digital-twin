"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, ShieldCheck, Users, Building2, Brain, Code, Lock, ChevronDown, ChevronUp, Satellite, Activity } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemos, setShowDemos] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) { setError("Invalid credentials"); setLoading(false); }
    else { router.push("/"); }
  };

  const handleDemo = async (demoEmail: string) => {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email: demoEmail, password: "demo1234", redirect: false });
    if (res?.error) { setError("Demo login failed"); setLoading(false); }
    else { router.push("/"); }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email: "ekontetevi@gmail.com", password: "Payswap123456", redirect: false });
    if (res?.error) { setError("Admin login failed"); setLoading(false); }
    else { router.push("/"); }
  };

  const demos = [
    { email: "kwesi.demo@example.com", label: "Citizen", icon: Users, color: "#34d399" },
    { email: "guardian.demo@example.com", label: "Guardian", icon: ShieldCheck, color: "#fbbf24" },
    { email: "producer.demo@example.com", label: "Producer", icon: Brain, color: "#a78bfa" },
    { email: "epa.demo@example.com", label: "EPA Org", icon: Building2, color: "#22d3ee" },
    { email: "nadmo.demo@example.com", label: "NADMO Gov", icon: Building2, color: "#38bdf8" },
    { email: "developer.demo@example.com", label: "Developer", icon: Code, color: "#84cc16" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 20% 50%, var(--primary) 1px, transparent 1px), radial-gradient(circle at 80% 80%, var(--primary) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="w-full max-w-md space-y-5 relative z-10">
        {/* Branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 shadow-lg">
            <Globe className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Ghana Digital Twin</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Intelligence Civilization Platform</p>
          {/* Feature badges */}
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Satellite className="size-3.5 text-teal-500" /> Satellite
            </span>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Activity className="size-3.5 text-rose-500" /> Real-time
            </span>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-500" /> Verified
            </span>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-3 rounded-xl border border-border bg-card/40 p-5 shadow-card">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-medium flex items-center gap-1.5">
              <Lock className="size-3 text-muted-foreground" /> Password
            </Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-[13px] text-rose-400 flex items-center gap-1"><ShieldCheck className="size-3" /> {error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
          </Button>
          <div className="flex items-center justify-between text-[12px]">
            <button type="button" onClick={() => router.push("/signup")} className="text-primary hover:underline">Join Waitlist</button>
            <button type="button" onClick={handleAdminLogin} className="text-muted-foreground hover:text-foreground">Admin Login</button>
          </div>
          {/* Security indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/60">
            <Lock className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Secured by NextAuth · Sessions encrypted</span>
          </div>
        </form>

        {/* Demo accounts — collapsible */}
        <div className="space-y-2">
          <button
            onClick={() => setShowDemos(!showDemos)}
            className="w-full flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDemos ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            Try Demo Accounts
          </button>
          {showDemos && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="grid grid-cols-3 gap-2">
                {demos.map((d) => {
                  const Icon = d.icon;
                  return (
                    <button key={d.email} onClick={() => handleDemo(d.email)} disabled={loading}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card/30 p-3 hover:bg-card/50 transition-colors disabled:opacity-50">
                      <Icon className="size-5" style={{ color: d.color }} />
                      <span className="text-[11px] font-medium">{d.label}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => handleDemo("admin.demo@example.com")} disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[13px] text-primary hover:bg-primary/15 disabled:opacity-50">
                <ShieldCheck className="size-4" /> Admin Demo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
