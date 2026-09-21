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
import { formatIndianMinorUnits } from "@/lib/currency";
import { generateCoachModelText } from "@/services/wealth-coach-model-service";
import type { AccountTransaction, TransactionCategory, TransactionStatus } from "@/types/banking";
import type { CardTransaction } from "@/types/cards";
import type {
  CoachAnswer,
  CoachAnswerBlock,
  CoachConsentStatus,
  CoachConversation,
  CoachConversationContext,
  CoachMessage,
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

type RunStateCallback = (state: CoachMessage["status"]) => void;
type RunCreatedCallback = (runId: string) => void;

type SubmitCoachMessageOptions = {
  customerId?: string | null;
  conversationId: string;
  text: string;
  signal?: AbortSignal;
  authToken?: string | null;
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
  sourceEnvironment: "Demo data";
};

type SpendingTotals = {
  amountMinorUnits: number;
  count: number;
  pendingMinorUnits: number;
  failedMinorUnits: number;
  transactions: UnifiedTransaction[];
};

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
const activeControllers = new Map<string, AbortController>();
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
}

async function loadState(customerId?: string | null): Promise<StoredCoachState> {
  const scopedCustomerId = customerScope(customerId);
  const existing = inMemoryState.get(scopedCustomerId);
  if (existing) return clone(existing);
  const stored = parseState(await readPersistedValue(scopedCustomerId));
  inMemoryState.set(scopedCustomerId, clone(stored));
  return clone(stored);
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
    const dashboard = await getWealthCoachDashboard();
    const goal = dashboard.goals.find((item) => item.id === input?.goalId);
    if (!goal) throw new Error("Goal unavailable or you do not have access to it");
    return {
      accounts,
      cards,
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

export async function listCoachConversations(customerId?: string | null): Promise<CoachConversation[]> {
  const state = await loadState(customerId);
  return clone(state.conversations).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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
    context: { scope: data.scope },
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
  if (isGeneralQuestion(text)) return false;
  return context.scope.kind !== "personal" || /\b(my|mine|spending|spent|money|account|card|goal|saving|save|income|balance|transaction|month)\b/i.test(text);
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
  return conversation.runs.find((run) => ["queued", "retrieving", "calculating", "preparing"].includes(run.status));
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
  options.onRunCreated?.(run.id);
  await persistState(scopedCustomerId, state);

  const result = await processCoachRun({
    customerId: scopedCustomerId,
    state,
    conversation,
    userMessage,
    run,
    signal: options.signal,
    authToken: options.authToken,
    onStateChange: options.onStateChange,
    onRunCreated: options.onRunCreated,
  });
  return result;
}

export async function retryCoachMessage(
  conversationId: string,
  userMessageId: string,
  options?: { customerId?: string | null; signal?: AbortSignal; authToken?: string | null; onStateChange?: RunStateCallback; onRunCreated?: RunCreatedCallback },
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
  options?.onRunCreated?.(run.id);
  userMessage.status = "queued";
  userMessage.errorMessage = undefined;
  await persistState(scopedCustomerId, state);
  return processCoachRun({
    customerId: scopedCustomerId,
    state,
    conversation,
    userMessage,
    run,
    signal: options?.signal,
    authToken: options?.authToken,
    onStateChange: options?.onStateChange,
    onRunCreated: options?.onRunCreated,
  });
}

type ProcessRunInput = {
  customerId: string;
  state: StoredCoachState;
  conversation: CoachConversation;
  userMessage: CoachMessage;
  run: CoachRun;
  signal?: AbortSignal;
  authToken?: string | null;
  onStateChange?: RunStateCallback;
  onRunCreated?: RunCreatedCallback;
};

async function processCoachRun(input: ProcessRunInput): Promise<CoachMessageResult> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  activeControllers.set(input.run.id, controller);
  const signal = controller.signal;
  const persist = async () => persistState(input.customerId, input.state);

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

    const scopeData = await resolveCoachScope(input.customerId, input.conversation.context.scope);
    input.conversation.context = {
      ...input.conversation.context,
      scope: scopeData.scope,
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

    const generation = await generateCoachModelText(
      {
        question: input.userMessage.content,
        explanation: analysis.explanation,
      },
      {
        authToken: input.authToken,
        signal,
      },
    );
    const generatedText = generation.text;
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
      modelStatus: generation.modelStatus,
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
    input.conversation.title = input.conversation.title === "New conversation"
      ? createConversationTitle(input.userMessage.content)
      : input.conversation.title;
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

function createConversationTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 39)}…` : normalized;
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

function resolvePeriod(text: string, context: CoachConversationContext): { period: CoachPeriod; comparisonPeriod: CoachPeriod } {
  const normalized = text.toLocaleLowerCase();
  if (normalized.includes("previous month") || normalized.includes("last month") || normalized.includes("august")) {
    return { period: periodFor("previous-month"), comparisonPeriod: periodFor("current-month") };
  }
  if (context.period && (normalized.includes("that") || normalized.includes("same") || normalized.includes("behind"))) {
    return { period: context.period, comparisonPeriod: context.comparisonPeriod ?? periodFor("previous-month") };
  }
  return { period: periodFor("current-month"), comparisonPeriod: periodFor("previous-month") };
}

function resolveCategory(text: string, context: CoachConversationContext): TransactionCategory | undefined {
  const normalized = text.toLocaleLowerCase();
  if (normalized.includes("food") || normalized.includes("dining") || normalized.includes("restaurant") || normalized.includes("delivery")) return "food";
  if (normalized.includes("shopping") || normalized.includes("grocery")) return "shopping";
  if (normalized.includes("bill") || normalized.includes("utility")) return "bill";
  return context.category;
}

function resolveIntent(text: string, context: CoachConversationContext): "comparison" | "transactions" | "breakdown" | "goal" | "recurring" | "education" | "overview" {
  const normalized = text.toLocaleLowerCase();
  if (isGeneralQuestion(text)) return "education";
  if (/emergency fund|goal|save\s+₹|save\s+rs|monthly contribution|put the difference|plan for/.test(normalized) || context.goalScenario && /₹|rs|monthly|contribution/.test(normalized)) return "goal";
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

  if (intent === "goal") {
    const { scenario, options } = buildGoalScenario(text, context);
    const source = calculationSource("goal-scenario", "No-growth goal scenario", undefined);
    sourceReferences.push(source);
    const selected = options.find((option) => option.monthlyContributionMinorUnits === parseMonthlyContribution(text, 5_000_00)) ?? options[0];
    return {
      explanation: `${scenario.name} has ${formatIndianMinorUnits(scenario.remainingMinorUnits)} remaining after ${formatIndianMinorUnits(scenario.allocatedMinorUnits)} already allocated. At ${formatIndianMinorUnits(selected.monthlyContributionMinorUnits)} per month, the no-growth plan takes ${selected.label.replace(`${formatIndianMinorUnits(selected.monthlyContributionMinorUnits)}/month · `, "")}. This is a planning illustration, not a guarantee or a money movement.`,
      blocks: [{ type: "goalScenario", id: createId("block"), goal: scenario, options, sourceReferenceId: source.id }],
      sourceReferences,
      contextPatch: { topic: "goals", goalScenario: scenario },
      assumptions: ["No investment growth, interest, tax, or fee is assumed."],
      limitations: ["The suggested target and allocated amount are demo scenario inputs; review them before saving a goal."],
      suggestedFollowUps: ["Use ₹7,000 per month", "Adjust the target date", "Review and save this goal"],
    };
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
  const calculation = calculationSource(`spending-${period.id}-${category ?? "all"}`, `${label} calculation`, period);
  sourceReferences.push(calculation);
  if (scopeData.scope.kind === "card") {
    scopeData.cards.filter((card) => scopeData.scope.cardIds.includes(card.id)).forEach((card) => sourceReferences.push(cardSource(card.id, `${card.productName} ${maskLastFour(card.lastFour)}`)));
  } else {
    scopeData.accounts.filter((account) => scopeData.scope.accountIds.includes(account.id)).forEach((account) => sourceReferences.push(accountSource(account.id, `${account.name} ${maskLastFour(account.lastFour)}`)));
  }
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
      explanation: `${label} ${direction} from ${formatIndianMinorUnits(previous.amountMinorUnits)} in ${comparisonPeriod.label.split(" · ")[1]} to ${formatIndianMinorUnits(current.amountMinorUnits)} in ${period.label.split(" · ")[1]}. That is a ${formatIndianMinorUnits(Math.abs(current.amountMinorUnits - previous.amountMinorUnits))} ${direction === "increased" ? "increase" : "decrease"}${percentage === undefined ? "; a percentage is not shown because the comparison baseline is zero" : ` (${Math.abs(percentage)}%)`}.`,
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
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, input.conversationId);
  if (await getCoachConsent(scopedCustomerId) !== "granted") throw new Error("Coach personalisation access is required to save a goal");
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
  const state = await loadState(scopedCustomerId);
  const conversation = requireConversation(state, input.conversationId);
  if (await getCoachConsent(scopedCustomerId) !== "granted") throw new Error("Coach personalisation access is required to save a report");
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
