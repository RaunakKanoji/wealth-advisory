import type Ionicons from "@expo/vector-icons/Ionicons";

import { formatINR } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { WealthInsight, WealthInsightType } from "@/types/wealth-coach";

export type InsightTone = "attention" | "positive" | "neutral";

export type InsightMetricDisplay = {
  accessibilityLabel: string;
  label: string;
  value: string;
};

export type InsightActivityParams = {
  category?: string;
  period: "all" | "last-month" | "this-month";
};

const typePriority: Record<WealthInsightType, number> = {
  "cash-flow": 0,
  spending: 1,
  savings: 2,
  goal: 3,
  "emergency-fund": 4,
  investment: 5,
  bills: 6,
  subscriptions: 7,
  debt: 8,
  protection: 9,
};

const severityPriority: Record<WealthInsight["severity"], number> = {
  attention: 0,
  neutral: 1,
  positive: 2,
};

export function sortInsights(insights: WealthInsight[]): WealthInsight[] {
  return [...insights].sort((left, right) => (
    severityPriority[left.severity] - severityPriority[right.severity]
    || typePriority[left.type] - typePriority[right.type]
  ));
}

export function toneForInsight(insight: WealthInsight): InsightTone {
  const spendingChange = finiteNumber(insight.comparison) ?? finiteNumber(insight.percentage);
  if (insight.type === "spending" && spendingChange !== undefined) {
    if (spendingChange < 0) return "positive";
    if (spendingChange > 0) return "attention";
  }
  if ((insight.type === "goal" || insight.type === "emergency-fund") && insight.severity !== "attention") {
    return "positive";
  }
  return insight.severity;
}

export function iconForInsight(type: WealthInsightType): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "spending":
      return "wallet-outline";
    case "savings":
      return "trending-up-outline";
    case "cash-flow":
      return "swap-vertical-outline";
    case "subscriptions":
    case "bills":
      return "receipt-outline";
    case "investment":
      return "bar-chart-outline";
    case "debt":
      return "card-outline";
    case "emergency-fund":
    case "goal":
      return "flag-outline";
    case "protection":
      return "shield-checkmark-outline";
  }
}

export function listMetricForInsight(insight: WealthInsight): InsightMetricDisplay | null {
  const percentage = finiteNumber(insight.percentage);
  if (percentage !== undefined) {
    return percentageMetric(insight, percentage);
  }

  const metric = finiteNumber(insight.metric);
  if (metric !== undefined) {
    return metricDisplay(insight, metric, insight.metricUnit ?? "number");
  }

  const amount = finiteNumber(insight.amount);
  return amount === undefined ? null : metricDisplay(insight, amount, "currency");
}

export function detailMetricForInsight(insight: WealthInsight): InsightMetricDisplay | null {
  const metric = finiteNumber(insight.metric);
  if (metric !== undefined) {
    return metricDisplay(insight, metric, insight.metricUnit ?? "number");
  }

  const percentage = finiteNumber(insight.percentage);
  if (percentage !== undefined) {
    return percentageMetric(insight, percentage);
  }

  const amount = finiteNumber(insight.amount);
  return amount === undefined ? null : metricDisplay(insight, amount, "currency");
}

export function comparisonMetricForInsight(insight: WealthInsight): InsightMetricDisplay | null {
  const comparison = finiteNumber(insight.comparison);
  if (comparison === undefined) return null;

  const isPercentage = finiteNumber(insight.percentage) !== undefined || insight.metricUnit === "percentage";
  const value = formatMetricValue(comparison, isPercentage ? "percentage" : insight.metricUnit ?? "number", insight.type === "spending");
  const period = insight.comparisonPeriod?.trim();
  const label = period ? `Compared with ${period}` : "Comparison";
  return {
    accessibilityLabel: `${label}: ${spokenMetricValue(comparison, isPercentage ? "percentage" : insight.metricUnit ?? "number")}`,
    label,
    value,
  };
}

export function questionForInsight(insight: WealthInsight, financialValuesVisible = true): string {
  const safeTitle = financialValuesVisible
    ? insight.title
    : privacySafeFinancialText(insight.title, "");
  const title = safeTitle.trim().replace(/[.!?]+$/, "");
  const period = insight.comparisonPeriod?.trim();
  return `Explain this Wealth Coach insight${title ? `: "${title}"` : ""}${period ? `, compared with ${period}` : ""}. Tell me what it means and what I should do next.`;
}

export function sourceLabelsForInsight(insight: WealthInsight, financialValuesVisible = true): string[] {
  const labels = (insight.sourceData ?? [])
    .map((label) => label.trim())
    .filter((label) => financialValuesVisible || privacySafeFinancialText(label, "") === label)
    .filter(Boolean);

  if (insight.source) {
    for (const [key, value] of Object.entries(insight.source)) {
      if (!financialValuesVisible && !/^(accountId|cardId|category|goalId|period|snapshot)$/.test(key)) continue;
      const sourceLabels = sourceValueLabels(key, value);
      labels.push(...(financialValuesVisible
        ? sourceLabels
        : sourceLabels.filter((label) => privacySafeFinancialText(label, "") === label)));
    }
  }

  return [...new Set(labels)];
}

export function activityParamsForInsight(insight: WealthInsight): InsightActivityParams | null {
  if (insight.type !== "spending") return null;

  const sourceCategory = typeof insight.source?.category === "string" ? insight.source.category : undefined;
  const category = activityCategory(sourceCategory) ?? activityCategoryFromLabels(insight.sourceData);
  const sourcePeriod = typeof insight.source?.period === "string" ? insight.source.period : undefined;
  const period = activityPeriod(sourcePeriod);
  const hasTransactionSource = insight.sourceData?.some((label) => /\btransactions?\b/i.test(label)) ?? false;
  const activityRouteSupplied = insight.route === "/(app)/activity" || insight.route === "/activity";

  if (!category && !period && !hasTransactionSource && !activityRouteSupplied) return null;
  return { category, period: period ?? "all" };
}

function percentageMetric(insight: WealthInsight, value: number): InsightMetricDisplay {
  return metricDisplay(insight, value, "percentage");
}

function metricDisplay(
  insight: WealthInsight,
  value: number,
  unit: NonNullable<WealthInsight["metricUnit"]>,
): InsightMetricDisplay {
  const label = metricLabel(insight, unit);
  return {
    accessibilityLabel: `${label}: ${spokenMetricValue(value, unit)}`,
    label,
    value: formatMetricValue(value, unit, insight.type === "spending"),
  };
}

function metricLabel(insight: WealthInsight, unit: NonNullable<WealthInsight["metricUnit"]>): string {
  if (insight.type === "spending" && unit === "percentage") return "Spending change";
  if (insight.type === "savings" && unit === "percentage") return "Savings rate";
  if ((insight.type === "goal" || insight.type === "emergency-fund") && unit === "percentage") return "Goal progress";
  if (unit === "currency") return "Amount";
  return "Insight metric";
}

function formatMetricValue(
  value: number,
  unit: NonNullable<WealthInsight["metricUnit"]>,
  showDirection: boolean,
): string {
  if (unit === "currency") return formatINR(value);
  if (unit === "percentage") return `${showDirection && value > 0 ? "+" : ""}${formatPercentage(value)}`;
  return `${showDirection && value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function spokenMetricValue(value: number, unit: NonNullable<WealthInsight["metricUnit"]>): string {
  if (unit === "currency") return formatINR(value);
  if (unit === "percentage") return `${formatPercentage(value).replace("%", "")} percent`;
  return formatNumber(value);
}

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(Math.round(value * 100) / 100);
  }
}

function finiteNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function sourceValueLabels(key: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => sourceValueLabels(key, item));
  }
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return [];

  const rawValue = String(value).trim();
  if (!rawValue) return [];
  const formattedKey = sourceKeyLabel(key);
  const formattedValue = sourceValueLabel(key, rawValue);
  return [`${formattedKey}: ${formattedValue}`];
}

function sourceKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    accountId: "Account",
    cardId: "Card",
    category: "Category",
    goalId: "Goal",
    period: "Period",
    snapshot: "Snapshot",
  };
  return labels[key] ?? humanize(key);
}

function sourceValueLabel(key: string, value: string): string {
  if (key === "period" || key === "snapshot") return formatPeriod(value);
  if (key === "goalId") return humanize(value.replace(/^goal[_-]/i, ""));
  if (key === "accountId" || key === "cardId") return value;
  return humanize(value);
}

function formatPeriod(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return humanize(value);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(date.getTime())) return humanize(value);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text[0].toLocaleUpperCase() + text.slice(1) : value;
}

function activityCategory(value?: string): string | undefined {
  if (!value) return undefined;
  const aliases: Record<string, string> = {
    food_dining: "food",
    utilities: "bill",
  };
  const category = aliases[value] ?? value.replace(/_/g, "-");
  const supported = ["bill", "cash", "deposit", "food", "interest", "other", "refund", "salary", "shopping", "transfer"];
  return supported.includes(category) ? category : undefined;
}

function activityCategoryFromLabels(labels?: string[]): string | undefined {
  const text = labels?.join(" ").toLocaleLowerCase() ?? "";
  if (/\b(food|dining)\b/.test(text)) return "food";
  if (/\b(utility|utilities|bill|bills)\b/.test(text)) return "bill";
  if (/\bshopping\b/.test(text)) return "shopping";
  if (/\btransfer|transfers\b/.test(text)) return "transfer";
  return undefined;
}

function activityPeriod(value?: string): InsightActivityParams["period"] | undefined {
  if (!value) return undefined;
  if (value === "this-month" || value === "last-month" || value === "all") return value;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return undefined;

  const sourceMonth = Number(match[1]) * 12 + Number(match[2]) - 1;
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  if (sourceMonth === currentMonth) return "this-month";
  if (sourceMonth === currentMonth - 1) return "last-month";
  return "all";
}
