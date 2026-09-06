import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
  DEMO_SCENARIO_DATE,
  demoAccounts,
  demoCustomerFixtures,
  getDemoCustomerFixture,
} from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import type {
  AccountTransaction,
  BankAccount,
  PaymentChannel,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
} from "@/types/banking";

const DEFAULT_CUSTOMER_ID = DEMO_CUSTOMER_A;
const PAGE_SIZE = 8;
const MAX_SEARCH_LENGTH = 80;
const MAX_NOTE_LENGTH = 240;
const PREFERENCE_KEY_PREFIX = "idbi-account-preferences";

export type AccountListFilter = "all" | "savings" | "current" | "deposits";
export type TransactionPeriod = "all" | "this-month" | "last-month" | "custom";

export type TransactionFilters = {
  search?: string;
  period?: TransactionPeriod;
  fromDate?: string;
  toDate?: string;
  direction?: TransactionDirection | "all";
  category?: TransactionCategory | "all";
  status?: TransactionStatus | "all";
  channel?: PaymentChannel | "all";
};

export type NormalizedTransactionFilters = {
  search: string;
  period: TransactionPeriod;
  fromDate?: string;
  toDate?: string;
  direction: TransactionDirection | "all";
  category: TransactionCategory | "all";
  status: TransactionStatus | "all";
  channel: PaymentChannel | "all";
};

export type TransactionSummary = {
  moneyInMinorUnits: number;
  moneyOutMinorUnits: number;
  netMovementMinorUnits: number;
  includedTransactionCount: number;
  scopeLabel: string;
  coverageLabel: string;
};

export type TransactionPage = {
  items: AccountTransaction[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: NormalizedTransactionFilters;
  summary: TransactionSummary;
};

export type AccountPreference = {
  nickname?: string;
  isPrimary?: boolean;
  balanceVisible?: boolean;
};

export type AccountDocument = {
  id: string;
  title: string;
  period: string;
  source: "Application generated";
  description: string;
};

export type TransactionCsv = {
  filename: string;
  rowCount: number;
  csv: string;
};

type StoredPreferences = {
  accountPreferences: Record<string, AccountPreference>;
  annotations: Record<string, { category?: TransactionCategory; note?: string }>;
};

const inMemoryPreferences = new Map<string, StoredPreferences>();

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  "salary",
  "shopping",
  "food",
  "bill",
  "transfer",
  "refund",
  "cash",
  "deposit",
  "interest",
  "other",
];

export const TRANSACTION_STATUSES: TransactionStatus[] = [
  "posted",
  "pending",
  "failed",
  "reversed",
];

export const TRANSACTION_CHANNELS: PaymentChannel[] = [
  "UPI",
  "Card",
  "NEFT",
  "IMPS",
  "ATM",
  "Standing instruction",
  "Branch",
];

function getCustomerScope(customerId?: string | null): string {
  return customerId || DEFAULT_CUSTOMER_ID;
}

function getFixtureCustomerId(customerId?: string | null): string {
  if (!customerId) {
    return DEFAULT_CUSTOMER_ID;
  }

  return customerId === DEMO_CUSTOMER_B || customerId.includes("customer-b")
    ? DEMO_CUSTOMER_B
    : DEFAULT_CUSTOMER_ID;
}

function preferenceKey(customerId: string): string {
  const safeCustomerId = getCustomerScope(customerId).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${PREFERENCE_KEY_PREFIX}.${safeCustomerId}`;
}

function emptyPreferences(): StoredPreferences {
  return { accountPreferences: {}, annotations: {} };
}

function isCategory(value: unknown): value is TransactionCategory {
  return typeof value === "string" && TRANSACTION_CATEGORIES.includes(value as TransactionCategory);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parsePreferences(value: string | null): StoredPreferences {
  if (!value) {
    return emptyPreferences();
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return emptyPreferences();
    }

    const record = parsed as Record<string, unknown>;
    const accountPreferences = record.accountPreferences;
    const annotations = record.annotations;

    return {
      accountPreferences:
        accountPreferences && typeof accountPreferences === "object"
          ? (accountPreferences as Record<string, AccountPreference>)
          : {},
      annotations:
        annotations && typeof annotations === "object"
          ? (annotations as Record<string, { category?: TransactionCategory; note?: string }>)
          : {},
    };
  } catch {
    return emptyPreferences();
  }
}

async function loadPreferences(customerId?: string | null): Promise<StoredPreferences> {
  const scopedCustomerId = getCustomerScope(customerId);
  const existing = inMemoryPreferences.get(scopedCustomerId);
  if (existing) {
    return existing;
  }

  try {
    let storedValue = await SecureStore.getItemAsync(preferenceKey(scopedCustomerId));
    // Web has no SecureStore implementation in Expo SDK 54. Only the small
    // customer-preference record is allowed into browser storage; account and
    // transaction payloads remain fixture/service data and are never cached there.
    if (!storedValue && Platform.OS === "web" && typeof localStorage !== "undefined") {
      storedValue = localStorage.getItem(preferenceKey(scopedCustomerId));
    }
    const stored = parsePreferences(storedValue);
    inMemoryPreferences.set(scopedCustomerId, stored);
    return stored;
  } catch {
    const fallback = Platform.OS === "web" && typeof localStorage !== "undefined"
      ? parsePreferences(localStorage.getItem(preferenceKey(scopedCustomerId)))
      : emptyPreferences();
    inMemoryPreferences.set(scopedCustomerId, fallback);
    return fallback;
  }
}

async function persistPreferences(customerId: string, preferences: StoredPreferences) {
  const scopedCustomerId = getCustomerScope(customerId);
  inMemoryPreferences.set(scopedCustomerId, preferences);

  try {
    await SecureStore.setItemAsync(preferenceKey(scopedCustomerId), JSON.stringify(preferences));
  } catch {
    // The in-memory value keeps the current session usable. A real backend
    // adapter should persist this customer-owned data server-side.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(preferenceKey(scopedCustomerId), JSON.stringify(preferences));
    } catch {
      // Browser storage may be disabled; the in-memory value still works.
    }
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("The request was cancelled", "AbortError");
  }
}

function applyAccountPreferences(
  accounts: BankAccount[],
  preferences: StoredPreferences,
): BankAccount[] {
  const preferredPrimaryId = accounts.find(
    (account) => account.capabilities.canSetPrimary && preferences.accountPreferences[account.id]?.isPrimary,
  )?.id;

  return accounts.map((account) => {
    const accountPreference = preferences.accountPreferences[account.id];
    const isPrimary = preferredPrimaryId
      ? account.id === preferredPrimaryId
      : account.isPrimary;

    return {
      ...account,
      nickname: accountPreference?.nickname || undefined,
      isPrimary,
    };
  });
}

export async function getAccounts(options?: { customerId?: string | null; signal?: AbortSignal }) {
  assertNotAborted(options?.signal);
  const fixture = getDemoCustomerFixture(getFixtureCustomerId(options?.customerId));
  const preferences = await loadPreferences(options?.customerId);
  assertNotAborted(options?.signal);

  return applyAccountPreferences(fixture.accounts, preferences);
}

export async function getAccount(
  accountId: string,
  options?: { customerId?: string | null; signal?: AbortSignal },
): Promise<BankAccount | undefined> {
  if (!accountId.trim()) {
    return undefined;
  }

  const accounts = await getAccounts(options);
  return accounts.find((account) => account.id === accountId);
}

export async function getAccountPreference(
  accountId: string,
  options?: { customerId?: string | null },
): Promise<AccountPreference> {
  const account = await getAccount(accountId, options);
  if (!account) {
    throw new Error("Account unavailable");
  }

  const preferences = await loadPreferences(options?.customerId);
  return preferences.accountPreferences[accountId] ?? { balanceVisible: true };
}

export async function updateAccountPreference(
  accountId: string,
  patch: AccountPreference,
  options?: { customerId?: string | null },
): Promise<BankAccount> {
  const scopedCustomerId = getCustomerScope(options?.customerId);
  const account = await getAccount(accountId, { customerId: scopedCustomerId });
  if (!account) {
    throw new Error("Account unavailable");
  }

  if (patch.nickname !== undefined && patch.nickname.trim().length > 40) {
    throw new Error("Nickname must be 40 characters or fewer");
  }

  if (patch.isPrimary && !account.capabilities.canSetPrimary) {
    throw new Error("Deposits cannot be set as a primary payment account");
  }

  const preferences = await loadPreferences(scopedCustomerId);
  const nextPreferences: StoredPreferences = {
    accountPreferences: { ...preferences.accountPreferences },
    annotations: preferences.annotations,
  };
  const current = nextPreferences.accountPreferences[accountId] ?? {};
  nextPreferences.accountPreferences[accountId] = {
    ...current,
    ...patch,
    nickname: patch.nickname === undefined ? current.nickname : patch.nickname.trim() || undefined,
  };

  if (patch.isPrimary) {
    const eligibleAccounts = (await getAccounts({ customerId: scopedCustomerId })).filter(
      (item) => item.capabilities.canSetPrimary,
    );
    for (const eligibleAccount of eligibleAccounts) {
      nextPreferences.accountPreferences[eligibleAccount.id] = {
        ...nextPreferences.accountPreferences[eligibleAccount.id],
        isPrimary: eligibleAccount.id === accountId,
      };
    }
  }

  await persistPreferences(scopedCustomerId, nextPreferences);
  return (await getAccount(accountId, { customerId: scopedCustomerId })) as BankAccount;
}

export async function updateBalanceVisibility(
  accountId: string,
  visible: boolean,
  options?: { customerId?: string | null },
) {
  return updateAccountPreference(accountId, { balanceVisible: visible }, options);
}

export function normalizeTransactionFilters(input?: TransactionFilters): NormalizedTransactionFilters {
  const search = input?.search?.trim() ?? "";
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new Error(`Search must be ${MAX_SEARCH_LENGTH} characters or fewer`);
  }

  const period = input?.period ?? "all";
  let fromDate = input?.fromDate;
  let toDate = input?.toDate;

  if (period === "this-month") {
    fromDate = "2026-09-01";
    toDate = "2026-09-30";
  } else if (period === "last-month") {
    fromDate = "2026-08-01";
    toDate = "2026-08-31";
  }

  if (period === "custom" && (!fromDate || !toDate)) {
    throw new Error("Choose both a start and end date");
  }

  if (fromDate && !isValidIsoDate(fromDate)) {
    throw new Error("Start date must use YYYY-MM-DD");
  }
  if (toDate && !isValidIsoDate(toDate)) {
    throw new Error("End date must use YYYY-MM-DD");
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error("Start date must be before the end date");
  }

  return {
    search,
    period,
    fromDate,
    toDate,
    direction: input?.direction ?? "all",
    category: input?.category ?? "all",
    status: input?.status ?? "all",
    channel: input?.channel ?? "all",
  };
}

function effectiveCategory(transaction: AccountTransaction): TransactionCategory {
  return transaction.annotation?.category ?? transaction.originalCategory;
}

function matchesTransaction(
  transaction: AccountTransaction,
  filters: NormalizedTransactionFilters,
): boolean {
  const search = filters.search.toLocaleLowerCase();
  const searchableText = [
    transaction.counterparty,
    transaction.description,
    transaction.bankDescription,
    transaction.reference,
    transaction.sourceTransactionId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  if (search && !searchableText.includes(search)) {
    return false;
  }
  if (filters.fromDate && transaction.transactionDate < filters.fromDate) {
    return false;
  }
  if (filters.toDate && transaction.transactionDate > filters.toDate) {
    return false;
  }
  if (filters.direction !== "all" && transaction.direction !== filters.direction) {
    return false;
  }
  if (filters.category !== "all" && effectiveCategory(transaction) !== filters.category) {
    return false;
  }
  if (filters.status !== "all" && transaction.status !== filters.status) {
    return false;
  }
  if (filters.channel !== "all" && transaction.channel !== filters.channel) {
    return false;
  }

  return true;
}

function sortTransactions(transactions: AccountTransaction[]) {
  return [...transactions].sort((left, right) => {
    const dateCompare = right.transactionDate.localeCompare(left.transactionDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const timeCompare = (right.transactionTime ?? "").localeCompare(left.transactionTime ?? "");
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return right.id.localeCompare(left.id);
  });
}

function calculateSummary(
  transactions: AccountTransaction[],
  filters: NormalizedTransactionFilters,
): TransactionSummary {
  const postedTransactions = transactions.filter(
    (transaction) => transaction.status === "posted" || transaction.status === "reversed",
  );
  const moneyInMinorUnits = postedTransactions
    .filter((transaction) => transaction.direction === "credit")
    .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);
  const moneyOutMinorUnits = postedTransactions
    .filter((transaction) => transaction.direction === "debit")
    .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);

  const scopeLabel = filters.period === "this-month"
    ? "This month · posted and reversed"
    : filters.period === "last-month"
      ? "Last month · posted and reversed"
      : filters.fromDate || filters.toDate
        ? `${filters.fromDate ?? "Start"} to ${filters.toDate ?? "End"} · posted and reversed`
        : "All available demo history · posted and reversed";

  return {
    moneyInMinorUnits,
    moneyOutMinorUnits,
    netMovementMinorUnits: moneyInMinorUnits - moneyOutMinorUnits,
    includedTransactionCount: postedTransactions.length,
    scopeLabel,
    coverageLabel: "Complete for the demo scenario; pending and failed rows excluded from totals",
  };
}

async function getFilteredTransactions(
  accountId: string,
  filters: TransactionFilters | undefined,
  options?: { customerId?: string | null; signal?: AbortSignal },
) {
  const account = await getAccount(accountId, options);
  if (!account) {
    throw new Error("Account unavailable");
  }

  const normalizedFilters = normalizeTransactionFilters(filters);
  const preferences = await loadPreferences(options?.customerId);
  const fixture = getDemoCustomerFixture(getFixtureCustomerId(options?.customerId));
  const transactions = fixture.transactions
    .filter((transaction) => transaction.accountId === account.id)
    .map((transaction) => ({
      ...transaction,
      annotation: preferences.annotations[transaction.id],
    }));

  assertNotAborted(options?.signal);
  const matchingTransactions = sortTransactions(
    transactions.filter((transaction) => matchesTransaction(transaction, normalizedFilters)),
  );

  return { matchingTransactions, normalizedFilters };
}

export async function getAccountTransactions(
  accountId: string,
  options?: {
    customerId?: string | null;
    signal?: AbortSignal;
    filters?: TransactionFilters;
    page?: number;
    pageSize?: number;
  },
): Promise<TransactionPage> {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = Math.min(20, Math.max(1, Math.floor(options?.pageSize ?? PAGE_SIZE)));
  const { matchingTransactions, normalizedFilters } = await getFilteredTransactions(
    accountId,
    options?.filters,
    options,
  );
  const totalPages = Math.max(1, Math.ceil(matchingTransactions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: matchingTransactions.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems: matchingTransactions.length,
    totalPages,
    filters: normalizedFilters,
    summary: calculateSummary(matchingTransactions, normalizedFilters),
  };
}

export async function getTransaction(
  accountId: string,
  transactionId: string,
  options?: { customerId?: string | null; signal?: AbortSignal },
): Promise<AccountTransaction | undefined> {
  const account = await getAccount(accountId, options);
  if (!account) {
    return undefined;
  }

  const preferences = await loadPreferences(options?.customerId);
  const fixture = getDemoCustomerFixture(getFixtureCustomerId(options?.customerId));
  const transaction = fixture.transactions.find(
    (item) => item.id === transactionId && item.accountId === account.id,
  );

  return transaction
    ? { ...transaction, annotation: preferences.annotations[transaction.id] }
    : undefined;
}

export async function getRecentActivities(options?: { customerId?: string | null }) {
  const accounts = await getAccounts(options);
  const accountIds = new Set(accounts.map((account) => account.id));
  const fixture = getDemoCustomerFixture(getFixtureCustomerId(options?.customerId));

  return sortTransactions(
    fixture.transactions.filter((transaction) => accountIds.has(transaction.accountId)),
  )
    .slice(0, 4)
    .map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      title: transaction.counterparty ?? transaction.description,
      timestamp: `${transaction.transactionDate}${transaction.transactionTime ? `, ${transaction.transactionTime}` : ""}`,
      amount: transaction.amountMinorUnits / 100,
      amountMinorUnits: transaction.amountMinorUnits,
      direction: transaction.direction,
      category: transaction.originalCategory,
    }));
}

export async function updateTransactionAnnotation(
  accountId: string,
  transactionId: string,
  patch: { category?: TransactionCategory; note?: string },
  options?: { customerId?: string | null },
): Promise<AccountTransaction> {
  const scopedCustomerId = getCustomerScope(options?.customerId);
  const transaction = await getTransaction(accountId, transactionId, { customerId: scopedCustomerId });
  if (!transaction) {
    throw new Error("Transaction unavailable");
  }
  if (patch.category !== undefined && !isCategory(patch.category)) {
    throw new Error("Choose a valid transaction category");
  }
  if (patch.note !== undefined && patch.note.trim().length > MAX_NOTE_LENGTH) {
    throw new Error(`Note must be ${MAX_NOTE_LENGTH} characters or fewer`);
  }

  const preferences = await loadPreferences(scopedCustomerId);
  const current = preferences.annotations[transactionId] ?? {};
  const nextPreferences: StoredPreferences = {
    accountPreferences: preferences.accountPreferences,
    annotations: {
      ...preferences.annotations,
      [transactionId]: {
        ...current,
        category: patch.category ?? current.category,
        note: patch.note === undefined ? current.note : patch.note.trim() || undefined,
      },
    },
  };
  await persistPreferences(scopedCustomerId, nextPreferences);

  return (await getTransaction(accountId, transactionId, { customerId: scopedCustomerId })) as AccountTransaction;
}

export async function getAccountDocuments(
  accountId: string,
  options?: { customerId?: string | null },
): Promise<AccountDocument[]> {
  const account = await getAccount(accountId, options);
  if (!account) {
    throw new Error("Account unavailable");
  }

  return [
    {
      id: `demo-summary-${account.id}`,
      title: "Transaction summary",
      period: "All available demo history",
      source: "Application generated",
      description: "Demo transaction summary — not an official bank statement.",
    },
  ];
}

function escapeCsvCell(value: string, neutralizeFormula = false): string {
  const safeValue = neutralizeFormula && /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
}

export async function createTransactionCsv(
  accountId: string,
  filters?: TransactionFilters,
  options?: { customerId?: string | null; signal?: AbortSignal },
): Promise<TransactionCsv> {
  const { matchingTransactions, normalizedFilters } = await getFilteredTransactions(accountId, filters, options);
  const account = await getAccount(accountId, options);
  if (!account) {
    throw new Error("Account unavailable");
  }

  const header = [
    "Transaction date",
    "Time",
    "Merchant or counterparty",
    "Bank description",
    "Direction",
    "Amount",
    "Currency",
    "Status",
    "Category",
    "Payment channel",
    "Reference",
  ];
  const rows = matchingTransactions.map((transaction) => [
    transaction.transactionDate,
    transaction.transactionTime ?? "",
    transaction.counterparty ?? transaction.description,
    transaction.bankDescription,
    transaction.direction,
    (transaction.amountMinorUnits / 100).toFixed(2),
    transaction.currency,
    transaction.status,
    effectiveCategory(transaction),
    transaction.channel ?? "",
    transaction.reference ?? "",
  ]);
  const csv = [
    ["Demo transaction summary — not an official bank statement."],
    [`Account: ${account.name} ending in ${account.lastFour}`],
    [`Scope: ${normalizedFilters.period}`],
    header,
    ...rows,
  ]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell), true)).join(","))
    .join("\r\n");

  return {
    filename: `idbi-${account.id}-transactions.csv`,
    rowCount: matchingTransactions.length,
    csv: `${csv}\r\n`,
  };
}

export function sumMinorUnits(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function formatSummaryAmount(minorUnits: number): string {
  return formatIndianMinorUnits(minorUnits);
}

/** Useful for test/demo tooling without exposing records to the UI. */
export function getSeededCustomerIds() {
  return Object.keys(demoCustomerFixtures);
}

export function getSeededAccountCount() {
  return demoAccounts.length;
}

export async function clearCustomerPreferences(customerId?: string | null) {
  const scopedCustomerId = getCustomerScope(customerId);
  inMemoryPreferences.delete(scopedCustomerId);
  try {
    await SecureStore.deleteItemAsync(preferenceKey(scopedCustomerId));
  } catch {
    // Best-effort cleanup for platforms where SecureStore is unavailable.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(preferenceKey(scopedCustomerId));
    } catch {
      // Best-effort cleanup for browser storage.
    }
  }
}

export { DEMO_SCENARIO_DATE };
