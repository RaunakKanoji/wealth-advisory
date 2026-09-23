import { fromMinorUnits, parseMinorUnits, percentageFromRatio } from "../lib/money.js";
import * as wealthRepository from "../db/repositories/wealth.repository.js";
import { ApiError } from "../lib/errors.js";

function goalDto(goal: Awaited<ReturnType<typeof wealthRepository.listGoals>>[number]) {
  return {
    id: goal.id,
    type: goal.type,
    title: goal.title,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    currency: goal.currency,
    targetDate: goal.targetDate,
    monthlyContribution: goal.monthlyContribution,
    status: goal.status,
    updatedAt: goal.updatedAt.toISOString(),
  };
}

type SnapshotForInsight = { month: string; savingsRate: string };

type SpendingComparison = Awaited<ReturnType<typeof wealthRepository.getCategorySpendingComparison>>;

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function categoryLabel(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/[-_]+/g, " ");
  if (normalized === "food dining" || normalized === "food") return "Food & Dining";
  if (!normalized) return "your spending";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayMoney(value: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `₹${value}`;
  return `₹${Math.abs(numericValue).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function displayPercent(value: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0%";
  return `${Math.abs(numericValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}%`;
}

function spendingInsightCopy(source: Record<string, unknown>, comparison: SpendingComparison) {
  const label = categoryLabel(typeof source.categoryLabel === "string" ? source.categoryLabel : typeof source.category === "string" ? source.category : undefined);
  const difference = Number(comparison.differenceAmount);
  const direction = difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged";
  const displayDirection = difference > 0 ? "more" : difference < 0 ? "less" : "the same amount";
  const comparisonDirection = difference > 0 ? "higher" : difference < 0 ? "lower" : "unchanged";
  const title = difference === 0
    ? `You spent the same amount on ${label}`
    : `You spent ${displayMoney(comparison.differenceAmount)} ${displayDirection} on ${label}`;
  const summary = Number(comparison.previousAmount) > 0
    ? `${displayPercent(comparison.percentageChange)} ${comparisonDirection} than last month.`
    : "There is not enough comparable history yet.";
  return { title, summary, label, direction };
}

function insightDto(
  insight: Awaited<ReturnType<typeof wealthRepository.listInsights>>[number],
  currentSnapshot?: SnapshotForInsight,
  comparison?: SpendingComparison,
) {
  const sourceSnapshot = typeof insight.sourceJson.snapshot === "string" ? insight.sourceJson.snapshot : undefined;
  const isCurrentSavingsInsight = insight.type === "savings"
    && currentSnapshot
    && sourceSnapshot
    && monthKey(sourceSnapshot) === monthKey(currentSnapshot.month);

  const source = comparison
    ? {
        ...insight.sourceJson,
        categoryLabel: spendingInsightCopy(insight.sourceJson, comparison).label,
        currentAmount: comparison.currentAmount,
        previousAmount: comparison.previousAmount,
        differenceAmount: comparison.differenceAmount,
        direction: spendingInsightCopy(insight.sourceJson, comparison).direction,
        period: comparison.period,
        comparisonPeriod: comparison.comparisonPeriod,
      }
    : insight.sourceJson;
  const spendingCopy = comparison ? spendingInsightCopy(source, comparison) : undefined;

  return {
    id: insight.id,
    type: insight.type,
    title: spendingCopy?.title ?? (isCurrentSavingsInsight ? "Your savings overview" : insight.title),
    summary: isCurrentSavingsInsight
      ? `Your savings rate is ${currentSnapshot.savingsRate}% for ${monthLabel(currentSnapshot.month)}.`
      : spendingCopy?.summary ?? insight.summary,
    severity: insight.severity,
    metricValue: isCurrentSavingsInsight ? currentSnapshot.savingsRate : comparison?.percentageChange ?? insight.metricValue,
    metricUnit: comparison ? "%" : insight.metricUnit,
    comparisonValue: isCurrentSavingsInsight ? null : comparison?.percentageChange ?? insight.comparisonValue,
    comparisonPeriod: isCurrentSavingsInsight ? null : comparison ? "last month" : insight.comparisonPeriod,
    source,
    actionRoute: insight.actionRoute,
    createdAt: insight.createdAt.toISOString(),
    expiresAt: insight.expiresAt?.toISOString() ?? null,
  };
}

function recommendationCopy(value: bigint): string {
  return `₹${Number(fromMinorUnits(value)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function buildRecommendations(
  snapshot: Awaited<ReturnType<typeof wealthRepository.getCurrentSnapshotFromTransactions>>,
  goals: Awaited<ReturnType<typeof wealthRepository.listGoals>>,
) {
  if (!snapshot) return [];

  const surplus = parseMinorUnits(snapshot.savings);
  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const recommendations: Array<{
    id: string;
    type: "increase_sip" | "goal_contribution";
    title: string;
    description: string;
    reason: string;
    actionLabel: string;
    amount: string;
    currency: string;
    priority: number;
    category: "investment" | "emergency-fund";
    route: string;
    isEligible: boolean;
    source: Record<string, unknown>;
  }> = [];

  const goal = activeGoals.find((item) => item.monthlyContribution && parseMinorUnits(item.monthlyContribution) > 0);
  if (surplus >= 1_000_000n && goal) {
    const safeIncrease = (surplus / 10n / 50_000n) * 50_000n;
    const amount = safeIncrease > 200_000n ? 200_000n : safeIncrease;
    if (amount > 0n) {
      recommendations.push({
        id: "increase-sip",
        type: "increase_sip",
        title: "Increase your SIP",
        description: "A measured increase can help you build wealth and reach your goals sooner.",
        reason: `Your latest posted activity leaves room after monthly expenses, with ${goal.title} still in progress.`,
        actionLabel: "Explore next step",
        amount: fromMinorUnits(amount),
        currency: "INR",
        priority: 1,
        category: "investment",
        route: "/(app)/coach/recommendation/increase-sip",
        isEligible: true,
        source: { snapshotMonth: snapshot.month, availableSurplus: snapshot.savings, goalId: goal.id },
      });
    }
  }

  const emergencyGoal = activeGoals.find((item) => item.type === "emergency_fund");
  if (emergencyGoal && parseMinorUnits(emergencyGoal.targetAmount) > parseMinorUnits(emergencyGoal.currentAmount)) {
    recommendations.push({
      id: "goal-contribution-emergency-fund",
      type: "goal_contribution",
      title: "Keep building your emergency fund",
      description: "A regular contribution can help close the remaining gap without losing sight of your other goals.",
      reason: `${recommendationCopy(parseMinorUnits(emergencyGoal.targetAmount) - parseMinorUnits(emergencyGoal.currentAmount))} remains on this goal.`,
      actionLabel: "Review goal",
      amount: emergencyGoal.monthlyContribution ?? "0.00",
      currency: emergencyGoal.currency,
      priority: 2,
      category: "emergency-fund",
      route: `/(app)/coach/goal/${emergencyGoal.id}`,
      isEligible: true,
      source: { goalId: emergencyGoal.id, remainingAmount: fromMinorUnits(parseMinorUnits(emergencyGoal.targetAmount) - parseMinorUnits(emergencyGoal.currentAmount)) },
    });
  }

  return recommendations;
}

export async function getSummary(userId: string) {
  const [_snapshots, goals, insights, derived] = await Promise.all([
    wealthRepository.listSnapshots(userId),
    wealthRepository.listGoals(userId),
    wealthRepository.listInsights(userId),
    wealthRepository.getCurrentSnapshotFromTransactions(userId),
  ]);
  const latest = derived;
  const snapshot = latest ? {
    month: latest.month,
    periodEnd: "periodEnd" in latest ? latest.periodEnd : null,
    scopeLabel: "scopeLabel" in latest ? latest.scopeLabel : null,
    income: latest.income,
    expenses: latest.expenses,
    savings: latest.savings,
    savingsRate: latest.savingsRate,
    spendingChangePercent: latest.spendingChangePercent,
    goalProgressPercent: percentageFromRatio(goals.reduce((sum,g)=>sum+parseMinorUnits(g.currentAmount),0n),goals.reduce((sum,g)=>sum+parseMinorUnits(g.targetAmount),0n)),
  } : null;
  const comparisons = await Promise.all(insights.map(async (insight) => {
    if (insight.type !== "spending" || typeof insight.sourceJson.category !== "string" || typeof insight.sourceJson.period !== "string") return [insight.id, undefined] as const;
    return [insight.id, await wealthRepository.getCategorySpendingComparison(userId, insight.sourceJson.category, insight.sourceJson.period)] as const;
  }));
  const comparisonById = new Map(comparisons);
  return {
    snapshot,
    goals: goals.map(goalDto),
    insights: insights.map((insight) => insightDto(insight, snapshot ?? undefined, comparisonById.get(insight.id))),
    recommendations: buildRecommendations(derived, goals),
  };
}

export async function listInsights(userId: string) {
  const [insights, currentSnapshot] = await Promise.all([
    wealthRepository.listInsights(userId),
    wealthRepository.getCurrentSnapshotFromTransactions(userId),
  ]);
  const comparisons = await Promise.all(insights.map(async (insight) => {
    if (insight.type !== "spending" || typeof insight.sourceJson.category !== "string" || typeof insight.sourceJson.period !== "string") return [insight.id, undefined] as const;
    return [insight.id, await wealthRepository.getCategorySpendingComparison(userId, insight.sourceJson.category, insight.sourceJson.period)] as const;
  }));
  const comparisonById = new Map(comparisons);
  return { items: insights.map((insight) => insightDto(insight, currentSnapshot ?? undefined, comparisonById.get(insight.id))) };
}

export async function listGoals(userId: string) {
  return { items: (await wealthRepository.listGoals(userId)).map(goalDto) };
}

export async function getGoal(userId: string, goalId: string) {
  const goal = await wealthRepository.getGoal(userId, goalId);
  if (!goal) throw new ApiError("GOAL_NOT_FOUND", "Goal not found.", 404);
  return goalDto(goal);
}
