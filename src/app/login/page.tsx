"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, ShieldCheck, Users, Building2, Brain, Code } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
            <Globe className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Ghana Digital Twin</h1>
          <p className="text-xs text-muted-foreground">Intelligence Civilization Platform</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-3 rounded-lg border border-border bg-card/40 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
          </Button>
          <div className="flex items-center justify-between text-[10px]">
            <button type="button" onClick={() => router.push("/signup")} className="text-primary hover:underline">Join Waitlist</button>
            <button type="button" onClick={handleAdminLogin} className="text-muted-foreground hover:text-foreground">Admin Login</button>
          </div>
        </form>

        {/* Demo accounts */}
        <div className="space-y-2">
          <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">Try Demo Accounts</p>
          <div className="grid grid-cols-3 gap-2">
            {demos.map((d) => {
              const Icon = d.icon;
              return (
                <button key={d.email} onClick={() => handleDemo(d.email)} disabled={loading}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card/30 p-3 hover:bg-card/50 transition-colors disabled:opacity-50">
                  <Icon className="size-4" style={{ color: d.color }} />
                  <span className="text-[9px] font-medium">{d.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => handleDemo("admin.demo@example.com")} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/15 disabled:opacity-50">
            <ShieldCheck className="size-4" /> Admin Demo
          </button>
        </div>
      </div>
    </div>
  );
}
