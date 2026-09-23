import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AccountTransaction } from "@/types/banking";
import type { DemoLedgerEntry, TransferMethod } from "@/types/transfers";

const LEDGER_KEY_PREFIX = "idbi-demo-transfer-ledger";
const memory = new Map<string, DemoLedgerEntry[]>();

function scope(customerId: string): string {
  return customerId.trim() || "demo-customer-a";
}

function key(customerId: string): string {
  return `${LEDGER_KEY_PREFIX}.${scope(customerId).replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

function parse(value: string | null): DemoLedgerEntry[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is DemoLedgerEntry => Boolean(item) && typeof item === "object" && typeof (item as { id?: unknown }).id === "string")
      : [];
  } catch {
    return [];
  }
}

async function load(customerId: string): Promise<DemoLedgerEntry[]> {
  const customerScope = scope(customerId);
  const cached = memory.get(customerScope);
  if (cached) return cached;
  try {
    let stored = await SecureStore.getItemAsync(key(customerScope));
    if (!stored && Platform.OS === "web" && typeof localStorage !== "undefined") {
      stored = localStorage.getItem(key(customerScope));
    }
    const entries = parse(stored);
    memory.set(customerScope, entries);
    return entries;
  } catch {
    const entries = Platform.OS === "web" && typeof localStorage !== "undefined"
      ? parse(localStorage.getItem(key(customerScope)))
      : [];
    memory.set(customerScope, entries);
    return entries;
  }
}

async function save(customerId: string, entries: DemoLedgerEntry[]): Promise<void> {
  const customerScope = scope(customerId);
  memory.set(customerScope, entries);
  const serialized = JSON.stringify(entries);
  try {
    await SecureStore.setItemAsync(key(customerScope), serialized);
  } catch {
    // The in-memory value keeps the demo usable when secure storage is unavailable.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(key(customerScope), serialized);
    } catch {
      // Browser storage may be disabled.
    }
  }
}

export async function recordDemoTransferLedger(input: {
  transferId: string;
  customerId: string;
  sourceAccountId: string;
  destinationAccountId?: string;
  amountMinorUnits: number;
  feeMinorUnits?: number;
  method: TransferMethod;
  recipientLabel: string;
  internalReference: string;
  returned?: boolean;
  transactionDate?: string;
}): Promise<DemoLedgerEntry[]> {
  const entries = await load(input.customerId);
  if (entries.some((entry) => entry.transferId === input.transferId)) return entries;

  const date = input.transactionDate ?? new Date().toISOString().slice(0, 10);
  const channel = input.method === "upi" ? "UPI" : input.method === "imps" ? "IMPS" : input.method === "neft" ? "NEFT" : "NEFT";
  const groupId = `transfer-group-${input.transferId}`;
  const debitId = `ledger-${input.transferId}-debit`;
  const debit: DemoLedgerEntry = {
    id: debitId,
    transferId: input.transferId,
    groupId,
    customerId: input.customerId,
    accountId: input.sourceAccountId,
    direction: "debit",
    amountMinorUnits: input.amountMinorUnits,
    description: input.returned ? `Returned transfer · ${input.recipientLabel}` : `Transfer to ${input.recipientLabel}`,
    status: "posted",
    transactionDate: date,
    reference: input.internalReference,
    channel,
    sourceEnvironment: "Demo data",
  };
  const next = [...entries, debit];

  if (input.destinationAccountId) {
    next.push({
      ...debit,
      id: `ledger-${input.transferId}-credit`,
      accountId: input.destinationAccountId,
      direction: "credit",
      description: `Transfer from ${input.sourceAccountId}`,
      linkedEntryId: debit.id,
    });
  }

  if (input.returned) {
    next.push({
      ...debit,
      id: `ledger-${input.transferId}-return`,
      accountId: input.sourceAccountId,
      direction: "credit",
      description: `Return from ${input.recipientLabel}`,
      linkedEntryId: debit.id,
      reference: `${input.internalReference}-RETURN`,
    });
  }

  if (input.feeMinorUnits && input.feeMinorUnits > 0) {
    next.push({
      ...debit,
      id: `ledger-${input.transferId}-fee`,
      direction: "debit",
      amountMinorUnits: input.feeMinorUnits,
      description: "Transfer fee",
      linkedEntryId: debit.id,
      reference: `${input.internalReference}-FEE`,
    });
  }

  await save(input.customerId, next);
  return next;
}

export async function getDemoTransferBalanceAdjustments(customerId: string): Promise<Record<string, number>> {
  const entries = await load(customerId);
  return entries.reduce<Record<string, number>>((adjustments, entry) => {
    if (!entry.accountId || entry.status !== "posted") return adjustments;
    const signedAmount = entry.direction === "credit" ? entry.amountMinorUnits : -entry.amountMinorUnits;
    adjustments[entry.accountId] = (adjustments[entry.accountId] ?? 0) + signedAmount;
    return adjustments;
  }, {});
}

export async function getDemoTransferLedgerTransactions(customerId: string, accountId: string): Promise<AccountTransaction[]> {
  const entries = await load(customerId);
  return entries
    .filter((entry) => entry.accountId === accountId)
    .map((entry) => ({
      id: entry.id,
      sourceTransactionId: entry.id,
      accountId,
      amountMinorUnits: entry.amountMinorUnits,
      currency: "INR" as const,
      direction: entry.direction,
      status: entry.status,
      transactionDate: entry.transactionDate,
      postedDate: entry.transactionDate,
      valueDate: entry.transactionDate,
      counterparty: entry.description,
      description: entry.description,
      bankDescription: entry.description,
      channel: entry.channel,
      originalCategory: "transfer" as const,
      reference: entry.reference,
      linkedTransactionId: entry.linkedEntryId,
      activityGroupId: entry.groupId,
      sourceEnvironment: "Demo data" as const,
    }));
}

export async function clearDemoTransferLedger(customerId?: string): Promise<void> {
  if (!customerId) {
    memory.clear();
    return;
  }
  const customerScope = scope(customerId);
  memory.delete(customerScope);
  try {
    await SecureStore.deleteItemAsync(key(customerScope));
  } catch {
    // Best-effort test cleanup.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key(customerScope));
    } catch {
      // Best-effort test cleanup.
    }
  }
}
