// Ghana Digital Twin — Wallet Service
// Citizen-facing wallet operations on top of the CreditAccount / CreditTransaction
// models. Handles:
//   1. getOrCreateUserWallet  — find-or-create a citizen CreditAccount with the
//      initial 10,000 IC demo grant (recorded as a `deposit` so it shows up in
//      the transaction history).
//   2. getUserTransactions     — list every CreditTransaction that touches the
//      user's account, decorated with direction (credit/debit) + counter-party.
//   3. requestWithdrawal       — burn IC from the user's balance, create a
//      WithdrawalRequest row, and emit a CreditTransaction (type=platform_fee)
//      so the ledger reflects the payout.
//
// All functions operate on the existing credit-ledger primitives — no new
// balance columns, no double-entry bookkeeping changes.

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Initial IC balance granted to every new citizen wallet (demo economy). */
export const INITIAL_WALLET_GRANT = 10_000;

/** Provider whitelist (Ghana mobile money networks). */
export const MOBILE_MONEY_PROVIDERS = ["mtn", "vodafone", "airteltigo"] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

/** Minimum withdrawal amount in IC. */
export const MIN_WITHDRAWAL_AMOUNT = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletAccount {
  id: string;
  accountId: string;
  ownerId: string;
  ownerType: string;
  ownerName: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  totalDeposited: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  transactionId: string;
  direction: "credit" | "debit";
  amount: number; // always positive; sign is in `direction`
  type: string; // deposit | purchase | reward | royalty | refund | platform_fee
  description: string;
  counterParty: string | null; // the other side of the ledger (from/to name)
  referenceType: string | null;
  referenceId: string | null;
  processedAt: string;
  createdAt: string;
}

export interface WithdrawalRequestRow {
  id: string;
  requestId: string;
  userId: string;
  accountId: string;
  amount: number;
  mobileMoneyNumber: string;
  provider: string;
  status: string; // pending | processing | completed | rejected
  notes: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 1. getOrCreateUserWallet
// ---------------------------------------------------------------------------

export async function getOrCreateUserWallet(userId: string): Promise<WalletAccount> {
  // Look for an existing citizen-owned CreditAccount (ownerType=citizen).
  const existing = await db.creditAccount.findFirst({
    where: { ownerId: userId, ownerType: "citizen" },
  });

  if (existing) return serializeAccount(existing);

  // Need a display name for the account — fall back to the user record.
  const user = await db.user.findUnique({ where: { id: userId } }).catch(() => null);
  const ownerName = user?.name ?? user?.email ?? `Citizen ${userId.slice(0, 6)}`;

  const accountId = `CRD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

  // Create the account with the initial 10,000 IC grant already credited, and
  // emit a single `deposit` transaction so the ledger shows where the IC came
  // from. We do this in two steps so the transaction row references the new
  // accountId.
  const account = await db.creditAccount.create({
    data: {
      accountId,
      ownerId: userId,
      ownerType: "citizen",
      ownerName,
      balance: INITIAL_WALLET_GRANT,
      totalDeposited: INITIAL_WALLET_GRANT,
      active: true,
    },
  });

  await db.creditTransaction.create({
    data: {
      transactionId: `CTX-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      toAccountId: accountId,
      toOwnerName: ownerName,
      amount: INITIAL_WALLET_GRANT,
      type: "deposit",
      referenceType: "initial_grant",
      referenceId: userId,
      description: "Initial demo grant — welcome to the Ghana Digital Twin intelligence economy",
    },
  });

  return serializeAccount(account);
}

// ---------------------------------------------------------------------------
// 2. getUserTransactions
// ---------------------------------------------------------------------------

export async function getUserTransactions(
  userId: string,
  limit = 50,
): Promise<WalletTransaction[]> {
  const account = await db.creditAccount.findFirst({
    where: { ownerId: userId, ownerType: "citizen" },
  });
  if (!account) return [];

  const rows = await db.creditTransaction.findMany({
    where: {
      OR: [{ fromAccountId: account.accountId }, { toAccountId: account.accountId }],
    },
    orderBy: { processedAt: "desc" },
    take: limit,
  });

  return rows.map((t) => serializeTransaction(t, account.accountId));
}

// ---------------------------------------------------------------------------
// 3. requestWithdrawal
// ---------------------------------------------------------------------------

export interface WithdrawalResult {
  withdrawal: WithdrawalRequestRow;
  transaction: WalletTransaction;
  newBalance: number;
}

export async function requestWithdrawal(
  userId: string,
  amount: number,
  mobileMoneyNumber: string,
  provider: MobileMoneyProvider = "mtn",
): Promise<WithdrawalResult> {
  // Validate amount.
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_AMOUNT} IC`);
  }
  // Validate phone number (Ghana format: 10 digits, leading 0 — e.g. 024XXXXXXX).
  const cleanPhone = mobileMoneyNumber.replace(/[\s-]/g, "");
  if (!/^0\d{9}$/.test(cleanPhone)) {
    throw new Error("Invalid mobile money number — expected 10 digits starting with 0");
  }
  if (!MOBILE_MONEY_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider "${provider}"`);
  }

  // Ensure the wallet exists (and is seeded if new).
  const account = await getOrCreateUserWallet(userId);
  if (account.balance < amount) {
    throw new Error(`Insufficient balance — ${account.balance} IC available, ${amount} requested`);
  }

  // Build a human-readable request ID: WR-YYYY-NNNN
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  const requestId = `WR-${year}-${seq}`;

  // Create the WithdrawalRequest row first (status=pending). The actual balance
  // deduction happens atomically below.
  const withdrawal = await db.withdrawalRequest.create({
    data: {
      requestId,
      userId,
      accountId: account.accountId,
      amount,
      mobileMoneyNumber: cleanPhone,
      provider,
      status: "pending",
    },
  });

  // Emit a `platform_fee` CreditTransaction that burns the IC out of the user's
  // account (toAccountId=null). description includes the mobile money number
  // and request ID so the ledger is self-explanatory.
  const txId = `CTX-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

  const providerLabel =
    provider === "mtn" ? "MTN Ghana" : provider === "vodafone" ? "Vodafone" : "AirtelTigo";

  const tx = await db.creditTransaction.create({
    data: {
      transactionId: txId,
      fromAccountId: account.accountId,
      toAccountId: null, // burn / platform
      fromOwnerName: account.ownerName,
      toOwnerName: null,
      amount,
      type: "platform_fee",
      referenceType: "withdrawal",
      referenceId: requestId,
      description: `Withdrawal to ${providerLabel} ${cleanPhone} (req ${requestId})`,
    },
  });

  // Deduct from the user's balance + bump totalSpent.
  const updated = await db.creditAccount.update({
    where: { id: account.id },
    data: {
      balance: { decrement: amount },
      totalSpent: { increment: amount },
    },
  });

  return {
    withdrawal: serializeWithdrawal(withdrawal),
    transaction: serializeTransaction(tx, account.accountId),
    newBalance: updated.balance,
  };
}

// ---------------------------------------------------------------------------
// 4. getUserWithdrawals — list pending/recent withdrawal requests for a user
// ---------------------------------------------------------------------------

export async function getUserWithdrawals(
  userId: string,
  limit = 20,
): Promise<WithdrawalRequestRow[]> {
  const rows = await db.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeWithdrawal);
}

// ---------------------------------------------------------------------------
// Serializers (camelCase Date fields → ISO strings for JSON responses)
// ---------------------------------------------------------------------------

function serializeAccount(a: any): WalletAccount {
  return {
    id: a.id,
    accountId: a.accountId,
    ownerId: a.ownerId,
    ownerType: a.ownerType,
    ownerName: a.ownerName,
    balance: a.balance,
    totalEarned: a.totalEarned,
    totalSpent: a.totalSpent,
    totalDeposited: a.totalDeposited,
    active: a.active,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
    updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : a.updatedAt,
  };
}

function serializeTransaction(t: any, userAccountId: string): WalletTransaction {
  // Determine direction relative to the user's account.
  const isCredit = t.toAccountId === userAccountId;
  const direction: "credit" | "debit" = isCredit ? "credit" : "debit";
  // The counter-party is whichever side the user is NOT on.
  const counterParty = isCredit ? (t.fromOwnerName ?? "platform") : (t.toOwnerName ?? "platform");
  return {
    id: t.id,
    transactionId: t.transactionId,
    direction,
    amount: t.amount,
    type: t.type,
    description: t.description,
    counterParty,
    referenceType: t.referenceType,
    referenceId: t.referenceId,
    processedAt: t.processedAt instanceof Date ? t.processedAt.toISOString() : t.processedAt,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

function serializeWithdrawal(w: any): WithdrawalRequestRow {
  return {
    id: w.id,
    requestId: w.requestId,
    userId: w.userId,
    accountId: w.accountId,
    amount: w.amount,
    mobileMoneyNumber: w.mobileMoneyNumber,
    provider: w.provider,
    status: w.status,
    notes: w.notes,
    processedAt: w.processedAt instanceof Date ? w.processedAt.toISOString() : w.processedAt,
    createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : w.updatedAt,
  };
}
