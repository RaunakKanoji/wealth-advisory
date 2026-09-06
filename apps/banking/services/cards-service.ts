import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
} from "@/data/accounts-demo-data";
import {
  demoCardTransactions,
  getDemoCardTransactions,
  getDemoCards,
} from "@/data/cards-demo-data";
import { getAccount } from "@/services/accounts-service";
import type {
  CardCapabilitySet,
  CardChannel,
  CardChannelGroup,
  CardControl,
  CardControlOperation,
  CardLifecycleStatus,
  CardMasterState,
  CardOperationKind,
  CardRecord,
  CardTransaction,
  CardTransactionFilters,
  CardTransactionPage,
  CardTransactionSummary,
  CardTransactionType,
  CardControlState,
  NormalizedCardTransactionFilters,
} from "@/types/cards";

const DEFAULT_PAGE_SIZE = 6;
const MAX_SEARCH_LENGTH = 80;
const CARD_STATE_KEY_PREFIX = "idbi-card-state";

type StoredCardState = {
  nicknames: Record<string, string>;
  masterStates: Record<string, CardMasterState>;
  channelStates: Record<string, CardControlState>;
  limits: Record<string, number>;
  lifecycleStatuses: Record<string, CardLifecycleStatus>;
  revisions: Record<string, number>;
  operations: CardControlOperation[];
};

const inMemoryState = new Map<string, StoredCardState>();
let operationSequence = 0;

function emptyState(): StoredCardState {
  return {
    nicknames: {},
    masterStates: {},
    channelStates: {},
    limits: {},
    lifecycleStatuses: {},
    revisions: {},
    operations: [],
  };
}

function customerScope(customerId?: string | null): string {
  return customerId || DEMO_CUSTOMER_A;
}

function fixtureCustomerId(customerId?: string | null): string {
  if (customerId === DEMO_CUSTOMER_B || customerId?.includes("customer-b")) {
    return DEMO_CUSTOMER_B;
  }
  return DEMO_CUSTOMER_A;
}

function storageKey(customerId: string): string {
  return `${CARD_STATE_KEY_PREFIX}.${customerId.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function recordOfStrings(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string"),
  ) as Record<string, string>;
}

function recordOfNumbers(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "number" && Number.isFinite(item)),
  ) as Record<string, number>;
}

function parseState(value: string | null): StoredCardState {
  if (!value) return emptyState();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return emptyState();
    const operations = Array.isArray(parsed.operations)
      ? parsed.operations.filter((item): item is CardControlOperation => isRecord(item) && typeof item.id === "string")
      : [];
    return {
      nicknames: recordOfStrings(parsed.nicknames),
      masterStates: recordOfStrings(parsed.masterStates) as Record<string, CardMasterState>,
      channelStates: recordOfStrings(parsed.channelStates) as Record<string, CardControlState>,
      limits: recordOfNumbers(parsed.limits),
      lifecycleStatuses: recordOfStrings(parsed.lifecycleStatuses) as Record<string, CardLifecycleStatus>,
      revisions: recordOfNumbers(parsed.revisions),
      operations,
    };
  } catch {
    return emptyState();
  }
}

async function loadState(customerId?: string | null): Promise<StoredCardState> {
  const scope = customerScope(customerId);
  const existing = inMemoryState.get(scope);
  if (existing) return existing;

  try {
    let storedValue = await SecureStore.getItemAsync(storageKey(scope));
    if (!storedValue && Platform.OS === "web" && typeof localStorage !== "undefined") {
      storedValue = localStorage.getItem(storageKey(scope));
    }
    const state = parseState(storedValue);
    inMemoryState.set(scope, state);
    return state;
  } catch {
    const state = Platform.OS === "web" && typeof localStorage !== "undefined"
      ? parseState(localStorage.getItem(storageKey(scope)))
      : emptyState();
    inMemoryState.set(scope, state);
    return state;
  }
}

async function saveState(customerId: string, state: StoredCardState): Promise<void> {
  inMemoryState.set(customerId, state);
  const serialized = JSON.stringify(state);
  try {
    await SecureStore.setItemAsync(storageKey(customerId), serialized);
  } catch {
    // The in-memory state keeps the current session usable when secure storage is unavailable.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey(customerId), serialized);
    } catch {
      // Browser storage can be disabled; the service remains usable for this session.
    }
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The request was cancelled", "AbortError");
  }
}

function channelStateKey(cardId: string, group: CardChannelGroup, channel: CardChannel): string {
  return `${cardId}:${group}:${channel}`;
}

function limitStateKey(cardId: string, limitId: string): string {
  return `${cardId}:${limitId}`;
}

function applyStoredState(card: CardRecord, state: StoredCardState): CardRecord {
  const hydratedControls = card.controls.map((control) => ({
    ...control,
    state: state.channelStates[channelStateKey(card.id, control.group, control.channel)] ?? control.state,
  }));
  const hydratedLimits = card.limits.map((limit) => ({
    ...limit,
    amountMinorUnits: state.limits[limitStateKey(card.id, limit.id)] ?? limit.amountMinorUnits,
  }));

  return {
    ...card,
    nickname: state.nicknames[card.id] || undefined,
    lifecycleStatus: state.lifecycleStatuses[card.id] ?? card.lifecycleStatus,
    sourceRevision: state.revisions[card.id] ?? card.sourceRevision,
    controls: hydratedControls,
    limits: hydratedLimits,
  };
}

function getBaseCard(cardId: string, customerId?: string | null): CardRecord | undefined {
  return getDemoCards(fixtureCustomerId(customerId)).find((item) => item.id === cardId);
}

async function requireCard(cardId: string, customerId?: string | null): Promise<{ card: CardRecord; state: StoredCardState; customerId: string }> {
  const scopedCustomerId = customerScope(customerId);
  const baseCard = getBaseCard(cardId, scopedCustomerId);
  if (!baseCard) {
    throw new Error("Card unavailable or you do not have access to it");
  }
  const state = await loadState(scopedCustomerId);
  return { card: applyStoredState(baseCard, state), state, customerId: scopedCustomerId };
}

export async function getCards(options?: { customerId?: string | null; signal?: AbortSignal; accountId?: string }): Promise<CardRecord[]> {
  assertNotAborted(options?.signal);
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const cards = getDemoCards(fixtureCustomerId(customerId))
    .filter((card) => !options?.accountId || card.linkedAccountId === options.accountId)
    .map((card) => applyStoredState(card, state));
  assertNotAborted(options?.signal);
  return cards;
}

export async function getCard(
  cardId: string,
  options?: { customerId?: string | null; signal?: AbortSignal },
): Promise<CardRecord | undefined> {
  if (!cardId.trim()) return undefined;
  try {
    const result = await requireCard(cardId, options?.customerId);
    assertNotAborted(options?.signal);
    return result.card;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Card unavailable")) return undefined;
    throw error;
  }
}

export async function getCardFundingSummary(
  cardId: string,
  options?: { customerId?: string | null; signal?: AbortSignal },
) {
  const card = await getCard(cardId, options);
  if (!card) throw new Error("Card unavailable");

  if (card.productKind === "debit" && card.linkedAccountId) {
    const account = await getAccount(card.linkedAccountId, {
      customerId: options?.customerId,
      signal: options?.signal,
    });
    if (!account) throw new Error("Linked payment account unavailable");
    return { type: "debit" as const, account };
  }

  if (card.productKind === "credit" && card.creditFacility) {
    return { type: "credit" as const, facility: card.creditFacility };
  }

  return { type: "unavailable" as const };
}

export function normalizeCardTransactionFilters(input?: CardTransactionFilters): NormalizedCardTransactionFilters {
  const search = (input?.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH).toLocaleLowerCase();
  const period = input?.period === "this-month" || input?.period === "last-month" ? input.period : "all";
  return {
    search,
    period,
    status: input?.status ?? "all",
    transactionType: input?.transactionType ?? "all",
    category: input?.category ?? "all",
  };
}

function sortTransactions(items: CardTransaction[]): CardTransaction[] {
  return [...items].sort((left, right) => {
    const dateCompare = right.transactionDate.localeCompare(left.transactionDate);
    if (dateCompare !== 0) return dateCompare;
    return (right.transactionTime ?? "").localeCompare(left.transactionTime ?? "");
  });
}

function canonicalizeTransactions(items: CardTransaction[]): CardTransaction[] {
  const groups = new Map<string, CardTransaction[]>();
  for (const item of items) {
    const key = item.associationKey ?? item.sourceTransactionId;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.values()].map((group) => {
    const settled = group.find(
      (item) => item.status === "posted" && item.transactionType !== "authorisation",
    );
    return settled ?? sortTransactions(group)[0];
  });
}

function transactionMatches(
  transaction: CardTransaction,
  filters: NormalizedCardTransactionFilters,
): boolean {
  const haystack = [
    transaction.merchant,
    transaction.description,
    transaction.reference,
    transaction.sourceTransactionId,
  ].filter(Boolean).join(" ").toLocaleLowerCase();

  if (filters.search && !haystack.includes(filters.search)) return false;
  if (filters.period === "this-month" && !transaction.transactionDate.startsWith("2026-09")) return false;
  if (filters.period === "last-month" && !transaction.transactionDate.startsWith("2026-08")) return false;
  if (filters.status !== "all" && transaction.status !== filters.status) return false;
  if (filters.transactionType !== "all" && transaction.transactionType !== filters.transactionType) return false;
  if (filters.category !== "all" && transaction.category !== filters.category) return false;
  return true;
}

function calculateCardSummary(items: CardTransaction[], filters: NormalizedCardTransactionFilters): CardTransactionSummary {
  const posted = items.filter((item) => item.status === "posted" || item.status === "reversed");
  const totalOf = (type: CardTransactionType) => posted
    .filter((item) => item.transactionType === type)
    .reduce((total, item) => total + item.amountMinorUnits, 0);
  return {
    postedPurchasesMinorUnits: totalOf("purchase"),
    postedCashWithdrawalsMinorUnits: totalOf("cash-withdrawal"),
    postedFeesMinorUnits: totalOf("fee"),
    postedRefundsMinorUnits: totalOf("refund"),
    includedPurchaseCount: posted.filter((item) => item.transactionType === "purchase").length,
    scopeLabel: filters.period === "this-month"
      ? "This month · posted purchases only"
      : filters.period === "last-month"
        ? "Last month · posted purchases only"
        : "All available demo history · posted purchases only",
    coverageLabel: "Pending, declined, repayments, cash withdrawals, fees, and refunds are kept separate",
  };
}

export async function getCardTransactions(
  cardId: string,
  options?: {
    customerId?: string | null;
    signal?: AbortSignal;
    filters?: CardTransactionFilters;
    page?: number;
    pageSize?: number;
  },
): Promise<CardTransactionPage> {
  const { customerId } = await requireCard(cardId, options?.customerId);
  const filters = normalizeCardTransactionFilters(options?.filters);
  const all = canonicalizeTransactions(
    getDemoCardTransactions(fixtureCustomerId(customerId)).filter((item) => item.cardId === cardId),
  );
  const matching = sortTransactions(all.filter((item) => transactionMatches(item, filters)));
  const pageSize = Math.min(20, Math.max(1, Math.floor(options?.pageSize ?? DEFAULT_PAGE_SIZE)));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(options?.page ?? 1)));
  const start = (page - 1) * pageSize;
  assertNotAborted(options?.signal);
  return {
    items: matching.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: matching.length,
    totalPages,
    filters,
    summary: calculateCardSummary(matching, filters),
  };
}

export async function getCardTransaction(
  cardId: string,
  transactionId: string,
  options?: { customerId?: string | null },
): Promise<CardTransaction | undefined> {
  await requireCard(cardId, options?.customerId);
  return canonicalizeTransactions(
    getDemoCardTransactions(fixtureCustomerId(options?.customerId)).filter((item) => item.cardId === cardId),
  ).find((item) => item.id === transactionId);
}

export async function updateCardNickname(
  cardId: string,
  nickname: string,
  options?: { customerId?: string | null },
): Promise<CardRecord> {
  const result = await requireCard(cardId, options?.customerId);
  const trimmed = nickname.trim();
  if (trimmed.length > 40) throw new Error("Card nickname must be 40 characters or fewer");
  result.state.nicknames[cardId] = trimmed;
  await saveState(result.customerId, result.state);
  return applyStoredState(getBaseCard(cardId, result.customerId)!, result.state);
}

function ensureActiveForControl(card: CardRecord): void {
  if (card.lifecycleStatus !== "active" && card.lifecycleStatus !== "temporarily-disabled") {
    throw new Error("This card is not eligible for customer controls");
  }
}

function ensureRevision(card: CardRecord, expectedRevision?: number): void {
  if (expectedRevision !== undefined && expectedRevision !== card.sourceRevision) {
    throw new Error("Card settings changed elsewhere. Refresh and review the latest values.");
  }
}

function operationFingerprint(kind: CardOperationKind, requestedChange: string): string {
  return JSON.stringify({ kind, requestedChange });
}

function findIdempotentOperation(
  state: StoredCardState,
  customerId: string,
  cardId: string,
  idempotencyKey: string,
  kind: CardOperationKind,
  requestedChange: string,
): CardControlOperation | undefined {
  const existing = state.operations.find(
    (item) => item.customerId === customerId && item.cardId === cardId && item.idempotencyKey === idempotencyKey,
  );
  if (!existing) return undefined;
  if (operationFingerprint(existing.kind, existing.requestedChange) !== operationFingerprint(kind, requestedChange)) {
    throw new Error("This idempotency key was already used for a different card change");
  }
  return existing;
}

function operationStatus(outcome: CardRecord["demoControlOutcome"]): CardControlOperation["status"] {
  return outcome === "applied" ? "confirmed" : outcome === "rejected" ? "failed" : outcome;
}

function applyOperationState(
  state: StoredCardState,
  card: CardRecord,
  kind: CardOperationKind,
  requestedChange: string,
): void {
  const change: unknown = JSON.parse(requestedChange);
  if (!change || typeof change !== "object") throw new Error("Invalid card change");
  const record = change as Record<string, unknown>;

  if (kind === "master-state" && (record.state === "on" || record.state === "off")) {
    state.masterStates[card.id] = record.state;
    state.lifecycleStatuses[card.id] = record.state === "off" ? "temporarily-disabled" : "active";
  } else if (kind === "channel-state" && typeof record.group === "string" && typeof record.channel === "string" && (record.state === "enabled" || record.state === "disabled")) {
    state.channelStates[channelStateKey(card.id, record.group as CardChannelGroup, record.channel as CardChannel)] = record.state;
  } else if (kind === "limit" && typeof record.limitId === "string" && typeof record.amountMinorUnits === "number") {
    state.limits[limitStateKey(card.id, record.limitId)] = record.amountMinorUnits;
  } else if (kind === "hotlist") {
    state.lifecycleStatuses[card.id] = "blocked";
    state.masterStates[card.id] = "off";
  } else {
    throw new Error("Unsupported card change");
  }
  state.revisions[card.id] = card.sourceRevision + 1;
}

async function createOperation(
  card: CardRecord,
  state: StoredCardState,
  customerId: string,
  kind: CardOperationKind,
  requestedChange: string,
  beforeState: string,
  idempotencyKey: string,
): Promise<CardControlOperation> {
  if (!idempotencyKey.trim()) throw new Error("An idempotency key is required");
  const existing = findIdempotentOperation(state, customerId, card.id, idempotencyKey, kind, requestedChange);
  if (existing) return existing;

  const now = new Date().toISOString();
  const status = operationStatus(card.demoControlOutcome);
  const operation: CardControlOperation = {
    id: `${card.id}-operation-${Date.now()}-${operationSequence++}`,
    idempotencyKey,
    customerId,
    cardId: card.id,
    kind,
    requestedChange,
    beforeState,
    status,
    providerReference: card.providerReference,
    createdAt: now,
    updatedAt: now,
    sourceEnvironment: "Demo data",
  };

  if (status === "confirmed") {
    applyOperationState(state, card, kind, requestedChange);
  }
  state.operations = [...state.operations, operation];
  await saveState(customerId, state);
  return operation;
}

export async function updateCardMasterState(
  cardId: string,
  nextState: CardMasterState,
  options: { customerId?: string | null; idempotencyKey: string; expectedRevision?: number },
): Promise<CardControlOperation> {
  const result = await requireCard(cardId, options.customerId);
  const requestedChange = JSON.stringify({ state: nextState });
  const existing = findIdempotentOperation(
    result.state,
    result.customerId,
    result.card.id,
    options.idempotencyKey,
    "master-state",
    requestedChange,
  );
  if (existing) return existing;
  ensureActiveForControl(result.card);
  const allowed = nextState === "off"
    ? result.card.capabilities.canTemporarilyDisable
    : result.card.capabilities.canReenable;
  if (!allowed) throw new Error("This card does not support that control");
  ensureRevision(result.card, options.expectedRevision);
  const beforeState = result.card.lifecycleStatus;
  return createOperation(
    result.card,
    result.state,
    result.customerId,
    "master-state",
    requestedChange,
    beforeState,
    options.idempotencyKey,
  );
}

function findControl(card: CardRecord, group: CardChannelGroup, channel: CardChannel): CardControl {
  const control = card.controls.find((item) => item.group === group && item.channel === channel);
  if (!control || !control.supported) throw new Error(control?.unavailableReason ?? "This channel is unavailable");
  return control;
}

function capabilitiesForGroup(card: CardRecord, group: CardChannelGroup): keyof CardCapabilitySet {
  return group === "domestic" ? "canManageDomesticUsage" : "canManageInternationalUsage";
}

export async function updateCardChannelState(
  cardId: string,
  group: CardChannelGroup,
  channel: CardChannel,
  nextState: CardControlState,
  options: { customerId?: string | null; idempotencyKey: string; expectedRevision?: number },
): Promise<CardControlOperation> {
  const result = await requireCard(cardId, options.customerId);
  const requestedChange = JSON.stringify({ group, channel, state: nextState });
  const existing = findIdempotentOperation(
    result.state,
    result.customerId,
    result.card.id,
    options.idempotencyKey,
    "channel-state",
    requestedChange,
  );
  if (existing) return existing;
  ensureActiveForControl(result.card);
  findControl(result.card, group, channel);
  if (!result.card.capabilities[capabilitiesForGroup(result.card, group)]) {
    throw new Error("This card does not support controls for this region");
  }
  ensureRevision(result.card, options.expectedRevision);
  const current = result.card.controls.find((item) => item.group === group && item.channel === channel)?.state ?? "disabled";
  return createOperation(
    result.card,
    result.state,
    result.customerId,
    "channel-state",
    requestedChange,
    current,
    options.idempotencyKey,
  );
}

export async function updateCardLimit(
  cardId: string,
  limitId: string,
  amountMinorUnits: number,
  options: { customerId?: string | null; idempotencyKey: string; expectedRevision?: number },
): Promise<CardControlOperation> {
  const result = await requireCard(cardId, options.customerId);
  const requestedChange = JSON.stringify({ limitId, amountMinorUnits });
  const existing = findIdempotentOperation(
    result.state,
    result.customerId,
    result.card.id,
    options.idempotencyKey,
    "limit",
    requestedChange,
  );
  if (existing) return existing;
  ensureActiveForControl(result.card);
  if (!result.card.capabilities.canManageLimits) throw new Error("Limit management is unavailable for this card");
  const targetLimit = result.card.limits.find((item) => item.id === limitId);
  if (!targetLimit) throw new Error("This limit is unavailable");
  if (!Number.isInteger(amountMinorUnits) || amountMinorUnits < 0) throw new Error("Enter a valid non-negative limit");
  if (amountMinorUnits > targetLimit.maximumMinorUnits) throw new Error("The proposed limit exceeds the issuer-permitted maximum");
  ensureRevision(result.card, options.expectedRevision);
  const current = targetLimit.amountMinorUnits;
  return createOperation(
    result.card,
    result.state,
    result.customerId,
    "limit",
    requestedChange,
    String(current),
    options.idempotencyKey,
  );
}

export async function reportCardLostOrStolen(
  cardId: string,
  reason: "lost" | "stolen",
  options: { customerId?: string | null; idempotencyKey: string; expectedRevision?: number },
): Promise<CardControlOperation> {
  const result = await requireCard(cardId, options.customerId);
  const requestedChange = JSON.stringify({ reason });
  const existing = findIdempotentOperation(
    result.state,
    result.customerId,
    result.card.id,
    options.idempotencyKey,
    "hotlist",
    requestedChange,
  );
  if (existing) return existing;
  if (!result.card.capabilities.canHotlist) throw new Error("Permanent blocking is unavailable for this card");
  if (result.card.lifecycleStatus === "blocked") throw new Error("This card is already permanently blocked");
  ensureRevision(result.card, options.expectedRevision);
  return createOperation(
    result.card,
    result.state,
    result.customerId,
    "hotlist",
    requestedChange,
    result.card.lifecycleStatus,
    options.idempotencyKey,
  );
}

export async function getCardOperation(
  operationId: string,
  options?: { customerId?: string | null },
): Promise<CardControlOperation | undefined> {
  const state = await loadState(customerScope(options?.customerId));
  return state.operations.find((item) => item.id === operationId && item.customerId === customerScope(options?.customerId));
}

export async function checkCardOperationStatus(
  operationId: string,
  options?: { customerId?: string | null },
): Promise<CardControlOperation> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const operation = state.operations.find((item) => item.id === operationId && item.customerId === customerId);
  if (!operation) throw new Error("Card operation unavailable");
  if (operation.status !== "pending") return operation;

  const card = await getCard(operation.cardId, { customerId });
  if (!card) throw new Error("Card unavailable");
  // Pending demo operations become confirmed only after an explicit status check.
  applyOperationState(state, card, operation.kind, operation.requestedChange);
  const updated = { ...operation, status: "confirmed" as const, updatedAt: new Date().toISOString() };
  state.operations = state.operations.map((item) => item.id === operation.id ? updated : item);
  await saveState(customerId, state);
  return updated;
}

export function getCardControlDescription(group: CardChannelGroup, channel: CardChannel): string {
  const label = channel === "atm" ? "ATM withdrawals" : channel === "in-store" ? "In-store purchases" : channel === "online" ? "Online purchases" : "Contactless payments";
  return `${label} · ${group === "domestic" ? "within India" : "outside India"}`;
}

export function formatLimitInput(amountMinorUnits: number): string {
  return (amountMinorUnits / 100).toFixed(2);
}

export function parseLimitInput(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter an amount with up to two decimal places");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Enter a smaller amount");
  return amount;
}

export async function clearCardServiceState(): Promise<void> {
  inMemoryState.clear();
}

export const __cardServiceTestData = {
  demoCardTransactions,
  getDemoCards,
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
};
