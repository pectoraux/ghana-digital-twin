"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import { Loader2, ShieldCheck, Users, Clock, CheckCircle2, XCircle, UserCheck, ScrollText } from "lucide-react";

type Tab = "waitlist" | "users" | "audit";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("waitlist");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.push("/login"); return; }
    const role = (session.user as any)?.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") { router.push("/"); return; }
    // Seed auth on first visit
    fetch("/api/seed-auth", { method: "POST" }).catch(() => null);
  }, [session, status, router]);

  if (status === "loading" || !session) return <div className="flex h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Admin Dashboard</h1>
          <span className="text-[11px] text-muted-foreground">{(session.user as any)?.email}</span>
          <button onClick={() => router.push("/")} className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Back to Platform</button>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {([["waitlist", "Waitlist", Clock], ["users", "Users", Users], ["audit", "Audit Logs", ScrollText]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent")}>
              <Icon className="size-3.5" />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === "waitlist" && <WaitlistTab adminId={(session.user as any)?.id} adminName={session.user?.name ?? ""} adminRole={(session.user as any)?.role} />}
        {tab === "users" && <UsersTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

function WaitlistTab({ adminId, adminName, adminRole }: { adminId: string; adminName: string; adminRole: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/waitlist").then((r) => r.json()).then((d) => setEntries(d.entries)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setBusy(id);
    try { await fetch(`/api/admin/waitlist/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminId, adminName, adminRole }) }); load(); } finally { setBusy(null); }
  };
  const handleReject = async (id: string) => {
    setBusy(id);
    try { await fetch(`/api/admin/waitlist/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminId, adminName, adminRole }) }); load(); } finally { setBusy(null); }
  };

  const pending = entries.filter((e) => e.status === "pending");
  const approved = entries.filter((e) => e.status === "approved");
  const rejected = entries.filter((e) => e.status === "rejected");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricStat label="Pending" value={pending.length} accent="#fbbf24" />
        <MetricStat label="Approved" value={approved.length} accent="#34d399" />
        <MetricStat label="Rejected" value={rejected.length} accent="#f43f5e" />
      </div>
      <div className="space-y-2">
        {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[12px] font-medium">{e.name}</span>
              <span className="text-[10px] text-muted-foreground">{e.email}</span>
              <span className="rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-medium">{e.requestedRole}</span>
              <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium capitalize", e.status === "pending" ? "bg-amber-500/10 text-amber-300" : e.status === "approved" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{e.status}</span>
              <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
            </div>
            {e.reason && <p className="text-[11px] text-foreground/70 mb-1.5">{e.reason}</p>}
            {e.status === "pending" && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleApprove(e.id)} disabled={busy === e.id} className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                  {busy === e.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Approve & Create Account
                </button>
                <button onClick={() => handleReject(e.id)} disabled={busy === e.id} className="flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
                  <XCircle className="size-3" /> Reject
                </button>
              </div>
            )}
            {e.status === "approved" && e.createdUserId && <div className="text-[10px] text-emerald-400 flex items-center gap-1"><UserCheck className="size-3" /> Account created: {e.createdUserId.slice(0, 8)}</div>}
          </div>
        ))}
        {!loading && entries.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">No waitlist entries yet</div>}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-2">
      {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
      {users.map((u) => (
        <div key={u.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3">
          <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0", u.isDemo ? "bg-violet-500/10 text-violet-400" : "bg-cyan-500/10 text-cyan-400")}>
            <Users className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-[12px] font-medium">{u.name}</span><span className="text-[10px] text-muted-foreground">{u.email}</span></div>
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              <span className="rounded bg-foreground/5 px-1 py-0.5 font-medium">{u.role}</span>
              <span className={cn("rounded px-1 py-0.5", u.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{u.status}</span>
              {u.isDemo && <span className="text-violet-400">DEMO</span>}
              {u.lastLoginAt && <span>last login {timeAgo(u.lastLoginAt)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/audit").then((r) => r.json()).then((d) => setLogs(d.logs)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-1">
      {loading && <div className="flex h-20 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
      {logs.map((l) => (
        <div key={l.id} className="rounded border border-border bg-card/30 px-3 py-1.5 flex items-center gap-2 text-[11px]">
          <span className="font-mono text-[9px] text-muted-foreground">{l.logId}</span>
          <span className="rounded bg-foreground/5 px-1 py-0.5 font-medium">{l.action}</span>
          {l.actorName && <span className="text-muted-foreground">by {l.actorName}</span>}
          {l.targetName && <span className="text-muted-foreground">→ {l.targetName}</span>}
          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(l.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}
