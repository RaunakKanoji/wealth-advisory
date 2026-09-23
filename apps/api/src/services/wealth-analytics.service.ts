import type { InitialScope } from "../coach/engine.js";
import { executeCoach, type CoachTools } from "../coach/engine.js";
import type { CoachContext } from "../coach/plan.js";
import { GeminiCoachModel } from "../coach/model.js";
import * as coachTools from "../coach/repository.js";
import type { CoachModel } from "../coach/model.js";
import { env, isDemoMode } from "../env.js";
import { ApiError } from "../lib/errors.js";

export type WealthAnalyticsResponse = {
  requestId: string;
  conversationId?: string | null;
  intent: string;
  answer: { title: string; summary: string; detail: string };
  period: { label: string; start: string; end: string };
  metrics: Array<{
    id: string;
    label: string;
    value: number | string;
    format: "currency" | "percentage" | "number" | "text";
    comparison?: { value?: number | null; direction?: "up" | "down" | "flat" | null; label?: string | null } | null;
  }>;
  charts: Array<{
    type: "donut" | "bar" | "horizontal_bar" | "line" | "stacked_bar" | "progress";
    title: string;
    data: Array<{ label: string; value: number; secondaryValue?: number | null }>;
  }>;
  table?: { columns: string[]; rows: unknown[][] } | null;
  insights: string[];
  recommendations: string[];
  evidence: Array<{
    type: string;
    metric?: string | null;
    transactionCount?: number | null;
    total?: number | null;
    period?: string | null;
    transactionIds?: string[];
  }>;
  followUps: string[];
  dataFreshness: { lastUpdated?: string | null; source?: string | null; [key: string]: string | null | undefined };
  context: Record<string, unknown>;
};

type AnalyticsQueryInput = {
  userId: string;
  question: string;
  conversationId?: string;
  requestId?: string;
  previous?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type CoachExecutionInput = Parameters<typeof executeCoach>[0];
type CoachExecutionResult = Awaited<ReturnType<typeof executeCoach>>;

export function isWealthAnalyticsConfigured(): boolean {
  return Boolean(env.VANNA_SERVICE_URL && env.VANNA_SERVICE_SECRET);
}

function serviceError(code: string, message: string, status: number, requestId?: string): ApiError & { requestId?: string } {
  const error = new ApiError(code, message, status);
  Object.defineProperty(error, "requestId", { value: requestId, enumerable: true });
  return error as ApiError & { requestId?: string };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function requestRemoteAnalytics(input: AnalyticsQueryInput): Promise<WealthAnalyticsResponse> {
  if (!isWealthAnalyticsConfigured()) {
    throw serviceError("VANNA_NOT_CONFIGURED", "The wealth analytics service is not configured.", 503, input.requestId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.VANNA_QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.VANNA_SERVICE_URL}/internal/query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-vanna-service-secret": env.VANNA_SERVICE_SECRET!,
        ...(input.requestId ? { "x-request-id": input.requestId } : {}),
      },
      body: JSON.stringify({
        question: input.question,
        conversationId: input.conversationId,
        requestId: input.requestId,
        userContext: {
          internalUserId: input.userId,
          groups: ["wealth_user"],
          mode: isDemoMode ? "demo" : "live",
        },
        context: {
          source: "wealth-coach",
          previous: input.previous,
          ...input.context,
        },
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => undefined) as unknown;
    if (!response.ok) {
      const errorBody = asRecord(body);
      const detail = asRecord(errorBody.detail);
      const code = typeof detail.code === "string" ? detail.code : "VANNA_QUERY_FAILED";
      const message = typeof detail.message === "string" ? detail.message : "The wealth analytics service could not answer this question.";
      throw serviceError(code, message, response.status === 422 ? 422 : 503, input.requestId);
    }
    return body as WealthAnalyticsResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw serviceError(timedOut ? "VANNA_TIMEOUT" : "VANNA_UNAVAILABLE", "The wealth analytics service is temporarily unavailable.", 503, input.requestId);
  } finally {
    clearTimeout(timeout);
  }
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodFromVerified(verified: Record<string, unknown> | undefined): { label: string; start: string; end: string } {
  const period = asRecord(verified?.period);
  const start = typeof period.from === "string" ? period.from : typeof period.to === "string" ? period.to : new Date().toISOString().slice(0, 10);
  const end = typeof period.to === "string" ? period.to : start;
  return { label: typeof period.label === "string" ? period.label : `${start} – ${end}`, start, end };
}

function normalizeLocalCoachResult(result: CoachExecutionResult, requestId: string, conversationId?: string): WealthAnalyticsResponse {
  const verified = "verified" in result && result.verified ? asRecord(result.verified) : undefined;
  const payload = asRecord(result.payload);
  const period = periodFromVerified(verified);
  const totalDebit = numberValue(verified?.totalDebit);
  const totalCredit = numberValue(verified?.totalCredit);
  const net = numberValue(verified?.net);
  const transactionCount = numberValue(verified?.transactionCount);
  const metric = (id: string, label: string, value: number, format: "currency" | "number" = "currency") => ({ id, label, value: Number(value.toFixed(2)), format });
  const chartRows = Array.isArray(payload.chart) ? payload.chart : [];
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const followUps = Array.isArray(payload.suggestedPrompts) ? payload.suggestedPrompts.filter((item): item is string => typeof item === "string") : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const consentRequired = payload.consentRequired === true;

  return {
    requestId,
    conversationId: conversationId ?? null,
    intent: asRecord(result.plan).intent as string ?? "clarification",
    answer: {
      title: consentRequired ? "Permission needed" : "Wealth Coach answer",
      summary: result.content,
      detail: typeof payload.dataEnvironment === "string" ? `Data environment: ${payload.dataEnvironment}.` : "Calculated from the linked financial records available to your profile.",
    },
    period,
    metrics: consentRequired ? [] : [metric("total-debit", "Expenses", totalDebit), metric("total-credit", "Income", totalCredit), metric("net", "Net cash flow", net), metric("transactions", "Transactions", transactionCount, "number")],
    charts: chartRows.length ? [{ type: "bar", title: "Financial breakdown", data: chartRows.map((row) => { const item = asRecord(row); return { label: String(item.label ?? "Other"), value: numberValue(item.amount), secondaryValue: null }; }) }] : [],
    table: transactions.length ? { columns: ["Merchant", "Amount", "Date"], rows: transactions.slice(0, 20).map((row) => { const item = asRecord(row); return [String(item.merchant ?? item.description ?? "Transaction"), numberValue(item.amount), String(item.transactionAt ?? "")]; }) } : null,
    insights: Array.isArray(payload.warnings) ? payload.warnings.filter((item): item is string => typeof item === "string") : [],
    recommendations: [],
    evidence: sources.map((source) => { const item = asRecord(source); return { type: String(item.type ?? "calculation"), metric: typeof item.label === "string" ? item.label : null, transactionCount: numberValue(item.count), transactionIds: Array.isArray(item.transactionIds) ? item.transactionIds.filter((id): id is string => typeof id === "string") : [] }; }),
    followUps,
    dataFreshness: { lastUpdated: typeof payload.dataAsOf === "string" ? payload.dataAsOf : null, source: typeof payload.dataEnvironment === "string" ? payload.dataEnvironment : null },
    context: asRecord(result.context),
  };
}

function legacyPlan(response: WealthAnalyticsResponse): Record<string, unknown> {
  const intentMap: Record<string, string> = {
    financial_overview: "spending_summary",
    expense_analysis: "category_breakdown",
    comparison: "spending_comparison",
    income_analysis: "income_analysis",
    savings_analysis: "saving_analysis",
    goal_analysis: "goal_progress",
    recurring_payment_analysis: "recurring_payments",
    merchant_analysis: "merchant_breakdown",
    wealth_analysis: "account_overview",
    scenario_analysis: "goal_simulation",
  };
  return { intent: intentMap[response.intent] ?? "clarification", filters: {}, grouping: "none", sort: "date_desc", limit: 20 };
}

function toLegacyCoachResult(response: WealthAnalyticsResponse, requestId: string): CoachExecutionResult {
  const plan = legacyPlan(response);
  const analysis = response;
  const payload = {
    analysis,
    cards: response.metrics.map((item) => ({ type: "metric", title: item.label, value: String(item.value) })),
    chart: response.charts[0]?.data.map((item) => ({ label: item.label, amount: item.value.toFixed(2), count: 0, percentage: "0" })) ?? [],
    sources: response.evidence.map((item) => ({ type: item.type, label: item.metric ?? item.period ?? "Verified financial data", period: item.period ?? response.period.label, transactionIds: item.transactionIds ?? [] })),
    suggestedPrompts: response.followUps,
    dataAsOf: response.dataFreshness.lastUpdated ?? null,
    dataEnvironment: response.dataFreshness.source ?? "live",
    warnings: response.insights,
    goals: [],
    transactions: [],
    recurring: [],
    incomplete: false,
    modelStatus: "vanna",
  };
  return {
    content: response.answer.summary,
    payload,
    plan,
    verified: {
      period: { from: response.period.start, to: response.period.end, label: response.period.label },
      dataAsOf: response.dataFreshness.lastUpdated ?? null,
      dataEnvironment: response.dataFreshness.source ?? "live",
      transactionCount: response.evidence.reduce((total, item) => total + (item.transactionCount ?? 0), 0),
      totalDebit: String(response.metrics.find((item) => item.id === "expenses")?.value ?? 0),
      totalCredit: String(response.metrics.find((item) => item.id === "income")?.value ?? 0),
      net: String(response.metrics.find((item) => item.id === "savings")?.value ?? 0),
      calculation: response.answer.detail,
    },
    sourceRecords: [],
    context: { ...response.context, answerId: requestId, plan, period: { from: response.period.start, to: response.period.end, label: response.period.label }, transactionIds: [] },
  } as unknown as CoachExecutionResult;
}

export async function queryWealthAnalytics(input: AnalyticsQueryInput): Promise<WealthAnalyticsResponse> {
  if (isWealthAnalyticsConfigured()) return requestRemoteAnalytics(input);
  const result = await executeCoach({
    userId: input.userId,
    question: input.question,
    consent: true,
    previous: input.previous as CoachContext | undefined,
    history: [],
  }, new GeminiCoachModel(env.GEMINI_API_KEY, env.GEMINI_MODEL), coachTools);
  return normalizeLocalCoachResult(result, input.requestId ?? `analytics_${Date.now()}`, input.conversationId);
}

export async function executeCoachWithAnalytics(input: CoachExecutionInput, requestId: string, conversationId?: string): Promise<CoachExecutionResult> {
  // Consent remains in the existing Coach engine. Vanna only receives data after
  // the persisted Coach consent check has succeeded.
  if (!isWealthAnalyticsConfigured() || !input.consent) {
    return executeCoach(input, new GeminiCoachModel(env.GEMINI_API_KEY, env.GEMINI_MODEL), coachTools);
  }

  try {
    const response = await requestRemoteAnalytics({
      userId: input.userId,
      question: input.question,
      conversationId,
      requestId,
      previous: input.previous as unknown as Record<string, unknown> | undefined,
      context: { scope: input.scope ?? {} },
    });
    return toLegacyCoachResult(response, requestId);
  } catch (error) {
    // A Vanna outage must not break the existing Coach experience. Query the
    // verified Node engine, which uses the same owner-scoped Neon records.
    if (error instanceof ApiError && ["VANNA_TIMEOUT", "VANNA_UNAVAILABLE", "VANNA_NOT_CONFIGURED", "VANNA_QUERY_FAILED", "UNKNOWN_ERROR"].includes(error.code)) {
      return executeCoach(input, new GeminiCoachModel(env.GEMINI_API_KEY, env.GEMINI_MODEL), coachTools);
    }
    throw error;
  }
}

export function consentRequiredAnalytics(requestId: string, conversationId?: string): WealthAnalyticsResponse {
  return {
    requestId,
    conversationId: conversationId ?? null,
    intent: "clarification",
    answer: { title: "Permission needed", summary: "May Wealth Coach use your linked financial data to answer this question?", detail: "You can revoke this permission from the Coach header at any time." },
    period: { label: "Not selected", start: "", end: "" },
    metrics: [], charts: [], table: null, insights: [], recommendations: [], evidence: [], followUps: [], dataFreshness: { lastUpdated: null, source: null }, context: { consentRequired: true },
  };
}

export async function checkWealthAnalyticsHealth(): Promise<{ configured: boolean; reachable: boolean; service?: unknown }> {
  if (!isWealthAnalyticsConfigured()) return { configured: false, reachable: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(env.VANNA_QUERY_TIMEOUT_MS, 5_000));
  try {
    const response = await fetch(`${env.VANNA_SERVICE_URL}/health`, { headers: { "x-vanna-service-secret": env.VANNA_SERVICE_SECRET! }, signal: controller.signal });
    const service = await response.json().catch(() => undefined);
    return { configured: true, reachable: response.ok, service };
  } catch {
    return { configured: true, reachable: false };
  } finally {
    clearTimeout(timeout);
  }
}

export type { CoachTools };
