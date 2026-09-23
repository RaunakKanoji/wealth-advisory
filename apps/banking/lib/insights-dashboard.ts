import type { WealthSummaryResponse, ApiTransaction } from "@/lib/api/types";
import { apiGoalToFinancialGoal, apiInsightToCoachWealthInsight, parseApiMoneyToMinorUnits } from "@/lib/api/view-models";
import type { FinancialGoal, WealthCoachDashboard, WealthInsight } from "@/types/wealth-coach";

export type InsightsFilter = "all" | "spending" | "saving" | "goals" | "bills";

export type InsightsSnapshot = {
  month?: string;
  periodLabel?: string;
  scopeLabel?: string;
  income: number | null;
  expenses: number | null;
  savings: number | null;
  savingsRate: number | null;
  spendingChangePercent: number | null;
};

export type MonthlyTrendPoint = {
  label: string;
  month: string;
  amount: number;
  isCurrent: boolean;
};

export type InsightsDashboard = {
  snapshot: InsightsSnapshot | null;
  insights: WealthInsight[];
  goals: FinancialGoal[];
  hasActivity: boolean;
  transactionsByMonth?: Record<string, ApiTransaction[]>;
};

const insightPriority: Record<string, number> = {
  spending: 32,
  "cash-flow": 28,
  bills: 27,
  subscriptions: 25,
  "emergency-fund": 23,
  goal: 22,
  savings: 20,
  debt: 19,
  investment: 15,
  protection: 12,
};

const severityWeight: Record<WealthInsight["severity"], number> = {
  attention: 30,
  neutral: 18,
  positive: 14,
};

export function remoteSummaryToInsightsDashboard(summary: WealthSummaryResponse): InsightsDashboard {
  const snapshot = summary.snapshot;
  const insights = summary.insights.map(apiInsightToCoachWealthInsight);
  const goals = summary.goals.map(apiGoalToFinancialGoal);
  const income = snapshot ? parseApiMoneyToMinorUnits(snapshot.income) / 100 : null;
  const expenses = snapshot ? parseApiMoneyToMinorUnits(snapshot.expenses) / 100 : null;
  const savings = snapshot ? parseApiMoneyToMinorUnits(snapshot.savings) / 100 : null;

  return {
    snapshot: snapshot ? {
      month: snapshot.month,
      periodLabel: snapshot.month,
      scopeLabel: snapshot.scopeLabel ?? undefined,
      income,
      expenses,
      savings,
      savingsRate: income !== null && income > 0 ? finiteNumber(snapshot.savingsRate) : null,
      spendingChangePercent: finiteNumber(snapshot.spendingChangePercent),
    } : null,
    insights,
    goals,
    hasActivity: Boolean(snapshot || insights.length || goals.length),
  };
}

export function demoDashboardToInsightsDashboard(dashboard: WealthCoachDashboard): InsightsDashboard {
  const income = dashboard.metrics.find((metric) => metric.id === "income")?.value;
  const expenses = dashboard.metrics.find((metric) => metric.id === "expenses")?.value;
  const savingsRate = dashboard.metrics.find((metric) => metric.id === "savings-rate")?.value;

  return {
    snapshot: income !== undefined || expenses !== undefined || savingsRate !== undefined ? {
      periodLabel: dashboard.periodLabel,
      scopeLabel: dashboard.scopeLabel,
      income: finiteNumber(income),
      expenses: finiteNumber(expenses),
      savings: income !== undefined && expenses !== undefined ? income - expenses : null,
      savingsRate: income !== undefined && income > 0 ? finiteNumber(savingsRate) : null,
      spendingChangePercent: null,
    } : null,
    insights: dashboard.insights,
    goals: dashboard.goals,
    hasActivity: Boolean(dashboard.metrics.length || dashboard.insights.length || dashboard.goals.length),
  };
}

export function rankInsights(insights: WealthInsight[]): WealthInsight[] {
  return [...insights].sort((left, right) => scoreInsight(right) - scoreInsight(left));
}

export function featuredInsight(insights: WealthInsight[]): WealthInsight | undefined {
  return rankInsights(insights)[0];
}

export function filterInsights(insights: WealthInsight[], filter: InsightsFilter): WealthInsight[] {
  if (filter === "all") return insights;
  return insights.filter((insight) => insightFilter(insight) === filter);
}

export function insightFilter(insight: WealthInsight): Exclude<InsightsFilter, "all"> {
  if (["spending", "subscriptions"].includes(insight.type)) return "spending";
  if (["savings", "cash-flow", "investment", "emergency-fund"].includes(insight.type)) return "saving";
  if (["goal"].includes(insight.type)) return "goals";
  if (["bills"].includes(insight.type)) return "bills";
  return "saving";
}

export function goalProgress(goal: FinancialGoal): { percentage: number; remaining: number; completed: boolean } {
  const percentage = goal.targetAmount > 0
    ? Math.min(100, Math.max(0, Math.round((goal.currentAmount / goal.targetAmount) * 100)))
    : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  return { percentage, remaining, completed: percentage >= 100 };
}

export function categoryTrendForInsight(
  insight: WealthInsight | undefined,
  transactionsByMonth: Record<string, ApiTransaction[]>,
  currentMonth: string,
): MonthlyTrendPoint[] {
  const category = typeof insight?.source?.category === "string" ? normalizeCategory(insight.source.category) : undefined;
  if (!category) return [];

  return monthSequence(currentMonth, 3).map((month) => ({
    month,
    label: monthLabel(month),
    amount: sumCategory(transactionsByMonth[month] ?? [], category),
    isCurrent: month === currentMonth,
  }));
}

export function normalizeCategory(value: string): string {
  if (value === "food_dining") return "food";
  if (value === "utilities") return "bill";
  return value.replace(/[_-]/g, " ").trim().toLocaleLowerCase();
}

function scoreInsight(insight: WealthInsight): number {
  const change = Math.abs(insight.comparison ?? insight.percentage ?? 0);
  const recency = insight.source?.period ? 8 : 0;
  const actionability = insight.route || insight.actions?.length ? 8 : 0;
  return (insightPriority[insight.type] ?? 10) + severityWeight[insight.severity] + Math.min(change, 30) + recency + actionability;
}

function sumCategory(transactions: ApiTransaction[], category: string): number {
  return transactions
    .filter((transaction) => transaction.direction === "debit" && transaction.status === "completed" && normalizeCategory(transaction.category ?? "other") === category)
    .reduce((sum, transaction) => sum + parseApiMoneyToMinorUnits(transaction.amount) / 100, 0);
}

function monthSequence(currentMonth: string, count: number): string[] {
  const [year, month] = currentMonth.split("-").map(Number);
  if (!year || !month) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - index - 1), 1));
    return date.toISOString().slice(0, 7);
  });
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
