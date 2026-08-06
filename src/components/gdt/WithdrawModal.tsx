"use client";

// WithdrawModal — dialog for cashing out Intelligence Credits to Ghana mobile money.
//
// Layout (single dialog, two states: form → success):
//   ┌───────────────────────────────────────────┐
//   │ Wallet icon + "Withdraw IC"               │
//   │ ───────────────────────────────           │
//   │ Available balance (large, amber, mono)    │
//   │                                           │
//   │ Amount         [_____ IC]    (min 100)    │
//   │ Mobile Money   [+233 __________]          │
//   │ Provider       [MTN] [Vodafone] [AirtelT] │
//   │                                           │
//   │ You'll receive ≈ GH₵ X.XX                │
//   │ ───────────────────────────────           │
//   │              [Cancel]  [Withdraw]         │
//   └───────────────────────────────────────────┘
//
// On success the dialog switches to a success card with the request ID,
// amount, provider, and a "24-48 hours" processing estimate.

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Wallet,
  ArrowDownLeft,
  CheckCircle2,
  Smartphone,
  AlertTriangle,
} from "lucide-react";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  userId?: string;
  onSubmitted?: () => void;
}

// IC → GHS conversion (demo rate: 1000 IC ≈ GH₵1).
const IC_TO_GHS = 1 / 1000;

interface ProviderOption {
  value: "mtn" | "vodafone" | "airteltigo";
  label: string;
  color: string; // hex for swatch
  short: string;
}

const PROVIDERS: ProviderOption[] = [
  { value: "mtn", label: "MTN Ghana", color: "#facc15", short: "MTN" },
  { value: "vodafone", label: "Vodafone", color: "#ef4444", short: "VOD" },
  { value: "airteltigo", label: "AirtelTigo", color: "#1e293b", short: "AT" },
];

// 10-digit Ghana mobile number starting with 0 — strip whitespace + dashes first.
const PHONE_REGEX = /^0\d{9}$/;

interface SubmitResult {
  requestId: string;
  amount: number;
  provider: string;
  mobileMoneyNumber: string;
}

export function WithdrawModal({
  open,
  onOpenChange,
  currentBalance,
  userId,
  onSubmitted,
}: WithdrawModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [provider, setProvider] = useState<ProviderOption["value"]>("mtn");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmitResult | null>(null);

  // Reset form state when modal re-opens.
  useEffect(() => {
    if (open) {
      setAmountStr("");
      setMobileMoneyNumber("");
      setProvider("mtn");
      setSuccess(null);
      setSubmitting(false);
    }
  }, [open]);

  const amount = Number(amountStr);
  const amountValid = Number.isFinite(amount) && amount >= 100 && amount <= currentBalance;
  const phoneValid = PHONE_REGEX.test(mobileMoneyNumber.replace(/[\s-]/g, ""));
  const formValid = amountValid && phoneValid && !submitting;

  const ghsEquivalent = amountValid ? amount * IC_TO_GHS : 0;

  const handleSubmit = async () => {
    if (!formValid) return;
    if (!userId) {
      toast.error("You must be logged in to withdraw");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/wallet?userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "withdraw",
          amount,
          mobileMoneyNumber: mobileMoneyNumber.replace(/[\s-]/g, ""),
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Withdrawal failed");
      }
      const providerLabel =
        provider === "mtn" ? "MTN Ghana" : provider === "vodafone" ? "Vodafone" : "AirtelTigo";
      setSuccess({
        requestId: data.withdrawal.requestId,
        amount: data.withdrawal.amount,
        provider: providerLabel,
        mobileMoneyNumber: data.withdrawal.mobileMoneyNumber,
      });
      toast.success("Withdrawal requested!", {
        description: `${data.withdrawal.amount.toLocaleString()} IC → ${providerLabel}`,
      });
      onSubmitted?.();
    } catch (e) {
      toast.error("Withdrawal failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-4 shrink-0">
          <DialogTitle className="text-[20px] flex items-center gap-2">
            <Wallet className="size-5 text-amber-500" />
            {success ? "Withdrawal Requested!" : "Withdraw IC"}
          </DialogTitle>
          <DialogDescription className="text-[14px]">
            {success
              ? "Your withdrawal is pending review."
              : "Cash out your Intelligence Credits to Ghana mobile money."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <SuccessState
            success={success}
            ghsEquivalent={success.amount * IC_TO_GHS}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-5 space-y-5">
            {/* Available balance */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="size-4 text-amber-500" />
                <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
                  Available Balance
                </span>
              </div>
              <div className="text-[32px] font-bold font-mono text-amber-500 leading-tight">
                {currentBalance.toLocaleString()}{" "}
                <span className="text-[16px] text-muted-foreground font-normal">IC</span>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium flex items-center gap-1.5">
                <ArrowDownLeft className="size-3.5" /> Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0"
                  min={100}
                  max={currentBalance}
                  step={50}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 pr-12 text-[16px] font-mono outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted-foreground">
                  IC
                </span>
              </div>
              {amountStr !== "" && !amountValid && (
                <p className="text-[12px] text-rose-500 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Minimum 100 IC, maximum {currentBalance.toLocaleString()} IC
                </p>
              )}
              {/* Quick-select buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[100, 500, 1000, currentBalance].map((amt, idx) => {
                  if (idx === 3 && currentBalance <= 1000) return null;
                  if (amt > currentBalance) return null;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountStr(String(amt))}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-[13px] font-medium font-mono hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {idx === 3 ? "Max" : amt.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile money number */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium flex items-center gap-1.5">
                <Smartphone className="size-3.5" /> Mobile Money Number
              </label>
              <div className="flex items-stretch gap-0 rounded-lg border border-border bg-card overflow-hidden focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
                <span className="flex items-center gap-1.5 px-3 border-r border-border bg-background/50 shrink-0">
                  <GhanaFlag />
                  <span className="text-[14px] font-medium text-muted-foreground">+233</span>
                </span>
                <input
                  type="tel"
                  value={mobileMoneyNumber}
                  onChange={(e) => setMobileMoneyNumber(e.target.value)}
                  placeholder="024 123 4567"
                  maxLength={10}
                  className="flex-1 min-w-0 px-3 py-2 text-[15px] font-mono outline-none bg-transparent"
                />
              </div>
              {mobileMoneyNumber !== "" && !phoneValid && (
                <p className="text-[12px] text-rose-500 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Enter a 10-digit Ghana number starting with 0
                </p>
              )}
            </div>

            {/* Provider selector */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium">Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((p) => {
                  const selected = provider === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setProvider(p.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <span
                        className="flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-black"
                        style={{ background: p.color }}
                      >
                        {p.short}
                      </span>
                      <span
                        className={cn(
                          "text-[13px] font-medium",
                          selected ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GHS conversion estimate */}
            {amountValid && (
              <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">You&apos;ll receive</span>
                <span className="text-[15px] font-bold font-mono text-emerald-500">
                  ≈ GH₵ {ghsEquivalent.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter className="border-t border-border px-5 py-4 flex items-center justify-between shrink-0 gap-3">
            <span className="text-[12px] text-muted-foreground leading-tight">
              Processed within 24-48 hours. IC deducted immediately.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={!formValid}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1" /> Processing...
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="size-4 mr-1" /> Withdraw
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Success state — shown after a successful withdrawal submission.
// ---------------------------------------------------------------------------

function SuccessState({
  success,
  ghsEquivalent,
  onClose,
}: {
  success: SubmitResult;
  ghsEquivalent: number;
  onClose: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll px-5 py-6 space-y-4">
      {/* Big check */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-9 text-emerald-500" />
        </div>
        <h3 className="text-[18px] font-semibold mt-1">Withdrawal Requested!</h3>
        <p className="text-[13px] text-muted-foreground">
          Your request has been submitted and is now pending review.
        </p>
      </div>

      {/* Receipt */}
      <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2.5">
        <Row label="Request ID" value={success.requestId} mono />
        <Row
          label="Amount"
          value={
            <span className="text-amber-500">
              {success.amount.toLocaleString()} IC
              <span className="text-muted-foreground font-normal"> (≈ GH₵ {ghsEquivalent.toFixed(2)})</span>
            </span>
          }
          mono
        />
        <Row label="Provider" value={success.provider} />
        <Row label="Mobile Money" value={success.mobileMoneyNumber} mono />
        <Row label="Status" value={<span className="text-amber-500">Pending</span>} />
      </div>

      {/* Processing note */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
        <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[13px] text-foreground/80">
          Funds typically arrive within <span className="font-semibold">24-48 hours</span>. You will
          receive an SMS confirmation on <span className="font-mono">{success.mobileMoneyNumber}</span>{" "}
          when the payout is complete.
        </p>
      </div>

      <Button onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("text-[14px] font-medium text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny inline Ghana flag SVG (no external asset dependency).
// ---------------------------------------------------------------------------

function GhanaFlag() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className="shrink-0" aria-label="Ghana">
      <rect width="18" height="4" fill="#ce1126" />
      <rect y="4" width="18" height="4" fill="#fcd116" />
      <rect y="8" width="18" height="4" fill="#006b3f" />
      <polygon points="9,4.6 9.7,6.4 11.6,6.4 10.1,7.5 10.6,9.3 9,8.3 7.4,9.3 7.9,7.5 6.4,6.4 8.3,6.4" fill="#000" />
    </svg>
  );
}
