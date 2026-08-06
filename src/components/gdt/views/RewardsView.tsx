"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import {
  Loader2, Award, DollarSign, TrendingUp, Zap, CheckCircle2,
  Target, Eye, Shield, ArrowUpRight, ArrowDownLeft, Coins,
} from "lucide-react";

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function RewardsView() {
  const { data: session } = useSession();
  const [identity, setIdentity] = useState<any>(null);
  const [creditAccount, setCreditAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    Promise.all([
      api(`/api/identity?userId=${userId}`).catch(() => ({ identity: null })),
      api("/api/finance/credits").catch(() => ({ accounts: [], transactions: [] })),
    ]).then(([idRes, creditRes]) => {
      setIdentity(idRes.identity);
      // Find the user's credit account or use the first one
      const accounts = creditRes.accounts || [];
      const userAccount = accounts.find((a: any) => a.ownerId === userId) ?? accounts[0] ?? null;
      setCreditAccount(userAccount);
      setTransactions(creditRes.transactions || []);
    }).finally(() => setLoading(false));
  }, [session]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const rep = identity?.reputation;
  const name = identity?.profile?.displayName ?? session?.user?.name ?? "User";
  const balance = creditAccount?.balance ?? 0;
  const totalEarned = creditAccount?.totalEarned ?? 0;
  const totalDeposited = creditAccount?.totalDeposited ?? 0;

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[24px] font-bold flex items-center gap-2">
            <Award className="size-6 text-amber-500" /> Rewards & Earnings
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">{name}'s intelligence contribution rewards</p>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="size-5 text-amber-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Current Balance</span>
            </div>
            <div className="text-[36px] font-bold font-mono text-amber-500">{balance.toLocaleString()}</div>
            <div className="text-[14px] text-muted-foreground">Intelligence Credits</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="size-5 text-emerald-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Total Earned</span>
            </div>
            <div className="text-[36px] font-bold font-mono text-emerald-500">{totalEarned.toLocaleString()}</div>
            <div className="text-[14px] text-muted-foreground">IC from contributions</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="size-5 text-cyan-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Total Deposited</span>
            </div>
            <div className="text-[36px] font-bold font-mono text-cyan-500">{totalDeposited.toLocaleString()}</div>
            <div className="text-[14px] text-muted-foreground">IC added to account</div>
          </div>
        </div>

        {/* Reputation progress */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Reputation Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2"><Shield className="size-4 text-teal-500" /> Trust Score</span>
                  <span className="text-[15px] font-mono font-bold text-teal-500">{rep.trustScore.toFixed(0)} / 100</span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${rep.trustScore}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2"><Award className="size-4 text-amber-500" /> Civic Score</span>
                  <span className="text-[15px] font-mono font-bold text-amber-500">{rep.civicScore.toFixed(0)} / 100</span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${rep.civicScore}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2"><Zap className="size-4 text-emerald-500" /> Contribution Score</span>
                  <span className="text-[15px] font-mono font-bold text-emerald-500">{rep.contributionScore}</span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, rep.contributionScore / 30)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Impact summary */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Contribution Impact</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-center">
                <Eye className="size-5 mx-auto mb-2 text-amber-500" />
                <div className="text-[24px] font-bold font-mono">{rep.totalReports}</div>
                <div className="text-[14px] text-muted-foreground">Reports</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-center">
                <CheckCircle2 className="size-5 mx-auto mb-2 text-emerald-500" />
                <div className="text-[24px] font-bold font-mono">{rep.totalVerified}</div>
                <div className="text-[14px] text-muted-foreground">Verified</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-center">
                <Target className="size-5 mx-auto mb-2 text-violet-500" />
                <div className="text-[24px] font-bold font-mono">{rep.totalMissions}</div>
                <div className="text-[14px] text-muted-foreground">Missions</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-center">
                <TrendingUp className="size-5 mx-auto mb-2 text-cyan-500" />
                <div className="text-[24px] font-bold font-mono">{rep.totalAssets}</div>
                <div className="text-[14px] text-muted-foreground">Assets</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Recent Transactions</h2>
            <div className="space-y-2">
              {transactions.slice(0, 10).map((tx) => {
                const isIncome = tx.amount > 0;
                const color = isIncome ? "#34d399" : "#f43f5e";
                return (
                  <div key={tx.transactionId} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="flex size-8 items-center justify-center rounded-lg shrink-0" style={{ color, background: `${color}15` }}>
                      {isIncome ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium truncate">{tx.description}</div>
                      <div className="text-[13px] text-muted-foreground">
                        {tx.type} · {tx.fromOwnerName || "platform"} → {tx.toOwnerName || "platform"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-bold font-mono" style={{ color }}>
                        {isIncome ? "+" : ""}{tx.amount.toLocaleString()}
                      </div>
                      <div className="text-[13px] text-muted-foreground">{timeAgo(tx.processedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How rewards work */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="size-5 text-primary" /> How Rewards Work
          </h2>
          <div className="space-y-2 text-[15px] text-foreground/80">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Report intelligence events → earn 25-50 IC per verified report</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Verify other reports as a witness → earn 10-20 IC per confirmation</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Join missions → earn mission-specific rewards (100-500 IC)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Publish intelligence assets → earn usage royalties (ongoing)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Higher trust score → higher reward multipliers and witness weight</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
