import { DEMO_CUSTOMER_A, DEMO_SCENARIO_DATE } from "@/data/accounts-demo-data";
import { getRemoteCardTransactions } from "@/lib/api/cards";
import { apiRequest } from "@/lib/api/client";
import type { AccountsResponse, ApiCard, ApiCardTransaction, ApiTransaction, TransactionsResponse } from "@/lib/api/types";
import { apiAccountToBankAccount, apiCardToCardRecord, apiCardTransactionToCardTransaction, parseApiMoneyToMinorUnits } from "@/lib/api/view-models";
import { formatIndianMinorUnits } from "@/lib/currency";
import {
  getAccountTransactions,
  getAccounts,
  TRANSACTION_CATEGORIES,
  updateTransactionAnnotation,
} from "@/services/accounts-service";
import {
  getCardTransactions,
  getCards,
  updateCardTransactionAnnotation,
} from "@/services/cards-service";
import type { AccountTransaction, BankAccount, PaymentChannel, TransactionCategory, TransactionDirection, TransactionStatus } from "@/types/banking";
import type { CardRecord, CardTransaction } from "@/types/cards";
import type {
  ActivityCsv,
  ActivityCoverage,
  ActivityExportPreview,
  ActivityLedgerEntry,
  ActivityPage,
  ActivityPeriodPreset,
  ActivityQueryInput,
  ActivityQuerySnapshot,
  ActivityRecord,
  ActivityScope,
  ActivitySourceReference,
  ActivitySort,
  ActivitySummary,
  ActivityTransactionType,
  NormalizedActivityQuery,
} from "@/types/transaction-explorer";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 80;
const DATA_REVISION = `demo-${DEMO_SCENARIO_DATE}`;

type ExplorerResources = { accounts: BankAccount[]; cards: CardRecord[] };
type RemoteOptions = { getToken: () => Promise<string | null>; signal?: AbortSignal; resources?: ExplorerResources };

type RawActivity = ActivityRecord & {
  isCardDuplicate?: boolean;
};

function customerScope(customerId?: string | null): string {
  return customerId?.trim() || DEMO_CUSTOMER_A;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("The transaction request was cancelled");
    error.name = "AbortError";
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function dateFromScenario(daysAgo: number): string {
  const date = new Date(DEMO_SCENARIO_DATE);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function validDate(value?: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value;
}

function periodDates(period: ActivityPeriodPreset): { fromDate?: string; toDate?: string } {
  if (period === "this-month") return { fromDate: "2026-09-01", toDate: "2026-09-30" };
  if (period === "last-month") return { fromDate: "2026-08-01", toDate: "2026-08-31" };
  if (period === "last-90-days") return { fromDate: dateFromScenario(89), toDate: DEMO_SCENARIO_DATE.slice(0, 10) };
  return {};
}

function normalizeScope(input: ActivityQueryInput["scope"], resources: ExplorerResources): ActivityScope {
  const requestedAccounts = input?.accountIds ?? [];
  const requestedCards = input?.cardIds ?? [];
  const accounts = requestedAccounts.length
    ? requestedAccounts.filter((id) => resources.accounts.some((account) => account.id === id))
    : resources.accounts.map((account) => account.id);
  const cards = requestedCards.length
    ? requestedCards.filter((id) => resources.cards.some((card) => card.id === id))
    : resources.cards.map((card) => card.id);

  if (requestedAccounts.some((id) => !accounts.includes(id))) throw new Error("Account unavailable or you do not have access to it");
  if (requestedCards.some((id) => !cards.includes(id))) throw new Error("Card unavailable or you do not have access to it");

  const requestedMode = input?.mode;
  const mode = requestedMode ?? (requestedAccounts.length && requestedCards.length ? "mixed" : requestedAccounts.length ? "accounts" : requestedCards.length ? "cards" : "all");
  if (mode === "accounts") return { mode, accountIds: requestedAccounts.length ? accounts : resources.accounts.map((account) => account.id), cardIds: [] };
  if (mode === "cards") return { mode, accountIds: [], cardIds: requestedCards.length ? cards : resources.cards.map((card) => card.id) };
  if (mode === "mixed") return { mode, accountIds: accounts, cardIds: cards };
  return { mode: "all", accountIds: resources.accounts.map((account) => account.id), cardIds: resources.cards.map((card) => card.id) };
}

export function normalizeActivityQuery(input: ActivityQueryInput | undefined, resources: ExplorerResources): NormalizedActivityQuery {
  const period = input?.period ?? "all";
  const periodBoundary = periodDates(period);
  const fromDate = input?.fromDate ?? periodBoundary.fromDate;
  const toDate = input?.toDate ?? periodBoundary.toDate;
  if (fromDate && !validDate(fromDate)) throw new Error("Start date must use YYYY-MM-DD");
  if (toDate && !validDate(toDate)) throw new Error("End date must use YYYY-MM-DD");
  if (fromDate && toDate && fromDate > toDate) throw new Error("Start date must be before end date");
  const search = input?.search?.trim() ?? "";
  if (search.length > MAX_SEARCH_LENGTH) throw new Error(`Search must be ${MAX_SEARCH_LENGTH} characters or fewer`);
  const minAmountMinorUnits = input?.minAmountMinorUnits;
  const maxAmountMinorUnits = input?.maxAmountMinorUnits;
  if (minAmountMinorUnits !== undefined && (!Number.isSafeInteger(minAmountMinorUnits) || minAmountMinorUnits < 0)) throw new Error("Minimum amount is invalid");
  if (maxAmountMinorUnits !== undefined && (!Number.isSafeInteger(maxAmountMinorUnits) || maxAmountMinorUnits < 0)) throw new Error("Maximum amount is invalid");
  if (minAmountMinorUnits !== undefined && maxAmountMinorUnits !== undefined && minAmountMinorUnits > maxAmountMinorUnits) throw new Error("Minimum amount must be below maximum amount");
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input?.pageSize ?? DEFAULT_PAGE_SIZE)));
  void pageSize;
  return {
    scope: normalizeScope(input?.scope, resources),
    search: search.toLocaleLowerCase(),
    period,
    fromDate,
    toDate,
    direction: input?.direction ?? "all",
    transactionType: input?.transactionType ?? "all",
    status: input?.status ?? "all",
    category: input?.category ?? "all",
    channel: input?.channel ?? "all",
    minAmountMinorUnits,
    maxAmountMinorUnits,
    currency: input?.currency ?? "INR",
    sort: input?.sort ?? "newest",
  };
}

export async function getTransactionExplorerResources(options?: { customerId?: string | null; signal?: AbortSignal }): Promise<ExplorerResources> {
  assertNotAborted(options?.signal);
  const [accounts, cards] = await Promise.all([
    getAccounts({ customerId: customerScope(options?.customerId), signal: options?.signal }),
    getCards({ customerId: customerScope(options?.customerId), signal: options?.signal }),
  ]);
  assertNotAborted(options?.signal);
  return { accounts, cards };
}

async function loadAllAccountTransactions(accountId: string, customerId: string, signal?: AbortSignal): Promise<AccountTransaction[]> {
  const items: AccountTransaction[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    assertNotAborted(signal);
    const result = await getAccountTransactions(accountId, { customerId, filters: { status: "all" }, page, pageSize: 20, signal });
    items.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

async function loadAllCardTransactions(cardId: string, customerId: string, signal?: AbortSignal): Promise<CardTransaction[]> {
  const items: CardTransaction[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    assertNotAborted(signal);
    const result = await getCardTransactions(cardId, { customerId, filters: { status: "all" }, page, pageSize: 20, signal });
    items.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

function categoryToType(category: TransactionCategory, direction: TransactionDirection): ActivityTransactionType {
  if (category === "transfer") return "transfer";
  if (category === "deposit") return "deposit";
  if (category === "salary") return "salary";
  if (category === "interest") return "interest";
  if (category === "refund") return "refund";
  if (category === "cash") return "cash-withdrawal";
  if (direction === "debit") return "purchase";
  return "other";
}

function cardTypeToActivityType(type: CardTransaction["transactionType"]): ActivityTransactionType {
  return type;
}

function accountReference(account: BankAccount): ActivitySourceReference {
  return { kind: "account", id: account.id, accountId: account.id, label: `${account.nickname ?? account.name} · •••• ${account.lastFour}` };
}

function cardReference(card: CardRecord): ActivitySourceReference {
  return { kind: "card", id: card.id, cardId: card.id, label: `${card.nickname ?? card.productName} · •••• ${card.lastFour}` };
}

function accountRecord(transaction: AccountTransaction, account: BankAccount): RawActivity {
  const category = transaction.annotation?.category ?? transaction.originalCategory;
  const source: ActivitySourceReference = { kind: "account-transaction", id: transaction.id, accountId: account.id, label: transaction.counterparty ?? transaction.description };
  const ledgerEntry: ActivityLedgerEntry = {
    id: transaction.id,
    accountId: account.id,
    direction: transaction.direction,
    amountMinorUnits: transaction.amountMinorUnits,
    status: transaction.status,
    transactionDate: transaction.transactionDate,
    reference: transaction.reference,
  };
  return {
    id: `account:${transaction.id}`,
    sourceKind: "account-ledger",
    title: transaction.counterparty ?? transaction.description,
    description: transaction.description,
    amountMinorUnits: transaction.amountMinorUnits,
    currency: transaction.currency,
    direction: transaction.direction,
    status: transaction.status,
    transactionType: categoryToType(category, transaction.direction),
    category,
    originalCategory: transaction.originalCategory,
    channel: transaction.channel,
    transactionDate: transaction.transactionDate,
    postedDate: transaction.postedDate,
    valueDate: transaction.valueDate,
    transactionTime: transaction.transactionTime,
    bankDescription: transaction.bankDescription,
    reference: transaction.reference,
    accountId: account.id,
    accountLabel: accountReference(account).label,
    sourceEnvironment: transaction.sourceEnvironment,
    sourceReferences: [accountReference(account), source],
    ledgerEntries: [ledgerEntry],
    relatedRecordIds: transaction.linkedTransactionId ? [`account:${transaction.linkedTransactionId}`] : [],
    activityGroupId: transaction.activityGroupId,
    annotation: transaction.annotation,
    searchText: [transaction.description, transaction.bankDescription, transaction.counterparty, transaction.reference, transaction.sourceTransactionId].filter(Boolean).join(" "),
  };
}

function cardRecord(transaction: CardTransaction, card: CardRecord, account?: BankAccount): RawActivity {
  const category = transaction.annotation?.category ?? transaction.category ?? "other";
  const source: ActivitySourceReference = { kind: "card-transaction", id: transaction.id, cardId: card.id, label: transaction.merchant ?? transaction.description };
  return {
    id: `card:${transaction.id}`,
    sourceKind: "card-event",
    title: transaction.merchant ?? transaction.description,
    description: transaction.description,
    amountMinorUnits: transaction.amountMinorUnits,
    currency: transaction.currency,
    direction: transaction.direction,
    status: transaction.status,
    transactionType: cardTypeToActivityType(transaction.transactionType),
    category,
    originalCategory: transaction.category,
    channel: transaction.channel,
    transactionDate: transaction.transactionDate,
    postedDate: transaction.postedDate,
    transactionTime: transaction.transactionTime,
    reference: transaction.reference,
    originalCurrency: transaction.originalCurrency,
    postedAmountMinorUnits: transaction.postedAmountMinorUnits,
    accountId: account?.id,
    cardId: card.id,
    accountLabel: account ? accountReference(account).label : undefined,
    cardLabel: cardReference(card).label,
    sourceEnvironment: transaction.sourceEnvironment,
    sourceReferences: [cardReference(card), source],
    ledgerEntries: [],
    relatedRecordIds: transaction.linkedTransactionId ? [`card:${transaction.linkedTransactionId}`] : [],
    annotation: transaction.annotation,
    searchText: [transaction.description, transaction.merchant, transaction.reference, transaction.sourceTransactionId].filter(Boolean).join(" "),
  };
}

function searchableText(record: ActivityRecord): string {
  return [
    record.title,
    record.description,
    record.accountLabel,
    record.cardLabel,
    record.searchText,
    ...record.sourceReferences.map((source) => source.id),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function matches(record: ActivityRecord, query: NormalizedActivityQuery): boolean {
  if (query.search && !searchableText(record).includes(query.search)) return false;
  if (query.fromDate && record.transactionDate < query.fromDate) return false;
  if (query.toDate && record.transactionDate > query.toDate) return false;
  if (query.direction !== "all" && record.direction !== query.direction) return false;
  if (query.transactionType !== "all" && record.transactionType !== query.transactionType) return false;
  if (query.status !== "all" && record.status !== query.status) return false;
  if (query.category !== "all" && record.category !== query.category) return false;
  if (query.channel !== "all" && record.channel !== query.channel) return false;
  if (query.currency !== "all" && record.currency !== query.currency) return false;
  if (query.minAmountMinorUnits !== undefined && record.amountMinorUnits < query.minAmountMinorUnits) return false;
  if (query.maxAmountMinorUnits !== undefined && record.amountMinorUnits > query.maxAmountMinorUnits) return false;
  return true;
}

function compareRecords(left: ActivityRecord, right: ActivityRecord, sort: ActivitySort): number {
  if (sort === "amount-desc" || sort === "amount-asc") {
    const amountCompare = sort === "amount-desc" ? right.amountMinorUnits - left.amountMinorUnits : left.amountMinorUnits - right.amountMinorUnits;
    if (amountCompare !== 0) return amountCompare;
  } else {
    const dateCompare = sort === "newest" ? right.transactionDate.localeCompare(left.transactionDate) : left.transactionDate.localeCompare(right.transactionDate);
    if (dateCompare !== 0) return dateCompare;
    const timeCompare = sort === "newest" ? (right.transactionTime ?? "").localeCompare(left.transactionTime ?? "") : (left.transactionTime ?? "").localeCompare(right.transactionTime ?? "");
    if (timeCompare !== 0) return timeCompare;
  }
  return left.id.localeCompare(right.id);
}

function isPosted(status: TransactionStatus): boolean {
  return status === "posted" || status === "reversed";
}

function dedupeReferences(references: ActivitySourceReference[]): ActivitySourceReference[] {
  return [...new Map(references.map((reference) => [`${reference.kind}:${reference.id}`, reference])).values()];
}

function reconcileRecords(records: RawActivity[], query: NormalizedActivityQuery): RawActivity[] {
  const accountByTransactionId = new Map(records.filter((record) => record.sourceKind === "account-ledger").map((record) => [record.id.replace("account:", ""), record]));
  const result: RawActivity[] = [];
  for (const record of records) {
    if (record.sourceKind !== "card-event" || query.scope.mode === "cards") {
      result.push(record);
      continue;
    }
    const linkedSource = record.relatedRecordIds.find((id) => id.startsWith("account:"));
    const account = linkedSource ? accountByTransactionId.get(linkedSource.replace("account:", "")) : undefined;
    if (!account) {
      result.push(record);
      continue;
    }
    account.sourceReferences = dedupeReferences([...account.sourceReferences, ...record.sourceReferences]);
    account.relatedRecordIds = [...new Set([...account.relatedRecordIds, record.id])];
    record.isCardDuplicate = true;
  }
  return result.filter((record) => !record.isCardDuplicate);
}

function groupOwnTransfers(records: RawActivity[], query: NormalizedActivityQuery): RawActivity[] {
  if (query.direction !== "all" || query.search || query.scope.mode === "cards") return records;
  const groups = new Map<string, RawActivity[]>();
  for (const record of records) {
    const groupId = record.ledgerEntries.length === 1 && record.category === "transfer"
      ? record.activityGroupId
      : undefined;
    if (groupId) groups.set(groupId, [...(groups.get(groupId) ?? []), record]);
  }
  const consumed = new Set<string>();
  const grouped: RawActivity[] = [];
  for (const record of records) {
    const groupId = record.activityGroupId;
    if (!groupId || consumed.has(record.id)) {
      grouped.push(record);
      continue;
    }
    const group = groups.get(groupId) ?? [];
    const accountIds = new Set(group.map((item) => item.accountId).filter(Boolean));
    if (group.length < 2 || accountIds.size < 2 || group.some((item) => !records.includes(item))) {
      grouped.push(record);
      continue;
    }
    group.forEach((item) => consumed.add(item.id));
    const debit = group.find((item) => item.direction === "debit");
    const credit = group.find((item) => item.direction === "credit");
    grouped.push({
      ...record,
      id: `transfer:${groupId}`,
      sourceKind: "transfer-group",
      title: "Between your accounts",
      description: "Own-account movement",
      amountMinorUnits: debit?.amountMinorUnits ?? record.amountMinorUnits,
      direction: "transfer",
      transactionType: "transfer",
      movementFrom: debit?.accountLabel,
      movementTo: credit?.accountLabel,
      sourceReferences: dedupeReferences(group.flatMap((item) => item.sourceReferences)),
      ledgerEntries: group.flatMap((item) => item.ledgerEntries),
      relatedRecordIds: group.map((item) => item.id),
    });
  }
  return grouped;
}

async function loadRecords(customerId: string, resources: ExplorerResources, query: NormalizedActivityQuery, signal?: AbortSignal): Promise<RawActivity[]> {
  const accounts = resources.accounts.filter((account) => query.scope.accountIds.includes(account.id));
  const cards = resources.cards.filter((card) => query.scope.cardIds.includes(card.id));
  const accountResults = query.scope.mode === "cards" ? [] : await Promise.all(accounts.map(async (account) => (await loadAllAccountTransactions(account.id, customerId, signal)).map((item) => accountRecord(item, account))));
  const cardResults = query.scope.mode === "accounts" ? [] : await Promise.all(cards.map(async (card) => {
    const account = card.linkedAccountId ? resources.accounts.find((item) => item.id === card.linkedAccountId) : undefined;
    return (await loadAllCardTransactions(card.id, customerId, signal)).map((item) => {
      const record = cardRecord(item, card, account);
      if (item.linkedAccountTransactionId) record.relatedRecordIds = [`account:${item.linkedAccountTransactionId}`, ...record.relatedRecordIds];
      return record;
    });
  }));
  const unique = new Map<string, RawActivity>();
  [...accountResults.flat(), ...cardResults.flat()].forEach((record) => {
    const key = record.sourceKind === "account-ledger" ? `account:${record.id}` : `card:${record.id}`;
    if (!unique.has(key)) unique.set(key, record);
  });
  const reconciled = reconcileRecords([...unique.values()], query);
  const filtered = reconciled.filter((record) => matches(record, query));
  return groupOwnTransfers(filtered, query);
}

function scopeLabel(query: NormalizedActivityQuery, resources: ExplorerResources): string {
  if (query.scope.mode === "accounts" && query.scope.accountIds.length === 1) {
    const account = resources.accounts.find((item) => item.id === query.scope.accountIds[0]);
    return account ? `${account.nickname ?? account.name} · •••• ${account.lastFour}` : "Selected account";
  }
  if (query.scope.mode === "cards" && query.scope.cardIds.length === 1) {
    const card = resources.cards.find((item) => item.id === query.scope.cardIds[0]);
    return card ? `${card.nickname ?? card.productName} · •••• ${card.lastFour}` : "Selected card";
  }
  if (query.scope.mode === "mixed") return "Selected accounts & cards";
  return "All accounts & cards";
}

function calculateSummary(records: RawActivity[], query: NormalizedActivityQuery, resources: ExplorerResources): ActivitySummary {
  const accountEntries = records.flatMap((record) => record.ledgerEntries);
  const accountCreditsMinorUnits = accountEntries.filter((entry) => entry.direction === "credit" && isPosted(entry.status)).reduce((sum, entry) => sum + entry.amountMinorUnits, 0);
  const accountDebitsMinorUnits = accountEntries.filter((entry) => entry.direction === "debit" && isPosted(entry.status)).reduce((sum, entry) => sum + entry.amountMinorUnits, 0);
  const cardRecords = records.filter((record) => record.sourceKind === "card-event");
  return {
    accountCreditsMinorUnits,
    accountDebitsMinorUnits,
    netAccountMovementMinorUnits: accountCreditsMinorUnits - accountDebitsMinorUnits,
    cardPostedPurchasesMinorUnits: cardRecords.filter((record) => record.transactionType === "purchase" && isPosted(record.status)).reduce((sum, record) => sum + record.amountMinorUnits, 0),
    cardPostedRefundsMinorUnits: cardRecords.filter((record) => record.transactionType === "refund" && isPosted(record.status)).reduce((sum, record) => sum + record.amountMinorUnits, 0),
    includedPostedCount: records.filter((record) => isPosted(record.status)).length,
    pendingCount: records.filter((record) => record.status === "pending").length,
    failedCount: records.filter((record) => record.status === "failed").length,
    scopeLabel: scopeLabel(query, resources),
    coverageLabel: query.scope.mode === "mixed" || query.scope.mode === "all"
      ? "Account totals cover posted payment-account entries; card-only events are shown separately and reconciled only with explicit source relationships."
      : "Totals use the complete matching dataset for the selected scope; unposted attempts are kept separate.",
  };
}

function sourceEnvironmentFor(records: ActivityRecord[], fallback?: "Bank API"): string {
  const environments = records.map((record) => record.sourceEnvironment);
  const accountAggregator = environments.find((environment) => environment.startsWith("Account Aggregator"));
  if (accountAggregator) return accountAggregator;
  if (environments.includes("Bank API") || fallback === "Bank API") return "Bank API";
  if (environments.includes("Demo data")) return "Demo data";
  return "No data available";
}

function sourceCoverageNote(sourceEnvironment: string): string {
  if (sourceEnvironment.startsWith("Account Aggregator")) {
    return "Financial data was supplied through an approved Account Aggregator consent and normalized by the banking API.";
  }
  if (sourceEnvironment === "Bank API") {
    return "Financial data was supplied by the authenticated banking API and may not represent complete lifetime history or an official statement.";
  }
  return "Demo records are synthetic and do not represent complete lifetime banking history or an official statement.";
}

function buildCoverage(
  records: ActivityRecord[],
  query: NormalizedActivityQuery,
  resources: ExplorerResources,
  fallbackSourceEnvironment?: "Bank API",
): ActivityCoverage {
  const dates = records.map((record) => record.transactionDate).sort();
  const selectedAccounts = resources.accounts.filter((account) => query.scope.accountIds.includes(account.id));
  const selectedCards = resources.cards.filter((card) => query.scope.cardIds.includes(card.id));
  const updates = [...selectedAccounts, ...selectedCards].map((item) => item.lastSuccessfulUpdate).sort();
  const sourceEnvironment = sourceEnvironmentFor(records, fallbackSourceEnvironment);
  return {
    includedResources: [...selectedAccounts.map((account) => `${account.name} · •••• ${account.lastFour}`), ...selectedCards.map((card) => `${card.productName} · •••• ${card.lastFour}`)],
    availableFrom: dates[0],
    availableTo: dates[dates.length - 1],
    lastSuccessfulUpdate: updates[updates.length - 1],
    sourceEnvironment,
    isPartial: false,
    note: sourceCoverageNote(sourceEnvironment),
  };
}

function remotePeriodInput(input: ActivityQueryInput | undefined): ActivityQueryInput | undefined {
  if (!input?.period || input.period === "all" || input.period === "custom") return input;
  const today = new Date();
  const currentStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const currentEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const lastStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const lastEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const from = input.period === "this-month" ? currentStart : input.period === "last-month" ? lastStart : new Date(today.getTime() - 89 * 86400000);
  const to = input.period === "this-month" ? currentEnd : input.period === "last-month" ? lastEnd : today;
  return { ...input, period: "custom", fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

function remoteStatus(value: string): TransactionStatus {
  if (value === "completed" || value === "posted") return "posted";
  if (value === "reversed") return "reversed";
  if (value === "failed") return "failed";
  return "pending";
}

function remoteCategory(value: string | null): TransactionCategory {
  if (value === "food_dining") return "food";
  if (value === "utilities") return "bill";
  return value && TRANSACTION_CATEGORIES.includes(value as TransactionCategory) ? value as TransactionCategory : "other";
}

function remoteSource(transaction: ApiTransaction): string {
  const provider = transaction.metadata.provider;
  if (transaction.metadata.source === "account_aggregator") {
    return typeof provider === "string" && provider.trim()
      ? `Account Aggregator · ${provider.trim()}`
      : "Account Aggregator";
  }
  return "Bank API";
}

function remoteRecord(transaction: ApiTransaction, account: BankAccount): RawActivity {
  const category = remoteCategory(transaction.category);
  const date = new Date(transaction.transactionAt);
  const transactionDate = Number.isNaN(date.valueOf()) ? transaction.transactionAt.slice(0, 10) : date.toISOString().slice(0, 10);
  const accountTransaction: AccountTransaction = {
    id: transaction.id,
    sourceTransactionId: transaction.id,
    accountId: transaction.accountId,
    amountMinorUnits: parseApiMoneyToMinorUnits(transaction.amount),
    currency: "INR",
    direction: transaction.direction,
    status: remoteStatus(transaction.status),
    transactionDate,
    postedDate: remoteStatus(transaction.status) === "posted" ? transactionDate : undefined,
    valueDate: transactionDate,
    transactionTime: Number.isNaN(date.valueOf()) ? undefined : date.toISOString(),
    counterparty: transaction.merchantName ?? undefined,
    description: transaction.description,
    bankDescription: transaction.description,
    channel: typeof transaction.metadata.channel === "string" ? transaction.metadata.channel as PaymentChannel : undefined,
    originalCategory: category,
    reference: transaction.reference ?? undefined,
    sourceEnvironment: remoteSource(transaction),
  };
  return accountRecord(accountTransaction, account);
}

export async function getRemoteTransactionExplorerResources(options: RemoteOptions): Promise<ExplorerResources> {
  assertNotAborted(options.signal);
  const [accountResult, cardResult] = await Promise.all([
    apiRequest<AccountsResponse>("/api/v1/accounts/overview", options),
    apiRequest<{ cards: ApiCard[] }>("/api/v1/cards", options),
  ]);
  assertNotAborted(options.signal);
  return {
    accounts: accountResult.accounts.map(apiAccountToBankAccount),
    cards: cardResult.cards.map(apiCardToCardRecord),
  };
}

async function loadRemoteTransactions(input: ActivityQueryInput | undefined, resources: ExplorerResources, options: RemoteOptions): Promise<RawActivity[]> {
  const query = normalizeActivityQuery(remotePeriodInput(input), resources);
  const requestedAccountIds = query.scope.accountIds;
  const requestedCards = resources.cards.filter((card) => query.scope.cardIds.includes(card.id));
  const accountItems: ApiTransaction[] = [];

  if (query.scope.mode !== "cards" && requestedAccountIds.length > 0) {
    let cursor: string | null = null;
    let pageCount = 0;
    do {
      assertNotAborted(options.signal);
      const params = new URLSearchParams({ limit: "50" });
      if (requestedAccountIds.length === 1) params.set("accountId", requestedAccountIds[0]);
      if (query.direction !== "all") params.set("direction", query.direction);
      if (query.search) params.set("search", query.search);
      if (query.fromDate) params.set("from", `${query.fromDate}T00:00:00.000Z`);
      if (query.toDate) params.set("to", `${query.toDate}T23:59:59.999Z`);
      if (cursor) params.set("cursor", cursor);
      const response = await apiRequest<TransactionsResponse>(`/api/v1/transactions?${params.toString()}`, options);
      accountItems.push(...response.items);
      cursor = response.nextCursor;
      pageCount += 1;
    } while (cursor && pageCount < 100);
  }

  const accountRecords = accountItems
    .filter((item) => requestedAccountIds.includes(item.accountId))
    .map((item) => {
      const account = resources.accounts.find((candidate) => candidate.id === item.accountId);
      return account ? remoteRecord(item, account) : undefined;
    })
    .filter((item): item is RawActivity => Boolean(item));

  const cardResults = query.scope.mode === "accounts"
    ? []
    : await Promise.all(requestedCards.map(async (card) => {
        assertNotAborted(options.signal);
        const response = await getRemoteCardTransactions(card.id, options);
        const account = card.linkedAccountId
          ? resources.accounts.find((candidate) => candidate.id === card.linkedAccountId)
          : undefined;
        return response.items.map((item) => {
          const transaction = apiCardTransactionToCardTransaction(item);
          if (item.transactionId) transaction.linkedAccountTransactionId = item.transactionId;
          const record = cardRecord(transaction, card, account);
          if (transaction.linkedAccountTransactionId) {
            record.relatedRecordIds = [`account:${transaction.linkedAccountTransactionId}`, ...record.relatedRecordIds];
          }
          return record;
        });
      }));

  const uniqueRecords = new Map<string, RawActivity>();
  [...accountRecords, ...cardResults.flat()].forEach((record) => {
    if (!uniqueRecords.has(record.id)) uniqueRecords.set(record.id, record);
  });
  const reconciled = reconcileRecords([...uniqueRecords.values()], query);
  const filtered = reconciled.filter((record) => matches(record, query));
  return groupOwnTransfers(filtered, query);
}

type RemoteActivityRow = {id:string;kind:'account'|'card';accountId:string|null;cardId:string|null;amount:string;currency:string;direction:'debit'|'credit';status:string;category:string;merchant:string;description:string;transactionAt:string;sourceEnvironment:string;dataAsOf:string;transactionType?:string;channel?:string;reference?:string|null};
function activityFromRemote(row:RemoteActivityRow,resources:ExplorerResources):RawActivity {
 const date=row.transactionAt.slice(0,10), amount=parseApiMoneyToMinorUnits(row.amount), status=remoteStatus(row.status);
 const account=resources.accounts.find(a=>a.id===row.accountId),card=resources.cards.find(c=>c.id===row.cardId);
 const source:ActivitySourceReference={kind:row.kind==='card'?'card-transaction':'account-transaction',id:row.id,accountId:row.accountId??undefined,cardId:row.cardId??undefined,label:row.description};
 return {id:`${row.kind}:${row.id}`,sourceKind:row.kind==='card'?'card-event':'account-ledger',title:row.merchant||row.description,description:row.description,amountMinorUnits:amount,currency:'INR',direction:row.direction,status,transactionType:(row.transactionType??'other') as ActivityTransactionType,category:remoteCategory(row.category),channel:row.channel as PaymentChannel|undefined,transactionDate:date,transactionTime:row.transactionAt,postedDate:status==='posted'?date:undefined,accountId:row.accountId??undefined,cardId:row.cardId??undefined,accountLabel:account?accountReference(account).label:undefined,cardLabel:card?cardReference(card).label:undefined,sourceEnvironment:row.sourceEnvironment,reference:row.reference??undefined,sourceReferences:[source,...(account?[accountReference(account)]:[]),...(card?[cardReference(card)]:[])],ledgerEntries:row.kind==='account'&&row.accountId?[{id:row.id,accountId:row.accountId,direction:row.direction,amountMinorUnits:amount,status,transactionDate:date}]:[],relatedRecordIds:[]};
}
export async function getRemoteTransactionExplorerPage(input: ActivityQueryInput | undefined, options: RemoteOptions): Promise<ActivityPage> {
 const resources=options.resources??await getRemoteTransactionExplorerResources(options);
 const query=normalizeActivityQuery(remotePeriodInput(input),resources);
 const result=await apiRequest<{items:RemoteActivityRow[];page:number;pageSize:number;totalItems:number;totalPages:number;truncated:boolean;dataAsOf:string|null;period:{from?:string;to:string};summary:{accountCredits:string;accountDebits:string;netAccountMovement:string;cardPostedPurchases:string;cardPostedRefunds:string;includedPostedCount:number;pendingCount:number;failedCount:number}}>('/api/v1/activity/search',{...options,method:'POST',body:{...query,page:input?.page??1,pageSize:input?.pageSize??DEFAULT_PAGE_SIZE}});
 const items=result.items.map(row=>activityFromRemote(row,resources));
 const coverage=buildCoverage(items,query,resources,'Bank API');
 return {items,page:result.page,pageSize:result.pageSize,totalItems:result.totalItems,totalPages:result.totalPages,query,summary:{accountCreditsMinorUnits:parseApiMoneyToMinorUnits(result.summary.accountCredits),accountDebitsMinorUnits:parseApiMoneyToMinorUnits(result.summary.accountDebits),netAccountMovementMinorUnits:parseApiMoneyToMinorUnits(result.summary.netAccountMovement),cardPostedPurchasesMinorUnits:parseApiMoneyToMinorUnits(result.summary.cardPostedPurchases),cardPostedRefundsMinorUnits:parseApiMoneyToMinorUnits(result.summary.cardPostedRefunds),includedPostedCount:result.summary.includedPostedCount,pendingCount:result.summary.pendingCount,failedCount:result.summary.failedCount,scopeLabel:coverage.includedResources.join(', '),coverageLabel:result.truncated?'Partial results; narrow the filters.':'Matching normalized records'},coverage:{...coverage,isPartial:result.truncated,lastSuccessfulUpdate:result.dataAsOf??undefined,availableFrom:result.period.from,availableTo:result.period.to,note:result.truncated?'The result exceeded the analysis limit. Narrow the period.':coverage.note},snapshot:{id:`snapshot-${Date.now()}`,queryKey:queryKey(query),dataRevision:result.dataAsOf??'unknown',generatedAt:new Date().toISOString()}};
}

function activityScope(options: { activityId?: string; transactionId?: string; accountId?: string; cardId?: string }): ActivityQueryInput["scope"] {
  return options.activityId
    ? undefined
    : options.accountId
      ? { mode: "accounts", accountIds: [options.accountId] }
      : options.cardId
        ? { mode: "cards", accountIds: [], cardIds: [options.cardId] }
        : undefined;
}

export async function getRemoteActivityDetail(
  options: { activityId?: string; transactionId?: string; accountId?: string; cardId?: string },
  remoteOptions: RemoteOptions,
): Promise<ActivityRecord | undefined> {
  const resources = await getRemoteTransactionExplorerResources(remoteOptions);
  const id=options.transactionId??options.activityId?.replace(/^(account|card):/,'');
  if(id && options.cardId) {
    const result=await apiRequest<{transaction:ApiCardTransaction}>(`/api/v1/cards/${encodeURIComponent(options.cardId)}/transactions/${encodeURIComponent(id)}`,remoteOptions);
    const card=resources.cards.find(c=>c.id===options.cardId);
    const account=resources.accounts.find(a=>a.id===card?.linkedAccountId);
    return card?cardRecord(apiCardTransactionToCardTransaction(result.transaction),card,account):undefined;
  }
  if(id && !options.cardId && !options.activityId?.startsWith('card:')) {
    const result=await apiRequest<{transaction:ApiTransaction}>(`/api/v1/transactions/${encodeURIComponent(id)}`,remoteOptions);
    const account=resources.accounts.find(a=>a.id===result.transaction.accountId);
    return account?remoteRecord(result.transaction,account):undefined;
  }
  const records = await loadRemoteTransactions({ scope: activityScope(options), pageSize: MAX_PAGE_SIZE }, resources, remoteOptions);
  return records.find((item) => item.id === options.activityId || item.sourceReferences.some((source) => source.id === options.transactionId));
}

export async function createRemoteActivityCsv(input: ActivityQueryInput | undefined, options: RemoteOptions): Promise<ActivityCsv> {
  const resources = await getRemoteTransactionExplorerResources(options);
  const query = normalizeActivityQuery(remotePeriodInput(input), resources);
  const records = await loadRemoteTransactions(input, resources, options);
  records.sort((left, right) => compareRecords(left, right, query.sort));
  return buildActivityCsv(query, resources, records, "Bank API");
}

function queryKey(query: NormalizedActivityQuery): string {
  return JSON.stringify(query);
}

export async function getTransactionExplorerPage(
  input?: ActivityQueryInput,
  options?: { customerId?: string | null; signal?: AbortSignal },
): Promise<ActivityPage> {
  const customerId = customerScope(options?.customerId);
  const resources = await getTransactionExplorerResources({ customerId, signal: options?.signal });
  const query = normalizeActivityQuery(input, resources);
  const allMatching = await loadRecords(customerId, resources, query, options?.signal);
  allMatching.sort((left, right) => compareRecords(left, right, query.sort));
  const requestedPage = Math.max(1, Math.floor(input?.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input?.pageSize ?? DEFAULT_PAGE_SIZE)));
  const totalPages = Math.max(1, Math.ceil(allMatching.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const coverage = buildCoverage(allMatching, query, resources);
  const snapshot: ActivityQuerySnapshot = {
    id: `snapshot-${Date.now().toString(36)}`,
    queryKey: queryKey(query),
    dataRevision: DATA_REVISION,
    generatedAt: new Date().toISOString(),
  };
  return {
    items: allMatching.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: allMatching.length,
    totalPages,
    query,
    summary: calculateSummary(allMatching, query, resources),
    coverage,
    snapshot,
  };
}

export async function getActivityDetail(
  options: { activityId?: string; transactionId?: string; accountId?: string; cardId?: string },
  customerId?: string | null,
): Promise<ActivityRecord | undefined> {
  const scope = activityScope(options);
  const page = await getTransactionExplorerPage({ scope, page: 1, pageSize: MAX_PAGE_SIZE }, { customerId });
  return page.items.find((item) => item.id === options.activityId || item.sourceReferences.some((source) => source.id === options.transactionId));
}

function escapeCsvCell(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
}

function exportPreview(query: NormalizedActivityQuery, summary: ActivitySummary, rowCount: number, resources: ExplorerResources): ActivityExportPreview {
  const periodLabel = query.fromDate || query.toDate ? `${query.fromDate ?? "Start"} to ${query.toDate ?? "End"}` : "All available history";
  const filters = [query.search ? `Search: ${query.search}` : "", query.category !== "all" ? `Category: ${query.category}` : "", query.status !== "all" ? `Status: ${query.status}` : "", query.direction !== "all" ? `Direction: ${query.direction}` : ""].filter(Boolean).join(" · ") || "No additional filters";
  return { scopeLabel: scopeLabel(query, resources), periodLabel, filterLabel: filters, includedStatuses: query.status === "all" ? "Posted, pending, failed, and reversed where supplied" : query.status, format: "CSV", notePolicy: "Personal notes excluded", rowCount };
}

export async function createActivityCsv(input?: ActivityQueryInput, options?: { customerId?: string | null; signal?: AbortSignal }): Promise<ActivityCsv> {
  const customerId = customerScope(options?.customerId);
  const resources = await getTransactionExplorerResources({ customerId, signal: options?.signal });
  const query = normalizeActivityQuery(input, resources);
  const records = await loadRecords(customerId, resources, query, options?.signal);
  records.sort((left, right) => compareRecords(left, right, query.sort));
  return buildActivityCsv(query, resources, records);
}

function buildActivityCsv(
  query: NormalizedActivityQuery,
  resources: ExplorerResources,
  records: RawActivity[],
  fallbackSourceEnvironment?: "Bank API",
): ActivityCsv {
  const summary = calculateSummary(records, query, resources);
  const preview = exportPreview(query, summary, records.length, resources);
  const header = ["Activity ID", "Date", "Description", "Direction", "Amount", "Currency", "Status", "Type", "Category", "Channel", "Account", "Card", "Movement from", "Movement to", "Source records"];
  const rows = records.map((record) => [record.id, record.transactionDate, record.title, record.direction, (record.amountMinorUnits / 100).toFixed(2), record.currency, record.status, record.transactionType, record.category, record.channel ?? "", record.accountLabel ?? "", record.cardLabel ?? "", record.movementFrom ?? "", record.movementTo ?? "", record.sourceReferences.map((source) => source.id).join(" | ")]);
  const sourceEnvironment = sourceEnvironmentFor(records, fallbackSourceEnvironment);
  const sourceLabel = sourceEnvironment.startsWith("Account Aggregator")
    ? "Account Aggregator data — not an official bank statement."
    : sourceEnvironment === "Bank API"
      ? "Bank API transaction summary — not an official bank statement."
      : "Demo transaction summary — not an official bank statement.";
  const csv = [[sourceLabel], [`Scope: ${preview.scopeLabel}`], [`Period: ${preview.periodLabel}`], [`Filters: ${preview.filterLabel}`], ["Notes: Personal notes excluded"], header, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(",")).join("\r\n");
  return { ...preview, filename: "idbi-transaction-activity-summary.csv", csv: `${csv}\r\n` };
}

export async function updateActivityAnnotation(
  activity: ActivityRecord,
  patch: { category?: TransactionCategory; note?: string },
  customerId?: string | null,
): Promise<ActivityRecord | undefined> {
  const accountSource = activity.sourceReferences.find((source) => source.kind === "account-transaction");
  const cardSource = activity.sourceReferences.find((source) => source.kind === "card-transaction");
  if (accountSource?.accountId && accountSource.id) {
    await updateTransactionAnnotation(accountSource.accountId, accountSource.id, patch, { customerId });
  } else if (cardSource?.cardId && cardSource.id) {
    await updateCardTransactionAnnotation(cardSource.cardId, cardSource.id, patch, { customerId });
  } else {
    throw new Error("This grouped movement cannot have a single annotation");
  }
  return getActivityDetail({ activityId: activity.id }, customerId);
}

export function activityTypeLabel(type: ActivityTransactionType): string {
  return type.split("-").map((part) => part[0].toLocaleUpperCase() + part.slice(1)).join(" ");
}

export function activityDirectionLabel(record: ActivityRecord): string {
  if (record.direction === "transfer") return "Between your accounts";
  return record.direction === "credit" ? "Credit" : "Debit";
}

export function formatActivityAmount(record: ActivityRecord): string {
  return formatIndianMinorUnits(record.amountMinorUnits);
}

export function isActivityAbortError(error: unknown): boolean {
  return isAbortError(error);
}
