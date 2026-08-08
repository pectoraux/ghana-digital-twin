"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import { WithdrawModal } from "@/components/gdt/WithdrawModal";
import { Button } from "@/components/ui/button";
import {
  Loader2, Award, DollarSign, TrendingUp, Zap, CheckCircle2,
  Target, Eye, Shield, ArrowUpRight, ArrowDownLeft, Coins,
  Wallet, History, Clock, Banknote,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror the shapes returned by /api/wallet)
// ---------------------------------------------------------------------------

interface WalletAccount {
  accountId: string;
  ownerId: string;
  ownerName: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  totalDeposited: number;
  active: boolean;
}

interface WalletTransaction {
  transactionId: string;
  direction: "credit" | "debit";
  amount: number;
  type: string; // deposit | purchase | reward | royalty | refund | platform_fee
  description: string;
  counterParty: string | null;
  referenceType: string | null;
  referenceId: string | null;
  processedAt: string;
}

interface WithdrawalRequest {
  requestId: string;
  amount: number;
  mobileMoneyNumber: string;
  provider: string;
  status: string; // pending | processing | completed | rejected
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

const TX_TYPE_META: Record<string, { color: string; label: string }> = {
  deposit: { color: "#22d3ee", label: "Deposit" },
  purchase: { color: "#a78bfa", label: "Purchase" },
  reward: { color: "#34d399", label: "Reward" },
  royalty: { color: "#fbbf24", label: "Royalty" },
  refund: { color: "#fb923c", label: "Refund" },
  platform_fee: { color: "#f43f5e", label: "Withdrawal" },
};

const WITHDRAWAL_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#fbbf24", bg: "#fbbf2420", label: "Pending" },
  processing: { color: "#22d3ee", bg: "#22d3ee20", label: "Processing" },
  completed: { color: "#34d399", bg: "#34d39920", label: "Completed" },
  rejected: { color: "#f43f5e", bg: "#f43f5e20", label: "Rejected" },
};

const PROVIDER_LABEL: Record<string, string> = {
  mtn: "MTN Ghana",
  vodafone: "Vodafone",
  airteltigo: "AirtelTigo",
};

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function RewardsView() {
  const { data: session } = useSession();
  const [identity, setIdentity] = useState<any>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const userId = (session?.user as any)?.id;

  const reloadWallet = useCallback(() => {
    if (!userId) return;
    api(`/api/wallet?userId=${userId}`)
      .then((data) => {
        setAccount(data.account);
        setTransactions(data.transactions ?? []);
        setPendingWithdrawals(data.pendingWithdrawals ?? []);
      })
      .catch(() => {
        // Wallet endpoints unreachable — keep previous state
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api(`/api/identity?userId=${userId}`).catch(() => ({ identity: null })),
      api(`/api/wallet?userId=${userId}`).catch(() => ({ account: null, transactions: [], pendingWithdrawals: [] })),
    ]).then(([idRes, walletRes]) => {
      setIdentity(idRes.identity);
      setAccount(walletRes.account ?? null);
      setTransactions(walletRes.transactions ?? []);
      setPendingWithdrawals(walletRes.pendingWithdrawals ?? []);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto gdt-scroll">
        <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Balance cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="size-5 mb-2 rounded-full bg-foreground/15 animate-pulse" />
                <div className="h-9 w-24 mb-1 rounded bg-foreground/15 animate-pulse" />
                <div className="h-3 w-20 rounded bg-foreground/10 animate-pulse" />
              </div>
            ))}
          </div>
          {/* Reputation progress skeleton */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
            <div className="h-5 w-40 rounded bg-foreground/15 animate-pulse" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 rounded bg-foreground/15 animate-pulse" />
                  <div className="h-4 w-16 rounded bg-foreground/10 animate-pulse" />
                </div>
                <div className="h-3 w-full rounded-full bg-foreground/10 animate-pulse" />
              </div>
            ))}
          </div>
          {/* Transactions skeleton */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
            <div className="h-5 w-32 rounded bg-foreground/15 animate-pulse" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border border-border/60 rounded-lg p-3">
                <div className="size-8 rounded-full bg-foreground/15 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 rounded bg-foreground/10 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-foreground/10 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-foreground/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rep = identity?.reputation;
  const name = identity?.profile?.displayName ?? session?.user?.name ?? "User";
  const balance = account?.balance ?? 0;
  const totalEarned = account?.totalEarned ?? 0;
  const totalDeposited = account?.totalDeposited ?? 0;
  const totalSpent = account?.totalSpent ?? 0;

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold flex items-center gap-2">
              <Award className="size-6 text-amber-500 shrink-0" /> Rewards & Earnings
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1 truncate">
              {name}&apos;s intelligence contribution rewards
            </p>
          </div>
          <Button
            onClick={() => setWithdrawOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"
            disabled={balance < 100}
          >
            <Banknote className="size-4" /> Withdraw
          </Button>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="size-5 text-amber-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Current Balance</span>
            </div>
            <div className="text-[32px] md:text-[36px] font-bold font-mono text-amber-500 leading-tight">
              {balance.toLocaleString()}
            </div>
            <div className="text-[14px] text-muted-foreground">Intelligence Credits</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="size-5 text-emerald-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Total Earned</span>
            </div>
            <div className="text-[32px] md:text-[36px] font-bold font-mono text-emerald-500 leading-tight">
              {totalEarned.toLocaleString()}
            </div>
            <div className="text-[14px] text-muted-foreground">IC from contributions</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="size-5 text-cyan-500" />
              <span className="text-[14px] font-medium text-muted-foreground">Total Deposited</span>
            </div>
            <div className="text-[32px] md:text-[36px] font-bold font-mono text-cyan-500 leading-tight">
              {totalDeposited.toLocaleString()}
            </div>
            <div className="text-[14px] text-muted-foreground">IC added to account</div>
          </div>
        </div>

        {/* Reputation progress */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Reputation Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2">
                    <Shield className="size-4 text-teal-500" /> Trust Score
                  </span>
                  <span className="text-[15px] font-mono font-bold text-teal-500">
                    {rep.trustScore.toFixed(0)} / 100
                  </span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${rep.trustScore}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2">
                    <Award className="size-4 text-amber-500" /> Civic Score
                  </span>
                  <span className="text-[15px] font-mono font-bold text-amber-500">
                    {rep.civicScore.toFixed(0)} / 100
                  </span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${rep.civicScore}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-medium flex items-center gap-2">
                    <Zap className="size-4 text-emerald-500" /> Contribution Score
                  </span>
                  <span className="text-[15px] font-mono font-bold text-emerald-500">
                    {rep.contributionScore}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, rep.contributionScore / 30)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Impact summary */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Contribution Impact</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

        {/* Pending Withdrawals */}
        {pendingWithdrawals.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4 flex items-center gap-2">
              <Clock className="size-5 text-amber-500" /> Pending Withdrawals
            </h2>
            <div className="space-y-2">
              {pendingWithdrawals.map((wr) => {
                const status = WITHDRAWAL_STATUS_META[wr.status] ?? WITHDRAWAL_STATUS_META.pending;
                const providerLabel = PROVIDER_LABEL[wr.provider] ?? wr.provider;
                return (
                  <div
                    key={wr.requestId}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div
                      className="flex size-9 items-center justify-center rounded-lg shrink-0"
                      style={{ background: status.bg, color: status.color }}
                    >
                      <Banknote className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium truncate">
                        Withdrawal to {providerLabel}
                      </div>
                      <div className="text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{wr.requestId}</span>
                        <span aria-hidden>·</span>
                        <span className="font-mono">{wr.mobileMoneyNumber}</span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(wr.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[16px] font-bold font-mono text-amber-500">
                        -{wr.amount.toLocaleString()} IC
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
          <h2 className="text-[20px] font-semibold mb-4 flex items-center gap-2">
            <History className="size-5 text-teal-500" /> Recent Transactions
          </h2>
          {transactions.length === 0 ? (
            <EmptyTransactions />
          ) : (
            <div className="max-h-96 overflow-y-auto gdt-scroll space-y-2 pr-1">
              {transactions.map((tx) => {
                const isCredit = tx.direction === "credit";
                const color = isCredit ? "#34d399" : "#f43f5e";
                const typeMeta = TX_TYPE_META[tx.type] ?? { color: "#a1a1aa", label: tx.type };
                return (
                  <div
                    key={tx.transactionId}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div
                      className="flex size-9 items-center justify-center rounded-lg shrink-0"
                      style={{ color, background: `${color}15` }}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium truncate">{tx.description}</div>
                      <div className="text-[13px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: `${typeMeta.color}20`, color: typeMeta.color }}
                        >
                          {typeMeta.label}
                        </span>
                        <span className="truncate">
                          {isCredit ? "from " : "to "}
                          <span className="text-foreground/80">{tx.counterParty ?? "platform"}</span>
                        </span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(tx.processedAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-bold font-mono" style={{ color }}>
                        {isCredit ? "+" : "−"}
                        {tx.amount.toLocaleString()}
                      </div>
                      <div className="text-[13px] text-muted-foreground font-mono">
                        {tx.transactionId.slice(-8)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wallet summary card — shows lifetime spent for completeness */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
          <h2 className="text-[20px] font-semibold mb-4 flex items-center gap-2">
            <Wallet className="size-5 text-amber-500" /> Wallet Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <WalletStat
              label="Current Balance"
              value={balance.toLocaleString()}
              unit="IC"
              accent="text-amber-500"
            />
            <WalletStat
              label="Lifetime Earned"
              value={totalEarned.toLocaleString()}
              unit="IC"
              accent="text-emerald-500"
            />
            <WalletStat
              label="Lifetime Deposited"
              value={totalDeposited.toLocaleString()}
              unit="IC"
              accent="text-cyan-500"
            />
            <WalletStat
              label="Lifetime Withdrawn"
              value={totalSpent.toLocaleString()}
              unit="IC"
              accent="text-rose-500"
            />
          </div>
          {account && (
            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Account ID</span>
              <span className="text-[13px] font-mono text-foreground/80">{account.accountId}</span>
            </div>
          )}
        </div>

        {/* How rewards work */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5">
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
              <span>Withdraw your IC to mobile money (MTN / Vodafone / AirtelTigo) — 100 IC = GH₵0.10</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 mt-1 shrink-0" />
              <span>Higher trust score → higher reward multipliers and witness weight</span>
            </div>
          </div>
        </div>
      </div>

      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={(o) => {
          setWithdrawOpen(o);
          if (!o) {
            // Refresh wallet data after the modal closes (covers success case).
            reloadWallet();
          }
        }}
        currentBalance={balance}
        userId={userId}
        onSubmitted={reloadWallet}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small subcomponents
// ---------------------------------------------------------------------------

function WalletStat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[13px] text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-[20px] font-bold font-mono leading-tight", accent)}>{value}</div>
      <div className="text-[12px] text-muted-foreground">{unit}</div>
    </div>
  );
}

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/30">
        <History className="size-6 text-muted-foreground" />
      </div>
      <div className="text-[15px] font-medium">No transactions yet</div>
      <div className="text-[13px] text-muted-foreground max-w-[280px]">
        Once you earn or withdraw Intelligence Credits, your transaction history will appear here.
      </div>
    </div>
  );
}
