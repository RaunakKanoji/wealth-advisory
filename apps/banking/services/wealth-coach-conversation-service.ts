import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
  DEMO_SCENARIO_DATE,
} from "@/data/accounts-demo-data";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";
import {
  getAccountTransactions,
  getAccounts,
} from "@/services/accounts-service";
import {
  getCardTransactions,
  getCards,
} from "@/services/cards-service";
import { formatINR, formatIndianMinorUnits } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import type { AccountTransaction, TransactionCategory, TransactionStatus } from "@/types/banking";
import type { CardTransaction } from "@/types/cards";
import type { FinancialGoal } from "@/types/wealth-coach";
import type {
  CoachAnswer,
  CoachAnswerBlock,
  CoachConsentStatus,
  CoachConversation,
  CoachConversationContext,
  CoachMessage,
  CoachModelStatus,
  CoachPeriod,
  CoachRun,
  CoachScope,
  CoachScopeKind,
  CoachSourceReference,
  GoalScenario,
  GoalScenarioOption,
  SavedCoachGoal,
  SavedCoachReport,
} from "@/types/wealth-coach-conversation";

const STORAGE_PREFIX = "idbi-wealth-coach.v1";
const STORAGE_CHUNK_SIZE = 1700;
const DEMO_DATA_AS_OF = DEMO_SCENARIO_DATE;
const CALCULATION_VERSION = "coach-calculation.v1";
const MODEL_STATUS: CoachModelStatus = "test-adapter";
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_CONVERSATIONS = 40;

type StoredCoachState = {
  consent: CoachConsentStatus;
  conversations: CoachConversation[];
  goals: SavedCoachGoal[];
  reports: SavedCoachReport[];
};

type CoachScopeInput = {
  kind?: CoachScopeKind;
  accountId?: string;
  cardId?: string;
  goalId?: string;
};

export type CoachConversationContextInput = {
  periodId?: CoachPeriod["id"];
  period?: CoachPeriod;
  category?: TransactionCategory;
  selectedTransactionId?: string;
};

type RunStateCallback = (state: CoachMessage["status"]) => void;
type RunCreatedCallback = (runId: string) => void;

type SubmitCoachMessageOptions = {
  customerId?: string | null;
  conversationId: string;
  text: string;
  signal?: AbortSignal;
  onStateChange?: RunStateCallback;
  onRunCreated?: RunCreatedCallback;
};

type CoachMessageResult = {
  conversation: CoachConversation;
  userMessageId: string;
  assistantMessageId?: string;
  answer?: CoachAnswer;
  consentRequired?: boolean;
  run?: CoachRun;
};

type ScopeData = {
  scope: CoachScope;
  accounts: Awaited<ReturnType<typeof getAccounts>>;
  cards: Awaited<ReturnType<typeof getCards>>;
  goal?: FinancialGoal;
};

type UnifiedTransaction = {
  id: string;
  sourceTransactionId: string;
  accountId?: string;
  cardId?: string;
  amountMinorUnits: number;
  direction: "credit" | "debit";
  status: TransactionStatus;
  transactionDate: string;
  description: string;
  counterparty?: string;
  category?: TransactionCategory;
  transactionType?: CardTransaction["transactionType"];
  sourceEnvironment: string;
};

type SpendingTotals = {
  amountMinorUnits: number;
  count: number;
  pendingMinorUnits: number;
  failedMinorUnits: number;
  transactions: UnifiedTransaction[];
};

type CashFlowTotals = {
  inflowMinorUnits: number;
  outflowMinorUnits: number;
  netMinorUnits: number;
  savingsRate?: number;
  postedTransactions: UnifiedTransaction[];
  pendingCount: number;
  failedCount: number;
};

type CoachIntent =
  | "affordability"
  | "comparison"
  | "transactions"
  | "breakdown"
  | "goal"
  | "goal-progress"
  | "recurring"
  | "savings"
  | "education"
  | "overview";

type AnalysisResult = {
  explanation: string;
  blocks: CoachAnswerBlock[];
  sourceReferences: CoachSourceReference[];
  contextPatch: Partial<CoachConversationContext>;
  assumptions: string[];
  limitations: string[];
  suggestedFollowUps: string[];
};

const inMemoryState = new Map<string, StoredCoachState>();
const stateWriteQueues = new Map<string, Promise<void>>();
const activeControllers = new Map<string, AbortController>();
const liveRunIds = new Set<string>();
const ACTIVE_RUN_STATUSES = new Set<CoachMessage["status"]>(["queued", "retrieving", "calculating", "preparing"]);
let sequence = 0;

function customerScope(customerId?: string | null): string {
  return customerId?.trim() || DEMO_CUSTOMER_A;
}

function fixtureCustomerId(customerId?: string | null): string {
  return customerId === DEMO_CUSTOMER_B || customerId?.includes("customer-b")
    ? DEMO_CUSTOMER_B
    : DEMO_CUSTOMER_A;
}

function storageKey(customerId: string, suffix: string): string {
  const safeCustomerId = customerScope(customerId).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${STORAGE_PREFIX}.${safeCustomerId}.${suffix}`;
}

function emptyState(): StoredCoachState {
  return { consent: "not-requested", conversations: [], goals: [], reports: [] };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function now(): string {
  return new Date().toISOString();
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("The request was cancelled");
    error.name = "AbortError";
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

class ConversationRemovedDuringRunError extends Error {
  constructor() {
    super("Conversation unavailable or you do not have access to it");
    this.name = "ConversationRemovedDuringRunError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseState(value: string | null): StoredCoachState {
  if (!value) return emptyState();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return emptyState();
    return {
      consent: parsed.consent === "granted" || parsed.consent === "declined" ? parsed.consent : "not-requested",
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations as CoachConversation[] : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals as SavedCoachGoal[] : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports as SavedCoachReport[] : [],
    };
  } catch {
    return emptyState();
  }
}

function recoverInterruptedRuns(state: StoredCoachState): boolean {
  let changed = false;
  for (const conversation of state.conversations) {
    for (const run of conversation.runs) {
      if (!ACTIVE_RUN_STATUSES.has(run.status) || liveRunIds.has(run.id) || activeControllers.has(run.id)) continue;
      const timestamp = now();
      const errorMessage = "The previous Coach response was interrupted. Retry the question to continue.";
      run.status = "failed";
      run.updatedAt = timestamp;
      const userMessage = conversation.messages.find((message) => message.id === run.userMessageId && message.role === "user");
      if (userMessage) {
        userMessage.status = "failed";
        userMessage.errorMessage = errorMessage;
      }
      const existingAssistant = run.assistantMessageId
        ? conversation.messages.find((message) => message.id === run.assistantMessageId && message.role === "assistant")
        : undefined;
      if (existingAssistant) {
        existingAssistant.status = "failed";
        existingAssistant.errorMessage = errorMessage;
        existingAssistant.content = errorMessage;
      } else if (userMessage) {
        const assistantMessage: CoachMessage = {
          id: createId("message"),
          role: "assistant",
          content: errorMessage,
          createdAt: timestamp,
          runId: run.id,
          status: "failed",
          errorMessage,
        };
        run.assistantMessageId = assistantMessage.id;
        conversation.messages.push(assistantMessage);
      }
      conversation.updatedAt = timestamp;
      changed = true;
    }
  }
  return changed;
}

async function readPersistedValue(customerId: string): Promise<string | null> {
  const manifestKey = storageKey(customerId, "manifest");
  try {
    const manifest = await SecureStore.getItemAsync(manifestKey);
    if (manifest) {
      const count = Number.parseInt(manifest, 10);
      if (Number.isFinite(count) && count > 0 && count < 200) {
        const chunks = await Promise.all(
          Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(storageKey(customerId, `chunk.${index}`))),
        );
        if (chunks.every(Boolean)) return chunks.join("");
      }
    }
  } catch {
    // Fall through to the browser adapter or an empty session.
  }

  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(storageKey(customerId, "document"));
    } catch {
      return null;
    }
  }
  return null;
}

async function persistState(customerId: string, state: StoredCoachState): Promise<void> {
  const scopedCustomerId = customerScope(customerId);
  const serialized = JSON.stringify(state);
  inMemoryState.set(scopedCustomerId, clone(state));

  const previousWrite = stateWriteQueues.get(scopedCustomerId) ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(async () => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(storageKey(scopedCustomerId, "document"), serialized);
      } catch {
        // Browser storage can be disabled. The in-memory state remains available.
      }
    }

    const chunks = serialized.match(new RegExp(`.{1,${STORAGE_CHUNK_SIZE}}`, "gs")) ?? [""];
    try {
      const oldManifest = await SecureStore.getItemAsync(storageKey(scopedCustomerId, "manifest"));
      const oldCount = Number.parseInt(oldManifest ?? "0", 10);
      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(storageKey(scopedCustomerId, `chunk.${index}`), chunk)),
      );
      for (let index = chunks.length; index < oldCount; index += 1) {
        await SecureStore.deleteItemAsync(storageKey(scopedCustomerId, `chunk.${index}`));
      }
      await SecureStore.setItemAsync(storageKey(scopedCustomerId, "manifest"), String(chunks.length));
    } catch {
      // A production deployment should replace this client adapter with the
      // authenticated conversation API. Do not block the current session when
      // secure storage is unavailable.
    }
  });
  stateWriteQueues.set(scopedCustomerId, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (stateWriteQueues.get(scopedCustomerId) === nextWrite) stateWriteQueues.delete(scopedCustomerId);
  }
}

async function loadState(customerId?: string | null): Promise<StoredCoachState> {
  const scopedCustomerId = customerScope(customerId);
  const existing = inMemoryState.get(scopedCustomerId);
  const state = existing ? clone(existing) : parseState(await readPersistedValue(scopedCustomerId));
  if (recoverInterruptedRuns(state)) {
    await persistState(scopedCustomerId, state);
  } else if (!existing) {
    inMemoryState.set(scopedCustomerId, clone(state));
  }
  return clone(state);
}

async function persistRunConversation(customerId: string, conversation: CoachConversation): Promise<boolean> {
  const scopedCustomerId = customerScope(customerId);
  await loadState(scopedCustomerId);

  // Re-read the in-memory document after the async load. Another action may
  // have renamed or deleted the conversation while this run was calculating.
  const currentState = inMemoryState.get(scopedCustomerId);
  const currentIndex = currentState?.conversations.findIndex((item) => item.id === conversation.id) ?? -1;
  if (!currentState || currentIndex < 0) return false;

  const nextState = clone(currentState);
  const currentConversation = nextState.conversations[currentIndex];
  const nextConversation = clone(conversation);
  nextConversation.title = currentConversation.title;
  nextState.conversations[currentIndex] = nextConversation;
  await persistState(scopedCustomerId, nextState);

  // A delete can be queued while the storage write above is in progress. Do
  // not report or persist a successful run for a conversation that is gone.
  const committedConversation = inMemoryState.get(scopedCustomerId)?.conversations
    .find((item) => item.id === conversation.id);
  if (!committedConversation) return false;
  conversation.title = committedConversation.title;
  return true;
}

function maskLastFour(lastFour: string): string {
  return `•••• ${lastFour}`;
}

function scopeLabel(kind: CoachScopeKind, accountLabels: string[], cardLabels: string[], goalName?: string): string {
  if (kind === "account") return accountLabels[0] ?? "Selected account";
  if (kind === "card") return cardLabels[0] ?? "Selected card spending";
  if (kind === "goal") return goalName ? `${goalName} goal` : "Selected goal";
  return "Selected personal accounts";
}

function goalScenarioFromFinancialGoal(goal: FinancialGoal): GoalScenario {
  const targetMinorUnits = Math.max(0, Math.round(goal.targetAmount * 100));
  const allocatedMinorUnits = Math.max(0, Math.round(goal.currentAmount * 100));
  return {
    name: goal.name,
    targetMinorUnits,
    allocatedMinorUnits,
    remainingMinorUnits: Math.max(0, targetMinorUnits - allocatedMinorUnits),
    targetDate: goal.targetDate,
  };
}

function goalProgressPercentage(scenario: GoalScenario): number {
  if (scenario.targetMinorUnits <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((scenario.allocatedMinorUnits / scenario.targetMinorUnits) * 100)));
}

export async function resolveCoachScope(
  customerId: string | null | undefined,
  input?: CoachScopeInput,
): Promise<ScopeData> {
  const scopedCustomerId = customerScope(customerId);
  const accounts = await getAccounts({ customerId: scopedCustomerId });
  const cards = await getCards({ customerId: scopedCustomerId });
  const kind = input?.kind ?? (input?.accountId ? "account" : input?.cardId ? "card" : "personal");

  if (kind === "account") {
    const account = input?.accountId ? accounts.find((item) => item.id === input.accountId) : undefined;
    if (!account) throw new Error("Account unavailable or you do not have access to it");
    return {
      accounts,
      cards,
      scope: {
        kind,
        accountIds: [account.id],
        cardIds: cards.filter((card) => card.linkedAccountId === account.id).map((card) => card.id),
        label: scopeLabel(kind, [`${account.name} ${maskLastFour(account.lastFour)}`], [], undefined),
      },
    };
  }

  if (kind === "card") {
    const card = input?.cardId ? cards.find((item) => item.id === input.cardId) : undefined;
    if (!card) throw new Error("Card unavailable or you do not have access to it");
    return {
      accounts,
      cards,
      scope: {
        kind,
        accountIds: card.linkedAccountId ? [card.linkedAccountId] : [],
        cardIds: [card.id],
        label: scopeLabel(kind, [], [`${card.productName} ${maskLastFour(card.lastFour)}`], undefined),
      },
    };
  }

  if (kind === "goal") {
    if (fixtureCustomerId(scopedCustomerId) === DEMO_CUSTOMER_B) {
      throw new Error("Goal unavailable or you do not have access to it");
    }
    const dashboard = await getWealthCoachDashboard({ customerId: scopedCustomerId });
    const goal = dashboard.goals.find((item) => item.id === input?.goalId);
    if (!goal) throw new Error("Goal unavailable or you do not have access to it");
    return {
      accounts,
      cards,
      goal,
      scope: {
        kind,
        accountIds: accounts.map((account) => account.id),
        cardIds: cards.map((card) => card.id),
        goalId: goal.id,
        label: scopeLabel(kind, [], [], goal.name),
      },
    };
  }

  return {
    accounts,
    cards,
    scope: {
      kind: "personal",
      accountIds: accounts.map((account) => account.id),
      cardIds: cards.map((card) => card.id),
      label: scopeLabel("personal", [], [], undefined),
    },
  };
}

export async function getCoachConsent(customerId?: string | null): Promise<CoachConsentStatus> {
  return (await loadState(customerId)).consent;
}

export async function setCoachConsent(
  customerId: string | null | undefined,
  status: Exclude<CoachConsentStatus, "not-requested">,
): Promise<CoachConsentStatus> {
  const scopedCustomerId = customerScope(customerId);
  const state = await loadState(scopedCustomerId);
  state.consent = status;
  await persistState(scopedCustomerId, state);
  return status;
}

export async function recordCoachConsentDeclined(
  conversationId: string,
  userMessageId: string,
  customerId?: string | null,
): Promise<CoachConversation> {
  const scopedCustomerId = customerScope(customerId);
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, conversationId);
  const userMessage = conversation.messages.find((message) => message.id === userMessageId && message.role === "user");
  if (!userMessage) throw new Error("The question is unavailable");
  const run = [...conversation.runs]
    .reverse()
    .find((candidate) => candidate.userMessageId === userMessageId && !candidate.assistantMessageId);
  if (!run) return clone(conversation);

  const assistantMessage: CoachMessage = {
    id: createId("message"),
    role: "assistant",
    content: "I won’t access your personal financial data. You can still ask a general financial question, or review Coach personalisation when you want a data-based answer.",
    createdAt: now(),
    runId: run.id,
    status: "completed",
  };
  run.assistantMessageId = assistantMessage.id;
  run.updatedAt = now();
  conversation.messages.push(assistantMessage);
  conversation.updatedAt = now();
  await persistState(scopedCustomerId, state);
  return clone(conversation);
}

export async function listCoachConversations(customerId?: string | null): Promise<CoachConversation[]> {
  const state = await loadState(customerId);
  const conversationsWithTitles = state.conversations.map((conversation) => {
    if (conversation.title !== "New conversation") return conversation;
    const firstUserMessage = conversation.messages.find((message) => message.role === "user" && message.content.trim().length > 0);
    return firstUserMessage ? { ...conversation, title: createConversationTitle(firstUserMessage.content) } : conversation;
  });
  if (conversationsWithTitles.some((conversation, index) => conversation.title !== state.conversations[index]?.title)) {
    state.conversations = conversationsWithTitles;
    await persistState(customerScope(customerId), state);
  }
  return clone(conversationsWithTitles)
    .filter(hasMeaningfulConversation)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getCoachConversation(
  conversationId: string,
  customerId?: string | null,
): Promise<CoachConversation | undefined> {
  const state = await loadState(customerId);
  const conversation = state.conversations.find((item) => item.id === conversationId);
  return conversation ? clone(conversation) : undefined;
}

export async function createCoachConversation(
  customerId: string | null | undefined,
  input?: CoachScopeInput,
  contextInput?: CoachConversationContextInput,
): Promise<CoachConversation> {
  const scopedCustomerId = customerScope(customerId);
  const data = await resolveCoachScope(scopedCustomerId, input);
  const timestamp = now();
  const conversation: CoachConversation = {
    id: createId("conversation"),
    environment: "demo",
    title: "New conversation",
    createdAt: timestamp,
    updatedAt: timestamp,
    context: {
      scope: data.scope,
      period: contextInput?.period
        ? validatedContextPeriod(contextInput.period)
        : contextInput?.periodId
          ? periodFor(contextInput.periodId)
          : undefined,
      category: contextInput?.category,
      selectedTransactionId: contextInput?.selectedTransactionId?.trim().slice(0, 200) || undefined,
      selectedGoalId: data.goal?.id,
      goalScenario: data.goal ? goalScenarioFromFinancialGoal(data.goal) : undefined,
    },
    messages: [],
    runs: [],
  };
  const state = await loadState(scopedCustomerId);
  state.conversations = [conversation, ...state.conversations].slice(0, MAX_CONVERSATIONS);
  await persistState(scopedCustomerId, state);
  return clone(conversation);
}

export async function renameCoachConversation(
  conversationId: string,
  title: string,
  customerId?: string | null,
): Promise<CoachConversation> {
  const scopedCustomerId = customerScope(customerId);
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, conversationId);
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 60) throw new Error("Conversation title must be 1–60 characters");
  conversation.title = trimmed;
  conversation.updatedAt = now();
  await persistState(scopedCustomerId, state);
  return clone(conversation);
}

export async function deleteCoachConversation(
  conversationId: string,
  customerId?: string | null,
): Promise<void> {
  const scopedCustomerId = customerScope(customerId);
  const state = await loadState(scopedCustomerId);
  requireConversation(state, conversationId);
  state.conversations = state.conversations.filter((conversation) => conversation.id !== conversationId);
  await persistState(scopedCustomerId, state);
}

function requireConversation(state: StoredCoachState, conversationId: string): CoachConversation {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error("Conversation unavailable or you do not have access to it");
  return conversation;
}

function isGeneralQuestion(text: string): boolean {
  const normalized = text.toLocaleLowerCase();
  const educational = ["what is", "how does", "explain", "meaning of", "rule of thumb", "learn about"];
  const personal = ["my ", "i ", "me ", "where did", "this month", "last month", "my account", "my goal"];
  return educational.some((phrase) => normalized.includes(phrase)) && !personal.some((phrase) => normalized.includes(phrase));
}

function requiresPersonalData(text: string, context: CoachConversationContext): boolean {
  if (context.selectedTransactionId) return true;
  if (isGeneralQuestion(text)) return false;
  return context.scope.kind !== "personal" || /\b(my|mine|spending|spent|money|account|card|goal|saving|savings|save|income|balance|transaction|month|afford|affordability|purchase)\b/i.test(text);
}

function statusCallback(callback: RunStateCallback | undefined, state: CoachMessage["status"]): void {
  callback?.(state);
}

async function yieldToRuntime(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function setRunStatus(
  conversation: CoachConversation,
  run: CoachRun,
  userMessage: CoachMessage,
  status: CoachMessage["status"],
): void {
  run.status = status;
  run.updatedAt = now();
  userMessage.status = status;
  conversation.updatedAt = now();
}

function activeRun(conversation: CoachConversation): CoachRun | undefined {
  return conversation.runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status));
}

export async function submitCoachMessage(options: SubmitCoachMessageOptions): Promise<CoachMessageResult> {
  const scopedCustomerId = customerScope(options.customerId);
  const text = options.text.trim();
  if (!text) throw new Error("Ask a question before sending");
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Questions must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, options.conversationId);
  if (activeRun(conversation)) throw new Error("A Coach response is already being prepared");

  const userMessage: CoachMessage = {
    id: createId("message"),
    role: "user",
    content: text,
    createdAt: now(),
    status: "queued",
  };
  const run: CoachRun = {
    id: createId("run"),
    userMessageId: userMessage.id,
    status: "queued",
    sequence: conversation.runs.length + 1,
    createdAt: now(),
    updatedAt: now(),
  };
  conversation.messages.push(userMessage);
  conversation.runs.push(run);
  if (conversation.title === "New conversation") {
    conversation.title = createConversationTitle(text);
  }
  liveRunIds.add(run.id);
  options.onRunCreated?.(run.id);
  try {
    await persistState(scopedCustomerId, state);
    return await processCoachRun({
      customerId: scopedCustomerId,
      conversation,
      userMessage,
      run,
      signal: options.signal,
      onStateChange: options.onStateChange,
      onRunCreated: options.onRunCreated,
    });
  } finally {
    liveRunIds.delete(run.id);
  }
}

export async function retryCoachMessage(
  conversationId: string,
  userMessageId: string,
  options?: { customerId?: string | null; signal?: AbortSignal; onStateChange?: RunStateCallback; onRunCreated?: RunCreatedCallback },
): Promise<CoachMessageResult> {
  const scopedCustomerId = customerScope(options?.customerId);
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, conversationId);
  if (activeRun(conversation)) throw new Error("A Coach response is already being prepared");
  const userMessage = conversation.messages.find((message) => message.id === userMessageId && message.role === "user");
  if (!userMessage) throw new Error("The message is unavailable");
  const oldRuns = conversation.runs.filter((run) => run.userMessageId === userMessage.id);
  const oldAssistantIds = new Set(oldRuns.map((run) => run.assistantMessageId).filter(Boolean));
  conversation.messages = conversation.messages.filter((message) => !oldAssistantIds.has(message.id));
  const run: CoachRun = {
    id: createId("run"),
    userMessageId: userMessage.id,
    status: "queued",
    sequence: conversation.runs.length + 1,
    createdAt: now(),
    updatedAt: now(),
  };
  conversation.runs.push(run);
  liveRunIds.add(run.id);
  options?.onRunCreated?.(run.id);
  userMessage.status = "queued";
  userMessage.errorMessage = undefined;
  try {
    await persistState(scopedCustomerId, state);
    return await processCoachRun({
      customerId: scopedCustomerId,
      conversation,
      userMessage,
      run,
      signal: options?.signal,
      onStateChange: options?.onStateChange,
      onRunCreated: options?.onRunCreated,
    });
  } finally {
    liveRunIds.delete(run.id);
  }
}

type ProcessRunInput = {
  customerId: string;
  conversation: CoachConversation;
  userMessage: CoachMessage;
  run: CoachRun;
  signal?: AbortSignal;
  onStateChange?: RunStateCallback;
  onRunCreated?: RunCreatedCallback;
};

async function processCoachRun(input: ProcessRunInput): Promise<CoachMessageResult> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  activeControllers.set(input.run.id, controller);
  const signal = controller.signal;
  const persist = async () => {
    const persisted = await persistRunConversation(input.customerId, input.conversation);
    if (!persisted) throw new ConversationRemovedDuringRunError();
  };

  try {
    const consent = await getCoachConsent(input.customerId);
    if (requiresPersonalData(input.userMessage.content, input.conversation.context) && consent !== "granted") {
      setRunStatus(input.conversation, input.run, input.userMessage, "completed");
      await persist();
      return {
        conversation: clone(input.conversation),
        userMessageId: input.userMessage.id,
        consentRequired: true,
        run: clone(input.run),
      };
    }

    setRunStatus(input.conversation, input.run, input.userMessage, "retrieving");
    statusCallback(input.onStateChange, "retrieving");
    await persist();
    await yieldToRuntime();
    assertNotAborted(signal);

    const currentScope = input.conversation.context.scope;
    const scopeData = await resolveCoachScope(input.customerId, {
      kind: currentScope.kind,
      accountId: currentScope.accountIds[0],
      cardId: currentScope.cardIds[0],
      goalId: currentScope.goalId,
    });
    input.conversation.context = {
      ...input.conversation.context,
      scope: scopeData.scope,
      ...(scopeData.goal ? {
        selectedGoalId: scopeData.goal.id,
        goalScenario: goalScenarioFromFinancialGoal(scopeData.goal),
      } : {}),
    };
    setRunStatus(input.conversation, input.run, input.userMessage, "calculating");
    statusCallback(input.onStateChange, "calculating");
    await persist();
    await yieldToRuntime();
    assertNotAborted(signal);

    const analysis = await analyseQuestion(
      input.customerId,
      input.userMessage.content,
      input.conversation.context,
      scopeData,
      signal,
    );
    input.conversation.context = {
      ...input.conversation.context,
      ...analysis.contextPatch,
    };
    setRunStatus(input.conversation, input.run, input.userMessage, "preparing");
    statusCallback(input.onStateChange, "preparing");
    await persist();
    await yieldToRuntime();
    assertNotAborted(signal);

    const generatedText = await testCoachModel.generate({
      question: input.userMessage.content,
      explanation: analysis.explanation,
      modelStatus: MODEL_STATUS,
    });
    const assistantMessageId = createId("message");
    const answer: CoachAnswer = {
      schemaVersion: "coach-answer.v1",
      messageId: assistantMessageId,
      conversationId: input.conversation.id,
      runId: input.run.id,
      answerStatus: "completed",
      blocks: [{ type: "text", id: createId("block"), text: generatedText }, ...analysis.blocks],
      scope: clone(input.conversation.context.scope),
      sourceReferences: analysis.sourceReferences,
      dataAsOf: DEMO_DATA_AS_OF,
      generatedAt: now(),
      assumptions: [
        "Calculations use exact INR paise and the posted transaction policy.",
        `Calculation definition: ${CALCULATION_VERSION}.`,
        ...analysis.assumptions,
      ],
      limitations: [
        "This response uses the explicitly labelled demo environment, not live bank or model-provider data.",
        ...analysis.limitations,
      ],
      suggestedFollowUps: analysis.suggestedFollowUps,
      modelStatus: MODEL_STATUS,
      dataEnvironment: "Demo data",
    };
    validateAnswer(answer);
    const assistantMessage: CoachMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: generatedText,
      createdAt: now(),
      runId: input.run.id,
      status: "completed",
      answer,
    };
    input.run.assistantMessageId = assistantMessageId;
    setRunStatus(input.conversation, input.run, input.userMessage, "completed");
    input.conversation.messages.push(assistantMessage);
    await persist();
    statusCallback(input.onStateChange, "completed");
    return {
      conversation: clone(input.conversation),
      userMessageId: input.userMessage.id,
      assistantMessageId,
      answer: clone(answer),
      run: clone(input.run),
    };
  } catch (error) {
    if (error instanceof ConversationRemovedDuringRunError) throw error;
    if (isAbortError(error) || signal.aborted) {
      setRunStatus(input.conversation, input.run, input.userMessage, "stopped");
      await persist();
      statusCallback(input.onStateChange, "stopped");
      return {
        conversation: clone(input.conversation),
        userMessageId: input.userMessage.id,
        run: clone(input.run),
      };
    }
    input.userMessage.status = "failed";
    input.userMessage.errorMessage = error instanceof Error ? error.message : "The Coach could not prepare a response";
    input.run.status = "failed";
    input.run.updatedAt = now();
    const failureMessage: CoachMessage = {
      id: createId("message"),
      role: "assistant",
      content: "I couldn’t prepare a verified answer from the selected data. Please retry this question.",
      createdAt: now(),
      runId: input.run.id,
      status: "failed",
      errorMessage: input.userMessage.errorMessage,
    };
    input.run.assistantMessageId = failureMessage.id;
    input.conversation.messages.push(failureMessage);
    await persist();
    statusCallback(input.onStateChange, "failed");
    return {
      conversation: clone(input.conversation),
      userMessageId: input.userMessage.id,
      assistantMessageId: failureMessage.id,
      run: clone(input.run),
    };
  } finally {
    activeControllers.delete(input.run.id);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function stopCoachRun(
  conversationId: string,
  runId: string,
  customerId?: string | null,
): Promise<CoachConversation> {
  const scopedCustomerId = customerScope(customerId);
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, conversationId);
  const run = conversation.runs.find((item) => item.id === runId);
  if (!run) throw new Error("Run unavailable");
  activeControllers.get(runId)?.abort();
  const userMessage = conversation.messages.find((message) => message.id === run.userMessageId);
  if (userMessage && ["queued", "retrieving", "calculating", "preparing"].includes(userMessage.status)) {
    userMessage.status = "stopped";
  }
  run.status = "stopped";
  run.updatedAt = now();
  await persistState(scopedCustomerId, state);
  return clone(conversation);
}

function hasMeaningfulConversation(conversation: CoachConversation): boolean {
  return conversation.messages.some((message) => message.role === "user" && message.content.trim().length > 0);
}

function createConversationTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLocaleLowerCase();
  const withoutTimeQualifier = normalized.replace(/\s+(this|next|last)\s+(month|week)|\s+(today|right now)$/i, "").trim();

  if (/where did|most of my money|overspend|spend the most/.test(lower)) {
    return "Where did I spend the most?";
  }

  if (/emergency fund|emergency savings|rainy day|financial buffer/.test(lower)) {
    return "Building an emergency fund";
  }

  const savingMatch = normalized.match(/(?:save|saving|savings)\s+(?:more\s+)?(?:for|toward|towards)\s+(.+)/i);
  if (savingMatch?.[1]) {
    return `Saving for ${stripTrailingPunctuation(savingMatch[1])}`.slice(0, 56);
  }

  if (/\bafford\b/i.test(normalized)) {
    const question = withoutTimeQualifier.replace(/\?+$/, "");
    return `${question}${question.endsWith("?") ? "" : "?"}`.slice(0, 56);
  }

  const title = stripTrailingPunctuation(withoutTimeQualifier);
  const suffix = /\?\s*$/.test(normalized) ? "?" : "";
  const formattedTitle = `${title}${suffix}`;
  return formattedTitle.length > 56 ? `${formattedTitle.slice(0, 53)}…` : formattedTitle;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/, "").trim();
}

function periodFor(id: CoachPeriod["id"]): CoachPeriod {
  if (id === "previous-month") {
    return { id, label: "Previous month · 1–31 Aug 2026", from: "2026-08-01", to: "2026-08-31", isComplete: true };
  }
  if (id === "all-available") {
    return { id, label: "All available history", from: "2026-01-01", to: "2026-09-06", isComplete: false };
  }
  return { id: "current-month", label: "This month · 1–30 Sep 2026", from: "2026-09-01", to: "2026-09-30", isComplete: false };
}

function validatedContextPeriod(period: CoachPeriod): CoachPeriod {
  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(period.from) || !isValidDate(period.to) || period.from > period.to) {
    throw new Error("Coach period must contain a valid date range");
  }
  const label = period.label.trim();
  if (!label || label.length > 100) throw new Error("Coach period label is invalid");
  return { ...period, label };
}

function lastNinetyDaysPeriod(): CoachPeriod {
  return {
    id: "all-available",
    label: "Last 90 days · 9 Jun–6 Sep 2026",
    from: "2026-06-09",
    to: "2026-09-06",
    isComplete: true,
  };
}

function resolvePeriod(text: string, context: CoachConversationContext): { period: CoachPeriod; comparisonPeriod: CoachPeriod } {
  const normalized = text.toLocaleLowerCase();
  const explicitPeriod = normalized.includes("previous month") || normalized.includes("last month") || normalized.includes("august")
    ? periodFor("previous-month")
    : normalized.includes("last 90 days")
      ? lastNinetyDaysPeriod()
      : normalized.includes("all available") || normalized.includes("all history") || normalized.includes("entire history")
      ? periodFor("all-available")
      : normalized.includes("current month") || normalized.includes("this month") || normalized.includes("september")
        ? periodFor("current-month")
        : undefined;
  const period = explicitPeriod ?? context.period ?? periodFor("current-month");
  const defaultComparisonPeriod = period.id === "previous-month"
    ? periodFor("current-month")
    : periodFor("previous-month");
  const comparisonPeriod = !explicitPeriod && context.period?.id === period.id
    ? context.comparisonPeriod ?? defaultComparisonPeriod
    : defaultComparisonPeriod;
  return { period, comparisonPeriod };
}

function resolveCategory(text: string, context: CoachConversationContext): TransactionCategory | undefined {
  const normalized = text.toLocaleLowerCase();
  if (normalized.includes("food") || normalized.includes("dining") || normalized.includes("restaurant") || normalized.includes("delivery")) return "food";
  if (normalized.includes("shopping") || normalized.includes("grocery")) return "shopping";
  if (normalized.includes("bill") || normalized.includes("utility")) return "bill";
  return context.category;
}

function resolveIntent(text: string, context: CoachConversationContext): CoachIntent {
  const normalized = text.toLocaleLowerCase();
  if (context.selectedTransactionId) return "transactions";
  if (isGeneralQuestion(text)) return "education";
  if (/\bafford(?:able|ability)?\b|\b(?:buy|purchase)\b.*(?:within|budget)/.test(normalized)) return "affordability";
  if ((/goal|target/.test(normalized) && /progress|progressing|on track|tracking/.test(normalized)) || /how (?:am i|are my goals?|is my goal) doing/.test(normalized)) return "goal-progress";
  if (/emergency fund|goal|save\s+₹|save\s+rs|monthly contribution|put the difference|plan for/.test(normalized) || context.goalScenario && /₹|rs|monthly|contribution|reach|target|faster|date|amount/.test(normalized)) return "goal";
  if (/increase (?:my )?savings|improve (?:my )?savings|save more|saving more|savings rate|how much (?:am i|are we) saving|monthly savings|compare (?:my )?savings/.test(normalized)) return "savings";
  if (/show|list|behind|transactions|merchant|where did/.test(normalized) && (context.topic === "spending" || /transaction|behind|merchant/.test(normalized))) return "transactions";
  if (/changed|change|compare|increase|decrease|more|less|difference|than/.test(normalized)) return "comparison";
  if (/where did|breakdown|categories|spending|spent/.test(normalized)) return "breakdown";
  if (/recurring|subscription|commitment|rent|regular/.test(normalized)) return "recurring";
  return "overview";
}

async function loadAllAccountTransactions(
  accountId: string,
  customerId: string,
  signal?: AbortSignal,
): Promise<AccountTransaction[]> {
  const items: AccountTransaction[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    assertNotAborted(signal);
    const result = await getAccountTransactions(accountId, {
      customerId,
      page,
      pageSize: 20,
      filters: { status: "all" },
      signal,
    });
    items.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

async function loadScopeTransactions(
  scopeData: ScopeData,
  customerId: string,
  signal?: AbortSignal,
): Promise<UnifiedTransaction[]> {
  if (scopeData.scope.kind === "card") {
    const all: CardTransaction[] = [];
    for (const cardId of scopeData.scope.cardIds) {
      let page = 1;
      let totalPages = 1;
      do {
        assertNotAborted(signal);
        const result = await getCardTransactions(cardId, { customerId, page, pageSize: 20, filters: { status: "all" }, signal });
        all.push(...result.items);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);
    }
    return all.map((transaction) => ({
      id: transaction.id,
      sourceTransactionId: transaction.sourceTransactionId,
      cardId: transaction.cardId,
      amountMinorUnits: transaction.amountMinorUnits,
      direction: transaction.direction,
      status: transaction.status,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      counterparty: transaction.merchant,
      category: transaction.category,
      transactionType: transaction.transactionType,
      sourceEnvironment: transaction.sourceEnvironment,
    }));
  }

  const accountTransactions = await Promise.all(
    scopeData.scope.accountIds.map((accountId) => loadAllAccountTransactions(accountId, customerId, signal)),
  );
  return accountTransactions.flat().map((transaction) => ({
    id: transaction.id,
    sourceTransactionId: transaction.sourceTransactionId,
    accountId: transaction.accountId,
    amountMinorUnits: transaction.amountMinorUnits,
    direction: transaction.direction,
    status: transaction.status,
    transactionDate: transaction.transactionDate,
    description: transaction.description,
    counterparty: transaction.counterparty,
    category: transaction.annotation?.category ?? transaction.originalCategory,
    sourceEnvironment: transaction.sourceEnvironment,
  }));
}

function withinPeriod(transaction: UnifiedTransaction, period: CoachPeriod): boolean {
  return transaction.transactionDate >= period.from && transaction.transactionDate <= period.to;
}

function isConsumption(transaction: UnifiedTransaction, category?: TransactionCategory): boolean {
  if (transaction.status !== "posted" && transaction.status !== "reversed") return false;
  if (transaction.transactionType && !["purchase", "cash-withdrawal", "fee", "refund", "reversal"].includes(transaction.transactionType)) return false;
  if (transaction.category === "transfer" || transaction.category === "deposit" || transaction.category === "salary" || transaction.category === "interest") return false;
  if (category && transaction.category !== category) return false;
  if (transaction.category === "refund") return transaction.direction === "credit";
  return transaction.direction === "debit";
}

function spendingTotals(
  transactions: UnifiedTransaction[],
  period: CoachPeriod,
  category?: TransactionCategory,
): SpendingTotals {
  const inPeriod = transactions.filter((transaction) => withinPeriod(transaction, period));
  const pendingMinorUnits = inPeriod
    .filter((transaction) => transaction.status === "pending" && (category === undefined || transaction.category === category))
    .reduce((sum, transaction) => sum + (transaction.direction === "debit" ? transaction.amountMinorUnits : -transaction.amountMinorUnits), 0);
  const failedMinorUnits = inPeriod
    .filter((transaction) => transaction.status === "failed" && (category === undefined || transaction.category === category))
    .reduce((sum, transaction) => sum + (transaction.direction === "debit" ? transaction.amountMinorUnits : -transaction.amountMinorUnits), 0);
  const included = inPeriod.filter((transaction) => isConsumption(transaction, category));
  const amountMinorUnits = included.reduce(
    (sum, transaction) => sum + (transaction.category === "refund" ? -transaction.amountMinorUnits : transaction.amountMinorUnits),
    0,
  );
  return { amountMinorUnits, count: included.length, pendingMinorUnits, failedMinorUnits, transactions: included };
}

function cashFlowTotals(transactions: UnifiedTransaction[], period: CoachPeriod): CashFlowTotals {
  const inPeriod = transactions.filter((transaction) => withinPeriod(transaction, period));
  const postedTransactions = inPeriod.filter((transaction) => transaction.status === "posted");
  const inflowMinorUnits = postedTransactions
    .filter((transaction) => transaction.direction === "credit")
    .reduce((sum, transaction) => sum + transaction.amountMinorUnits, 0);
  const outflowMinorUnits = postedTransactions
    .filter((transaction) => transaction.direction === "debit")
    .reduce((sum, transaction) => sum + transaction.amountMinorUnits, 0);
  const netMinorUnits = inflowMinorUnits - outflowMinorUnits;
  const savingsRate = inflowMinorUnits > 0
    ? Math.round((netMinorUnits / inflowMinorUnits) * 10_000) / 100
    : undefined;

  return {
    inflowMinorUnits,
    outflowMinorUnits,
    netMinorUnits,
    savingsRate,
    postedTransactions,
    pendingCount: inPeriod.filter((transaction) => transaction.status === "pending").length,
    failedCount: inPeriod.filter((transaction) => transaction.status === "failed").length,
  };
}

function transactionSource(transaction: UnifiedTransaction, period?: CoachPeriod): CoachSourceReference {
  return {
    id: `source:transaction:${transaction.id}`,
    kind: "transaction",
    label: transaction.counterparty ?? transaction.description,
    accountId: transaction.accountId,
    cardId: transaction.cardId,
    transactionId: transaction.id,
    period,
    sourceEnvironment: "Demo data",
    capturedAt: DEMO_DATA_AS_OF,
  };
}

function accountSource(accountId: string, label: string): CoachSourceReference {
  return {
    id: `source:account:${accountId}`,
    kind: "account",
    label,
    accountId,
    sourceEnvironment: "Demo data",
    capturedAt: DEMO_DATA_AS_OF,
  };
}

function cardSource(cardId: string, label: string): CoachSourceReference {
  return {
    id: `source:card:${cardId}`,
    kind: "card",
    label,
    cardId,
    sourceEnvironment: "Demo data",
    capturedAt: DEMO_DATA_AS_OF,
  };
}

function goalSource(goal: FinancialGoal): CoachSourceReference {
  return {
    id: `source:goal:${goal.id}`,
    kind: "goal",
    label: goal.name,
    sourceEnvironment: "Demo data",
    capturedAt: DEMO_DATA_AS_OF,
  };
}

function calculationSource(id: string, label: string, period?: CoachPeriod): CoachSourceReference {
  return {
    id: `source:calculation:${id}`,
    kind: "calculation",
    label,
    period,
    sourceEnvironment: "Demo data",
    capturedAt: DEMO_DATA_AS_OF,
  };
}

function categoryLabel(category?: TransactionCategory): string {
  if (!category) return "All spending";
  return category === "food" ? "Food & Dining" : category[0].toLocaleUpperCase() + category.slice(1);
}

function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatPeriodText(period: CoachPeriod): string {
  return period.label.replace(" · ", " (") + (period.id === "current-month" ? ")" : ")");
}

function amountMultiplier(suffix?: string): number {
  const normalized = suffix?.toLocaleLowerCase().replace(/\.$/, "");
  if (!normalized || normalized.startsWith("rupee")) return 1;
  if (normalized === "k" || normalized.startsWith("thousand")) return 1_000;
  if (normalized === "l" || normalized === "lac" || normalized === "lacs" || normalized.startsWith("lakh")) return 100_000;
  if (normalized === "cr" || normalized.startsWith("crore")) return 10_000_000;
  return 1;
}

function decimalMajorUnitsToMinorUnits(rawAmount: string, multiplier: number): number | undefined {
  const normalized = rawAmount.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return undefined;
  const [whole, fraction = ""] = normalized.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * denominator + BigInt(fraction || "0");
  const scaledMinorUnits = numerator * BigInt(multiplier) * 100n;
  if (scaledMinorUnits % denominator !== 0n) return undefined;
  const result = scaledMinorUnits / denominator;
  if (result <= 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(result);
}

function parsePurchaseAmountMinorUnits(text: string): number | undefined {
  const prefixed = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,4})?)\s*(?:(crores?|cr|lakhs?|lacs?|lac|l|thousands?|k)\b)?/i);
  if (prefixed?.[1]) {
    return decimalMajorUnitsToMinorUnits(prefixed[1], amountMultiplier(prefixed[2]));
  }

  const suffixed = text.match(/\b([\d,]+(?:\.\d{1,4})?)\s*(crores?|cr|lakhs?|lacs?|lac|thousands?|k|rupees?)\b/i);
  if (suffixed?.[1]) {
    return decimalMajorUnitsToMinorUnits(suffixed[1], amountMultiplier(suffixed[2]));
  }

  const plainAfterAfford = text.match(/\bafford(?:\s+(?:a|an))?\s+([\d,]+(?:\.\d{1,2})?)(?=\s|$)/i);
  return plainAfterAfford?.[1]
    ? decimalMajorUnitsToMinorUnits(plainAfterAfford[1], 1)
    : undefined;
}

function parseMonthlyContribution(text: string, fallback: number): number {
  const match = text.match(/(?:₹|rs\.?|inr\s*)\s*([\d,]+)|\b(\d[\d,]{2,})\s*(?:per\s+month|monthly|a\s+month)/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return fallback;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value * 100 : fallback;
}

export function calculateGoalScenario(
  targetMinorUnits: number,
  allocatedMinorUnits: number,
  monthlyContributionMinorUnits: number,
): GoalScenarioOption {
  if (!Number.isInteger(targetMinorUnits) || !Number.isInteger(allocatedMinorUnits) || !Number.isInteger(monthlyContributionMinorUnits)) {
    throw new Error("Goal amounts must be whole paise values");
  }
  const remainingMinorUnits = Math.max(0, targetMinorUnits - allocatedMinorUnits);
  if (remainingMinorUnits === 0) return { monthlyContributionMinorUnits, months: 0, finalContributionMinorUnits: 0, label: "Already funded" };
  if (monthlyContributionMinorUnits <= 0) throw new Error("Monthly contribution must be greater than zero");
  const months = Math.ceil(remainingMinorUnits / monthlyContributionMinorUnits);
  const remainder = remainingMinorUnits % monthlyContributionMinorUnits;
  const finalContributionMinorUnits = remainder === 0 ? monthlyContributionMinorUnits : remainder;
  return {
    monthlyContributionMinorUnits,
    months,
    finalContributionMinorUnits,
    label: `${months} month${months === 1 ? "" : "s"}`,
  };
}

function buildGoalScenario(text: string, context: CoachConversationContext): { scenario: GoalScenario; options: GoalScenarioOption[] } {
  const base = context.goalScenario ?? {
    name: /emergency/i.test(text) ? "Emergency fund" : "Savings goal",
    targetMinorUnits: 120_000_00,
    allocatedMinorUnits: 30_000_00,
    remainingMinorUnits: 90_000_00,
  };
  const selected = parseMonthlyContribution(text, 5_000_00);
  const scenario: GoalScenario = {
    ...base,
    remainingMinorUnits: Math.max(0, base.targetMinorUnits - base.allocatedMinorUnits),
  };
  const options = [5_000_00, 7_000_00]
    .map((amount) => calculateGoalScenario(scenario.targetMinorUnits, scenario.allocatedMinorUnits, amount))
    .map((option) => ({ ...option, label: option.monthlyContributionMinorUnits === selected ? `${formatIndianMinorUnits(option.monthlyContributionMinorUnits)}/month · ${option.label}` : `${formatIndianMinorUnits(option.monthlyContributionMinorUnits)}/month · ${option.label}` }));
  if (!options.some((option) => option.monthlyContributionMinorUnits === selected)) {
    options.push({ ...calculateGoalScenario(scenario.targetMinorUnits, scenario.allocatedMinorUnits, selected), label: `${formatIndianMinorUnits(selected)}/month · ${calculateGoalScenario(scenario.targetMinorUnits, scenario.allocatedMinorUnits, selected).label}` });
  }
  return { scenario, options };
}

function scopedResourceSources(scopeData: ScopeData): CoachSourceReference[] {
  const accountReferences = scopeData.accounts
    .filter((account) => scopeData.scope.accountIds.includes(account.id))
    .map((account) => accountSource(account.id, `${account.name} ${maskLastFour(account.lastFour)}`));
  const cardReferences = scopeData.cards
    .filter((card) => scopeData.scope.cardIds.includes(card.id))
    .map((card) => cardSource(card.id, `${card.productName} ${maskLastFour(card.lastFour)}`));
  return [...accountReferences, ...cardReferences];
}

function transactionListBlock(
  title: string,
  transactions: UnifiedTransaction[],
): Extract<CoachAnswerBlock, { type: "transactionList" }> | undefined {
  if (transactions.length === 0) return undefined;
  const items = transactions.map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    cardId: transaction.cardId,
    label: transaction.counterparty ?? transaction.description,
    date: transaction.transactionDate,
    amountMinorUnits: transaction.amountMinorUnits,
    direction: transaction.direction,
    status: transaction.status,
    sourceReferenceId: `source:transaction:${transaction.id}`,
  }));
  return {
    type: "transactionList",
    id: createId("block"),
    title,
    transactionIds: items.map((item) => item.id),
    items,
  };
}

async function dashboardCashFlow(
  customerId: string,
  scopeData: ScopeData,
  period: CoachPeriod,
  signal?: AbortSignal,
): Promise<Pick<CashFlowTotals, "inflowMinorUnits" | "outflowMinorUnits" | "netMinorUnits" | "savingsRate"> | undefined> {
  if (fixtureCustomerId(customerId) !== DEMO_CUSTOMER_A || scopeData.scope.kind !== "personal" || period.id !== "current-month") {
    return undefined;
  }

  assertNotAborted(signal);
  const dashboard = await getWealthCoachDashboard({ customerId });
  assertNotAborted(signal);
  const income = dashboard.metrics.find((metric) => metric.id === "income");
  const expenses = dashboard.metrics.find((metric) => metric.id === "expenses");
  const savingsRate = dashboard.metrics.find((metric) => metric.id === "savings-rate");
  if (!income || !expenses || !Number.isFinite(income.value) || !Number.isFinite(expenses.value)) return undefined;
  const inflowMinorUnits = Math.round(income.value * 100);
  const outflowMinorUnits = Math.round(expenses.value * 100);
  return {
    inflowMinorUnits,
    outflowMinorUnits,
    netMinorUnits: inflowMinorUnits - outflowMinorUnits,
    savingsRate: savingsRate && Number.isFinite(savingsRate.value) ? savingsRate.value : undefined,
  };
}

async function analyseAffordabilityQuestion(
  customerId: string,
  text: string,
  scopeData: ScopeData,
  period: CoachPeriod,
  comparisonPeriod: CoachPeriod,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const purchaseMinorUnits = parsePurchaseAmountMinorUnits(text);
  if (!purchaseMinorUnits) {
    return {
      explanation: "I need the purchase amount before I can prepare a funding-capacity check. I will use the amount only for an illustration and will not move or reserve money.",
      blocks: [{
        type: "clarification",
        id: createId("block"),
        question: "What purchase amount should I assess?",
        options: [`Can I afford ${formatINR(10000)}?`, `Can I afford ${formatINR(50000)}?`, `Can I afford ${formatINR(100000)}?`],
      }],
      sourceReferences: [],
      contextPatch: { topic: "cash-flow", period, comparisonPeriod },
      assumptions: [],
      limitations: ["No affordability conclusion is possible until a purchase amount is provided."],
      suggestedFollowUps: [],
    };
  }

  const transactions = await loadScopeTransactions(scopeData, customerId, signal);
  const ledgerCashFlow = cashFlowTotals(transactions, period);
  const dashboardSnapshot = await dashboardCashFlow(customerId, scopeData, period, signal);
  const dashboardMatchesLedger = dashboardSnapshot
    ? dashboardSnapshot.inflowMinorUnits === ledgerCashFlow.inflowMinorUnits
      && dashboardSnapshot.outflowMinorUnits === ledgerCashFlow.outflowMinorUnits
    : false;
  const cashFlow = dashboardMatchesLedger ? { ...ledgerCashFlow, ...dashboardSnapshot } : ledgerCashFlow;
  const scopedAccounts = scopeData.accounts.filter((account) => scopeData.scope.accountIds.includes(account.id));
  const liquidAccounts = scopedAccounts.filter((account) =>
    account.status === "active"
      && ["savings", "current", "salary"].includes(account.type)
      && Number.isInteger(account.availableBalanceMinorUnits),
  );
  const availableFundsMinorUnits = liquidAccounts.length > 0
    ? liquidAccounts.reduce((sum, account) => sum + (account.availableBalanceMinorUnits ?? 0), 0)
    : undefined;
  const selectedCreditCards = scopeData.cards.filter((card) =>
    scopeData.scope.kind === "card"
      && scopeData.scope.cardIds.includes(card.id)
      && Number.isInteger(card.creditFacility?.availableCreditMinorUnits),
  );
  const availableCreditMinorUnits = selectedCreditCards.length > 0
    ? selectedCreditCards.reduce((sum, card) => sum + (card.creditFacility?.availableCreditMinorUnits ?? 0), 0)
    : undefined;
  const remainingFundsMinorUnits = availableFundsMinorUnits === undefined
    ? undefined
    : availableFundsMinorUnits - purchaseMinorUnits;
  const purchaseShare = availableFundsMinorUnits && availableFundsMinorUnits > 0
    ? Math.round((purchaseMinorUnits / availableFundsMinorUnits) * 1_000) / 10
    : undefined;
  const calculation = calculationSource(
    `affordability-${period.id}`,
    dashboardMatchesLedger ? "Available funds and monthly dashboard cash-flow check" : "Available funds and posted cash-flow check",
    period,
  );
  const largestOutflows = cashFlow.postedTransactions
    .filter((transaction) => transaction.direction === "debit")
    .sort((left, right) => right.amountMinorUnits - left.amountMinorUnits)
    .slice(0, 5);
  const sourceReferences = dedupeSourceReferences([
    calculation,
    ...scopedResourceSources(scopeData),
    ...cashFlow.postedTransactions.map((transaction) => transactionSource(transaction, period)),
  ]);
  const metrics: Extract<CoachAnswerBlock, { type: "metricSummary" }>["metrics"] = [
    {
      key: "purchase-amount",
      label: "Purchase amount",
      valueMinorUnits: purchaseMinorUnits,
      displayValue: formatIndianMinorUnits(purchaseMinorUnits),
      unit: "INR",
      sourceReferenceId: calculation.id,
    },
  ];
  if (availableFundsMinorUnits !== undefined) {
    metrics.push(
      {
        key: "available-funds",
        label: "Reported available funds",
        valueMinorUnits: availableFundsMinorUnits,
        displayValue: formatIndianMinorUnits(availableFundsMinorUnits),
        unit: "INR",
        sourceReferenceId: calculation.id,
      },
      {
        key: "funds-after-purchase",
        label: "Funds after purchase",
        valueMinorUnits: remainingFundsMinorUnits,
        displayValue: formatIndianMinorUnits(remainingFundsMinorUnits ?? 0),
        unit: "INR",
        sourceReferenceId: calculation.id,
      },
    );
  } else if (availableCreditMinorUnits !== undefined) {
    metrics.push({
      key: "available-credit",
      label: "Reported available credit",
      valueMinorUnits: availableCreditMinorUnits,
      displayValue: formatIndianMinorUnits(availableCreditMinorUnits),
      unit: "INR",
      sourceReferenceId: calculation.id,
    });
  }
  metrics.push({
    key: "recorded-net-cash-flow",
    label: "Recorded net cash flow",
    valueMinorUnits: cashFlow.netMinorUnits,
    displayValue: formatIndianMinorUnits(cashFlow.netMinorUnits),
    unit: "INR",
    sourceReferenceId: calculation.id,
  });

  let capacityExplanation: string;
  if (availableFundsMinorUnits !== undefined) {
    capacityExplanation = remainingFundsMinorUnits !== undefined && remainingFundsMinorUnits >= 0
      ? `${formatIndianMinorUnits(purchaseMinorUnits)} fits within ${formatIndianMinorUnits(availableFundsMinorUnits)} of reported available funds and would leave ${formatIndianMinorUnits(remainingFundsMinorUnits)}${purchaseShare === undefined ? "" : ` (${formatPercentage(Math.max(0, 100 - purchaseShare))} of those funds)`}.`
      : `${formatIndianMinorUnits(purchaseMinorUnits)} exceeds the ${formatIndianMinorUnits(availableFundsMinorUnits)} reported available funds by ${formatIndianMinorUnits(Math.abs(remainingFundsMinorUnits ?? 0))}.`;
  } else if (availableCreditMinorUnits !== undefined) {
    capacityExplanation = `The selected card reports ${formatIndianMinorUnits(availableCreditMinorUnits)} of available credit, but credit headroom is not the same as affordability or cash available to repay it.`;
  } else {
    capacityExplanation = "The selected scope does not report an available balance that I can use for a funding-capacity check.";
  }

  const evidenceBlock = transactionListBlock("Largest posted outflows in the selected month", largestOutflows);
  return {
    explanation: `${capacityExplanation} Recorded net cash flow for ${formatPeriodText(period)} is ${formatIndianMinorUnits(cashFlow.netMinorUnits)}. This is a funding-capacity illustration, not certainty that the purchase is affordable; preserve upcoming obligations and your chosen emergency reserve before deciding. I have not moved or reserved any money.`,
    blocks: [
      { type: "metricSummary", id: createId("block"), metrics },
      ...(evidenceBlock ? [evidenceBlock] : []),
    ],
    sourceReferences,
    contextPatch: { topic: "cash-flow", period, comparisonPeriod },
    assumptions: [
      "The purchase is treated as a one-time payment in full, without financing, fees, rewards, or price changes.",
      "Reported available balances are used only for active savings, current, or salary accounts in the selected customer-owned scope.",
      ...(dashboardMatchesLedger ? ["The monthly dashboard income and expense totals match the exact posted-transaction calculation for this scope."] : []),
    ],
    limitations: [
      "Upcoming bills, essential spending, emergency-reserve needs, outside accounts, and future income are not known, so funding capacity is not a guarantee of affordability.",
      "The selected period may be incomplete; pending and failed rows are excluded from net cash flow.",
      "Card channel, merchant, daily, and per-transaction limits are not validated by this illustration.",
    ],
    suggestedFollowUps: ["How can I increase my savings?", "Show the transactions behind this", "Help me plan an emergency fund"],
  };
}

async function analyseSavingsQuestion(
  customerId: string,
  scopeData: ScopeData,
  period: CoachPeriod,
  comparisonPeriod: CoachPeriod,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const transactions = await loadScopeTransactions(scopeData, customerId, signal);
  const ledgerCashFlow = cashFlowTotals(transactions, period);
  const previousCashFlow = cashFlowTotals(transactions, comparisonPeriod);
  const dashboardSnapshot = await dashboardCashFlow(customerId, scopeData, period, signal);
  const dashboardMatchesLedger = dashboardSnapshot
    ? dashboardSnapshot.inflowMinorUnits === ledgerCashFlow.inflowMinorUnits
      && dashboardSnapshot.outflowMinorUnits === ledgerCashFlow.outflowMinorUnits
    : false;
  const cashFlow = dashboardMatchesLedger ? { ...ledgerCashFlow, ...dashboardSnapshot } : ledgerCashFlow;
  const calculation = calculationSource(
    `savings-${period.id}`,
    dashboardMatchesLedger ? "Monthly dashboard and posted cash-flow savings calculation" : "Posted cash-flow savings calculation",
    period,
  );
  const categories = (["food", "shopping", "bill", "cash", "other"] as TransactionCategory[])
    .map((category) => ({ category, totals: spendingTotals(transactions, period, category) }))
    .filter(({ totals }) => totals.amountMinorUnits > 0)
    .sort((left, right) => right.totals.amountMinorUnits - left.totals.amountMinorUnits);
  const topReviewCategory = categories.find(({ category }) => ["food", "shopping", "cash", "other"].includes(category));
  const tenPercentScenarioMinorUnits = topReviewCategory
    ? Math.floor(topReviewCategory.totals.amountMinorUnits / 10)
    : undefined;
  const sourceReferences = dedupeSourceReferences([
    calculation,
    ...scopedResourceSources(scopeData),
    ...cashFlow.postedTransactions.map((transaction) => transactionSource(transaction, period)),
  ]);
  const metrics: Extract<CoachAnswerBlock, { type: "metricSummary" }>["metrics"] = [
    {
      key: "recorded-inflow",
      label: "Recorded inflow",
      valueMinorUnits: cashFlow.inflowMinorUnits,
      displayValue: formatIndianMinorUnits(cashFlow.inflowMinorUnits),
      unit: "INR",
      sourceReferenceId: calculation.id,
    },
    {
      key: "recorded-outflow",
      label: "Recorded outflow",
      valueMinorUnits: cashFlow.outflowMinorUnits,
      displayValue: formatIndianMinorUnits(cashFlow.outflowMinorUnits),
      unit: "INR",
      sourceReferenceId: calculation.id,
    },
    {
      key: "recorded-net-savings",
      label: "Recorded net savings",
      valueMinorUnits: cashFlow.netMinorUnits,
      displayValue: formatIndianMinorUnits(cashFlow.netMinorUnits),
      unit: "INR",
      sourceReferenceId: calculation.id,
    },
    {
      key: "recorded-savings-rate",
      label: "Recorded savings rate",
      value: cashFlow.savingsRate,
      displayValue: cashFlow.savingsRate === undefined ? "Unavailable" : formatPercentage(cashFlow.savingsRate),
      unit: cashFlow.savingsRate === undefined ? "text" : "percentage",
      sourceReferenceId: calculation.id,
    },
  ];
  const breakdownItems = categories.map(({ category, totals }) => ({
    category,
    label: categoryLabel(category),
    amountMinorUnits: totals.amountMinorUnits,
    count: totals.count,
    sourceReferenceId: calculation.id,
  }));
  const blocks: CoachAnswerBlock[] = [{ type: "metricSummary", id: createId("block"), metrics }];
  if (breakdownItems.length > 0) {
    blocks.push({ type: "categoryBreakdown", id: createId("block"), period, items: breakdownItems });
  }

  const savingsExplanation = cashFlow.inflowMinorUnits > 0
    ? `For ${formatPeriodText(period)}, posted inflows are ${formatIndianMinorUnits(cashFlow.inflowMinorUnits)} and posted outflows are ${formatIndianMinorUnits(cashFlow.outflowMinorUnits)}, leaving ${formatIndianMinorUnits(cashFlow.netMinorUnits)} of recorded net savings (${formatPercentage(cashFlow.savingsRate ?? 0)}).`
    : `For ${formatPeriodText(period)}, I found no posted inflow, so I cannot calculate a meaningful savings rate; recorded net cash flow is ${formatIndianMinorUnits(cashFlow.netMinorUnits)}.`;
  const actionExplanation = topReviewCategory && tenPercentScenarioMinorUnits !== undefined
    ? ` ${categoryLabel(topReviewCategory.category)} is the largest included reviewable category at ${formatIndianMinorUnits(topReviewCategory.totals.amountMinorUnits)}. A 10% reduction scenario would retain about ${formatIndianMinorUnits(tenPercentScenarioMinorUnits)} more, but choose a change that does not compromise essentials.`
    : " I did not find a discretionary category large enough to model responsibly, so start with a user-chosen transfer only after essential costs are covered.";

  return {
    explanation: `${savingsExplanation}${actionExplanation} This analysis does not move money or guarantee that the current pace will continue.`,
    blocks,
    sourceReferences,
    contextPatch: { topic: "cash-flow", period, comparisonPeriod },
    assumptions: [
      "Recorded net savings means posted inflows minus all posted outflows in the selected period; it is not an investment-return or net-worth measure.",
      ...(dashboardMatchesLedger ? ["The monthly dashboard income, expenses, and savings rate match the exact posted-transaction calculation for this scope."] : []),
    ],
    limitations: [
      "The current month may be incomplete, and future income or expenses are not forecast.",
      "Pending and failed rows are excluded; transaction categories come from the shared banking service and may need review.",
      `The comparison period recorded ${formatIndianMinorUnits(previousCashFlow.netMinorUnits)} of net cash flow, but different timing or one-off payments may make a direct comparison misleading.`,
      "Outside accounts, cash activity, taxes, and upcoming obligations are not included unless they appear in the selected scope.",
    ],
    suggestedFollowUps: [
      ...(topReviewCategory ? [`Show the transactions behind ${categoryLabel(topReviewCategory.category)}`] : []),
      "Help me plan a savings goal",
      "Where did I spend the most this month?",
    ],
  };
}

async function analyseQuestion(
  customerId: string,
  text: string,
  context: CoachConversationContext,
  scopeData: ScopeData,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const intent = resolveIntent(text, context);
  const category = resolveCategory(text, context);
  const { period, comparisonPeriod } = resolvePeriod(text, context);
  const sourceReferences: CoachSourceReference[] = [];
  const assumptions: string[] = [];
  const limitations: string[] = [];
  const suggestedFollowUps: string[] = [];

  if (intent === "education") {
    return {
      explanation: "I can explain financial concepts in general terms without accessing your personal accounts. Ask a specific personal question only after reviewing Coach personalisation access.",
      blocks: [],
      sourceReferences: [],
      contextPatch: { topic: "education" },
      assumptions: [],
      limitations: ["No personal account, card, or goal data was retrieved for this general explanation."],
      suggestedFollowUps: ["Ask about your spending after enabling Coach personalisation"],
    };
  }

  if (intent === "goal-progress") {
    assertNotAborted(signal);
    const goals = scopeData.goal
      ? [scopeData.goal]
      : (await getWealthCoachDashboard({ customerId })).goals;
    assertNotAborted(signal);
    const goalSources = goals.map(goalSource);
    const goalBlocks: CoachAnswerBlock[] = goals.map((goal) => {
      const scenario = goalScenarioFromFinancialGoal(goal);
      return {
        type: "goalProgress",
        id: createId("block"),
        goalId: goal.id,
        name: goal.name,
        targetMinorUnits: scenario.targetMinorUnits,
        currentMinorUnits: scenario.allocatedMinorUnits,
        remainingMinorUnits: scenario.remainingMinorUnits,
        progressPercentage: goalProgressPercentage(scenario),
        targetDate: scenario.targetDate,
        sourceReferenceId: `source:goal:${goal.id}`,
      };
    });
    const selectedGoal = goals.length === 1 ? goals[0] : undefined;
    const selectedScenario = selectedGoal ? goalScenarioFromFinancialGoal(selectedGoal) : undefined;
    return {
      explanation: selectedGoal && selectedScenario
        ? `${selectedGoal.name} is ${goalProgressPercentage(selectedScenario)}% funded, with ${formatIndianMinorUnits(selectedScenario.remainingMinorUnits)} remaining toward the ${formatIndianMinorUnits(selectedScenario.targetMinorUnits)} target${selectedScenario.targetDate ? ` by ${selectedScenario.targetDate}` : ""}.`
        : goals.length > 0
          ? `I found ${goals.length} goals in the selected demo dashboard. Review each goal's reported progress below before changing a contribution or target.`
          : "I could not find a goal in the selected demo dashboard. Missing goal data is not treated as zero progress.",
      blocks: goalBlocks.length > 0 ? goalBlocks : [{
        type: "dataUnavailable",
        id: createId("block"),
        title: "No goal progress available",
        reason: "No goal was returned for the selected customer and scope.",
        retryable: true,
      }],
      sourceReferences: goalSources,
      contextPatch: {
        topic: "goals",
        ...(selectedGoal && selectedScenario ? {
          selectedGoalId: selectedGoal.id,
          goalScenario: selectedScenario,
        } : {}),
      },
      assumptions: ["Progress is calculated from the target and current amounts reported by the demo goal dashboard."],
      limitations: ["Goal progress does not project investment returns, fees, taxes, or future contribution changes."],
      suggestedFollowUps: selectedGoal
        ? [`How can I reach my ${selectedGoal.name} target faster?`, "Review my monthly contribution"]
        : ["Help me plan a savings goal"],
    };
  }

  if (intent === "goal") {
    const { scenario, options } = buildGoalScenario(text, context);
    const source = calculationSource("goal-scenario", "No-growth goal scenario", undefined);
    if (scopeData.goal) {
      sourceReferences.push(goalSource(scopeData.goal));
    }
    sourceReferences.push(source);
    const selected = options.find((option) => option.monthlyContributionMinorUnits === parseMonthlyContribution(text, 5_000_00)) ?? options[0];
    return {
      explanation: `${scenario.name} has ${formatIndianMinorUnits(scenario.remainingMinorUnits)} remaining after ${formatIndianMinorUnits(scenario.allocatedMinorUnits)} already allocated. At ${formatIndianMinorUnits(selected.monthlyContributionMinorUnits)} per month, the no-growth plan takes ${selected.label.replace(`${formatIndianMinorUnits(selected.monthlyContributionMinorUnits)}/month · `, "")}. This is a planning illustration, not a guarantee or a money movement.`,
      blocks: [{ type: "goalScenario", id: createId("block"), goal: scenario, options, sourceReferenceId: source.id }],
      sourceReferences,
      contextPatch: { topic: "goals", goalScenario: scenario },
      assumptions: ["No investment growth, interest, tax, or fee is assumed."],
      limitations: [scopeData.goal
        ? "The selected goal values come from the demo dashboard; review them before changing or saving a plan."
        : "The suggested target and allocated amount are demo scenario inputs; review them before saving a goal."],
      suggestedFollowUps: [`Use ${formatINR(7000)} per month`, "Adjust the target date", "Review and save this goal"],
    };
  }

  if (intent === "affordability") {
    return analyseAffordabilityQuestion(customerId, text, scopeData, period, comparisonPeriod, signal);
  }

  if (intent === "savings") {
    return analyseSavingsQuestion(customerId, scopeData, period, comparisonPeriod, signal);
  }

  return analyseTransactionQuestion(customerId, text, context, scopeData, category, period, comparisonPeriod, signal, sourceReferences, assumptions, limitations, suggestedFollowUps);
}

async function analyseTransactionQuestion(
  customerId: string,
  text: string,
  context: CoachConversationContext,
  scopeData: ScopeData,
  category: TransactionCategory | undefined,
  period: CoachPeriod,
  comparisonPeriod: CoachPeriod,
  signal: AbortSignal | undefined,
  sourceReferences: CoachSourceReference[],
  assumptions: string[],
  limitations: string[],
  suggestedFollowUps: string[],
): Promise<AnalysisResult> {
  // This function is replaced at the call site with the customer-scoped data
  // loader below. Keeping calculation code separate makes it independently
  // testable and prevents UI components from owning ledger rules.
  const transactions = await loadScopeTransactions(scopeData, customerId, signal);
  const intent = resolveIntent(text, context);
  const label = categoryLabel(category);
  if (scopeData.scope.kind === "card") {
    scopeData.cards.filter((card) => scopeData.scope.cardIds.includes(card.id)).forEach((card) => sourceReferences.push(cardSource(card.id, `${card.productName} ${maskLastFour(card.lastFour)}`)));
  } else {
    scopeData.accounts.filter((account) => scopeData.scope.accountIds.includes(account.id)).forEach((account) => sourceReferences.push(accountSource(account.id, `${account.name} ${maskLastFour(account.lastFour)}`)));
  }
  if (context.selectedTransactionId) {
    const selectedTransaction = transactions.find((transaction) => (
      transaction.id === context.selectedTransactionId
      || transaction.sourceTransactionId === context.selectedTransactionId
      || `${transaction.cardId ? "card" : "account"}:${transaction.id}` === context.selectedTransactionId
    ));
    if (!selectedTransaction) {
      return {
        explanation: "I could not find the selected transaction inside the authorised account or card scope. I did not substitute another transaction or broaden the request.",
        blocks: [{
          type: "dataUnavailable",
          id: createId("block"),
          title: "Selected transaction unavailable",
          reason: "The selected transaction was not returned for this customer and resource scope.",
          retryable: false,
        }],
        sourceReferences: dedupeSourceReferences(sourceReferences),
        contextPatch: { topic: "spending", period, comparisonPeriod, category },
        assumptions: [],
        limitations: ["No other transaction was used when the selected identifier could not be resolved."],
        suggestedFollowUps: [],
      };
    }
    const selectedSource = transactionSource(selectedTransaction, period);
    sourceReferences.push(selectedSource);
    const selectedLabel = categoryLabel(selectedTransaction.category);
    return {
      explanation: `The selected transaction is a ${selectedTransaction.status} ${selectedTransaction.direction} of ${formatIndianMinorUnits(selectedTransaction.amountMinorUnits)}, recorded as ${selectedLabel.toLocaleLowerCase()} on ${selectedTransaction.transactionDate}.`,
      blocks: [{
        type: "transactionList",
        id: createId("block"),
        title: "Selected transaction",
        transactionIds: [selectedTransaction.id],
        items: [{
          id: selectedTransaction.id,
          accountId: selectedTransaction.accountId,
          cardId: selectedTransaction.cardId,
          label: selectedTransaction.counterparty ?? selectedTransaction.description,
          date: selectedTransaction.transactionDate,
          amountMinorUnits: selectedTransaction.amountMinorUnits,
          direction: selectedTransaction.direction,
          status: selectedTransaction.status,
          sourceReferenceId: selectedSource.id,
        }],
      }],
      sourceReferences: dedupeSourceReferences(sourceReferences),
      contextPatch: { topic: "spending", period, comparisonPeriod, category: selectedTransaction.category ?? category },
      assumptions: [],
      limitations: ["This description uses the selected bank-recorded row and does not infer merchant intent."],
      suggestedFollowUps: ["What does this transaction status mean?", "How is this transaction categorised?"],
    };
  }
  const calculation = calculationSource(`spending-${period.id}-${category ?? "all"}`, `${label} calculation`, period);
  sourceReferences.push(calculation);
  const current = spendingTotals(transactions, period, category);
  const previous = spendingTotals(transactions, comparisonPeriod, category);
  const percentage = percentChange(current.amountMinorUnits, previous.amountMinorUnits);
  const transactionSourceRefs = [...current.transactions, ...previous.transactions].map((transaction) => transactionSource(transaction, withinPeriod(transaction, period) ? period : comparisonPeriod));
  sourceReferences.push(...transactionSourceRefs);
  const uniqueSourceReferences = dedupeSourceReferences(sourceReferences);

  if (intent === "transactions") {
    const relevant = current.transactions.length > 0 ? current.transactions : previous.transactions;
    const items = relevant.slice(0, 12).map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      cardId: transaction.cardId,
      label: transaction.counterparty ?? transaction.description,
      date: transaction.transactionDate,
      amountMinorUnits: transaction.amountMinorUnits,
      direction: transaction.direction,
      status: transaction.status,
      sourceReferenceId: `source:transaction:${transaction.id}`,
    }));
    return {
      explanation: relevant.length
        ? `Here are the posted ${label.toLocaleLowerCase()} transactions in ${formatPeriodText(current.transactions.length > 0 ? period : comparisonPeriod)}. Pending and failed items are not included in the spending total.`
        : `I could not find posted ${label.toLocaleLowerCase()} transactions in the selected periods. That is different from treating missing data as zero.`,
      blocks: items.length ? [{ type: "transactionList", id: createId("block"), title: `${label} transactions`, transactionIds: items.map((item) => item.id), items }] : [{ type: "dataUnavailable", id: createId("block"), title: "No posted transactions found", reason: "No matching posted rows were returned for the selected scope and period.", retryable: true }],
      sourceReferences: uniqueSourceReferences,
      contextPatch: { topic: "spending", period, comparisonPeriod, category },
      assumptions: [],
      limitations: current.pendingMinorUnits || current.failedMinorUnits ? ["Pending and failed rows are shown separately when present and are not part of the posted total."] : [],
      suggestedFollowUps: ["Compare this with the previous month", "Show the spending breakdown"],
    };
  }

  if (intent === "comparison") {
    const comparisonBlock: CoachAnswerBlock = {
      type: "spendingComparison",
      id: createId("block"),
      categoryLabel: label,
      current: { period, amountMinorUnits: current.amountMinorUnits, count: current.count },
      previous: { period: comparisonPeriod, amountMinorUnits: previous.amountMinorUnits, count: previous.count },
      differenceMinorUnits: current.amountMinorUnits - previous.amountMinorUnits,
      percentageChange: percentage,
      pendingMinorUnits: current.pendingMinorUnits,
      failedMinorUnits: current.failedMinorUnits,
      sourceReferenceIds: uniqueSourceReferences.filter((source) => source.kind === "transaction" || source.kind === "calculation").map((source) => source.id),
    };
    const direction = current.amountMinorUnits >= previous.amountMinorUnits ? "increased" : "decreased";
    return {
      explanation: `${label} ${direction} from ${formatIndianMinorUnits(previous.amountMinorUnits)} in ${comparisonPeriod.label.split(" · ")[1]} to ${formatIndianMinorUnits(current.amountMinorUnits)} in ${period.label.split(" · ")[1]}. That is a ${formatIndianMinorUnits(Math.abs(current.amountMinorUnits - previous.amountMinorUnits))} ${direction === "increased" ? "increase" : "decrease"}${percentage === undefined ? "; a percentage is not shown because the comparison baseline is zero" : ` (${formatPercentage(Math.abs(percentage))})`}.`,
      blocks: [comparisonBlock],
      sourceReferences: uniqueSourceReferences,
      contextPatch: { topic: "spending", period, comparisonPeriod, category },
      assumptions: [],
      limitations: ["The current September period is still in progress as of the demo data timestamp; the displayed comparison uses rows recorded for the stated calendar periods."],
      suggestedFollowUps: ["Show the transactions behind this", category ? "Compare another category" : "Show the category breakdown"],
    };
  }

  if (intent === "recurring") {
    const recurring = transactions.filter((transaction) => transaction.category === "transfer" || transaction.category === "bill" || transaction.category === "deposit").filter((transaction) => transaction.status === "posted").slice(0, 8);
    const refs = recurring.map((transaction) => transactionSource(transaction, period));
    sourceReferences.push(...refs.filter((ref) => !sourceReferences.some((existing) => existing.id === ref.id)));
    return {
      explanation: recurring.length
        ? `I found ${recurring.length} posted recurring-looking commitment rows in the available data. These are patterns to review, not confirmed contracts or subscriptions.`
        : "I could not identify enough repeated posted rows to call a commitment recurring. A missing row is not treated as zero.",
      blocks: recurring.length ? [{ type: "transactionList", id: createId("block"), title: "Recurring-looking rows to review", transactionIds: recurring.map((transaction) => transaction.id), items: recurring.map((transaction) => ({ id: transaction.id, accountId: transaction.accountId, cardId: transaction.cardId, label: transaction.counterparty ?? transaction.description, date: transaction.transactionDate, amountMinorUnits: transaction.amountMinorUnits, direction: transaction.direction, status: transaction.status, sourceReferenceId: `source:transaction:${transaction.id}` })) }] : [{ type: "dataUnavailable", id: createId("block"), title: "Recurring pattern not confirmed", reason: "The available demo history does not contain enough repeated posted rows.", retryable: true }],
      sourceReferences: dedupeSourceReferences(sourceReferences),
      contextPatch: { topic: "recurring", period },
      assumptions: ["Recurring-looking is an inference from repeated bank-recorded rows; it is not a merchant or contract verification."],
      limitations: ["The demo history is limited and does not include subscription metadata."],
      suggestedFollowUps: ["Show the rows behind this", "Compare this month with the previous month"],
    };
  }

  const categoryTotals = new Map<TransactionCategory, SpendingTotals>();
  for (const candidate of ["food", "shopping", "bill", "cash", "other"] as TransactionCategory[]) {
    const totals = spendingTotals(transactions, period, candidate);
    if (totals.amountMinorUnits > 0) categoryTotals.set(candidate, totals);
  }
  const breakdownItems = [...categoryTotals.entries()]
    .sort((left, right) => right[1].amountMinorUnits - left[1].amountMinorUnits)
    .map(([itemCategory, totals]) => ({
      category: itemCategory,
      label: categoryLabel(itemCategory),
      amountMinorUnits: totals.amountMinorUnits,
      count: totals.count,
      sourceReferenceId: calculation.id,
    }));
  const total = [...categoryTotals.values()].reduce((sum, item) => sum + item.amountMinorUnits, 0);
  return {
    explanation: total > 0
      ? `In ${period.label.split(" · ")[1]}, the selected scope recorded ${formatIndianMinorUnits(total)} of posted consumption after excluding own-account transfers, deposits, pending rows, failed rows, and card repayments.`
      : "I could not find posted consumption in the selected scope and period. I have not converted missing or unavailable data into a zero balance.",
    blocks: breakdownItems.length ? [{ type: "categoryBreakdown", id: createId("block"), period, items: breakdownItems }] : [{ type: "dataUnavailable", id: createId("block"), title: "No posted consumption found", reason: "No matching posted consumption rows were returned for this scope and period.", retryable: true }],
    sourceReferences: uniqueSourceReferences,
    contextPatch: { topic: "spending", period, comparisonPeriod, category },
    assumptions,
    limitations: ["Category totals use the transaction category supplied by the shared banking service; merchant descriptions are treated as untrusted data."],
    suggestedFollowUps: ["Compare Food & Dining with the previous month", "Show the transactions behind this"],
  };
}

function dedupeSourceReferences(references: CoachSourceReference[]): CoachSourceReference[] {
  return [...new Map(references.map((reference) => [reference.id, reference])).values()];
}

function validateAnswer(answer: CoachAnswer): void {
  const sourceIds = new Set(answer.sourceReferences.map((source) => source.id));
  const supportedTypes = new Set(["text", "metricSummary", "spendingComparison", "categoryBreakdown", "transactionList", "goalProgress", "goalScenario", "clarification", "dataUnavailable"]);
  for (const block of answer.blocks) {
    if (!supportedTypes.has(block.type)) throw new Error("Unsupported Coach response block");
    if ("sourceReferenceId" in block && block.sourceReferenceId && !sourceIds.has(block.sourceReferenceId)) throw new Error("Coach response referenced an unknown source");
    if (block.type === "spendingComparison" && block.sourceReferenceIds.some((id) => !sourceIds.has(id))) throw new Error("Coach response referenced an unknown comparison source");
    if (block.type === "transactionList" && block.items.some((item) => !sourceIds.has(item.sourceReferenceId))) throw new Error("Coach response referenced an unknown transaction source");
  }
}

const testCoachModel = {
  async generate(input: { question: string; explanation: string; modelStatus: CoachModelStatus }): Promise<string> {
    void input.question;
    void input.modelStatus;
    return input.explanation;
  },
};

export async function saveCoachGoal(
  customerId: string | null | undefined,
  input: {
    idempotencyKey: string;
    conversationId: string;
    sourceAnswerMessageId: string;
    name: string;
    targetMinorUnits: number;
    allocatedMinorUnits: number;
    monthlyContributionMinorUnits: number;
    targetDate?: string;
  },
): Promise<SavedCoachGoal> {
  const scopedCustomerId = customerScope(customerId);
  if (await getCoachConsent(scopedCustomerId) !== "granted") throw new Error("Coach personalisation access is required to save a goal");
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, input.conversationId);
  const answerMessage = conversation.messages.find((message) => message.id === input.sourceAnswerMessageId && message.role === "assistant" && message.answer);
  if (!answerMessage?.answer) throw new Error("The reviewed Coach answer is unavailable");
  if (!Number.isInteger(input.targetMinorUnits) || !Number.isInteger(input.allocatedMinorUnits) || !Number.isInteger(input.monthlyContributionMinorUnits) || input.targetMinorUnits <= input.allocatedMinorUnits || input.monthlyContributionMinorUnits <= 0) {
    throw new Error("Review the goal amounts before saving");
  }
  const existing = state.goals.find((goal) => goal.idempotencyKey === input.idempotencyKey);
  if (existing) return clone(existing);
  const saved: SavedCoachGoal = {
    id: createId("goal"),
    idempotencyKey: input.idempotencyKey,
    conversationId: conversation.id,
    name: input.name.trim().slice(0, 80) || "Savings goal",
    targetMinorUnits: input.targetMinorUnits,
    allocatedMinorUnits: input.allocatedMinorUnits,
    monthlyContributionMinorUnits: input.monthlyContributionMinorUnits,
    targetDate: input.targetDate,
    createdAt: now(),
    sourceAnswerMessageId: input.sourceAnswerMessageId,
    sourceEnvironment: "Demo data",
  };
  state.goals.push(saved);
  await persistState(scopedCustomerId, state);
  return clone(saved);
}

export async function listSavedCoachGoals(customerId?: string | null): Promise<SavedCoachGoal[]> {
  return clone((await loadState(customerId)).goals);
}

export async function saveCoachReport(
  customerId: string | null | undefined,
  input: { idempotencyKey: string; conversationId: string; answerMessageId: string; title?: string },
): Promise<SavedCoachReport> {
  const scopedCustomerId = customerScope(customerId);
  if (await getCoachConsent(scopedCustomerId) !== "granted") throw new Error("Coach personalisation access is required to save a report");
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, input.conversationId);
  const answerMessage = conversation.messages.find((message) => message.id === input.answerMessageId && message.role === "assistant" && message.answer);
  if (!answerMessage?.answer) throw new Error("The reviewed Coach answer is unavailable");
  const existing = state.reports.find((report) => report.idempotencyKey === input.idempotencyKey);
  if (existing) return clone(existing);
  const report: SavedCoachReport = {
    id: createId("report"),
    idempotencyKey: input.idempotencyKey,
    conversationId: conversation.id,
    title: input.title?.trim().slice(0, 80) || "Wealth Coach summary",
    answer: clone(answerMessage.answer),
    createdAt: now(),
    sourceEnvironment: "Demo data",
    demoIndicator: "Demo data",
  };
  state.reports.push(report);
  await persistState(scopedCustomerId, state);
  return clone(report);
}

export async function listSavedCoachReports(customerId?: string | null): Promise<SavedCoachReport[]> {
  return clone((await loadState(customerId)).reports);
}

export async function clearCoachState(customerId?: string | null): Promise<void> {
  const scopedCustomerId = customerScope(customerId);
  inMemoryState.delete(scopedCustomerId);
  await persistState(scopedCustomerId, emptyState());
}

export type { CoachScopeInput, CoachMessageResult, SubmitCoachMessageOptions };
