import type {
  CoachRecommendation,
  FinancialGoal,
  FinancialMetric,
  WealthCoachDashboard,
  WealthInsight,
} from "@/types/wealth-coach";

import { DEMO_SCENARIO_DATE, demoTransactions } from "@/data/accounts-demo-data";
import { formatINR } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";

const currentMonth = DEMO_SCENARIO_DATE.slice(0, 7);
const previousMonth = "2026-08";
const postedTransactions = demoTransactions.filter(
  (transaction) => transaction.status === "posted" && transaction.transactionDate.startsWith(currentMonth),
);
const income = postedTransactions
  .filter((transaction) => transaction.direction === "credit")
  .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);
const expenses = postedTransactions
  .filter((transaction) => transaction.direction === "debit")
  .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);
const savingsRate = income > 0
  ? Math.round(((income - expenses) / income) * 10000) / 100
  : undefined;
const foodThisMonth = postedTransactions
  .filter((transaction) => transaction.direction === "debit" && transaction.originalCategory === "food")
  .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);
const foodPreviousMonth = demoTransactions
  .filter((transaction) => transaction.status === "posted" && transaction.transactionDate.startsWith(previousMonth) && transaction.direction === "debit" && transaction.originalCategory === "food")
  .reduce((total, transaction) => total + transaction.amountMinorUnits, 0);
const foodDifference = foodThisMonth - foodPreviousMonth;
const foodPercentage = foodPreviousMonth > 0
  ? Math.round((foodDifference / foodPreviousMonth) * 100)
  : undefined;

// Temporary normalized fixtures. Production data must come from the approved banking service.
export const demoMetrics: FinancialMetric[] = [
  {
    id: "income",
    label: "Income",
    value: income / 100,
    format: "currency",
    supportingLabel: "This month",
    trend: "positive",
    icon: "income",
  },
  {
    id: "expenses",
    label: "Expenses",
    value: expenses / 100,
    format: "currency",
    supportingLabel: "This month",
    trend: "neutral",
    icon: "expenses",
  },
  {
    id: "savings-rate",
    label: "Savings rate",
    value: savingsRate ?? Number.NaN,
    format: "percentage",
    supportingLabel: "This month",
    trend: "positive",
    icon: "piggy-bank",
  },
];

export const demoInsights: WealthInsight[] = [
  {
    id: "food-dining",
    type: "spending",
    title: "Food & Dining spending increased this month.",
    description: "Food & Dining spending increased this month.",
    amount: foodThisMonth / 100,
    metric: foodThisMonth / 100,
    metricUnit: "currency",
    percentage: foodPercentage,
    summary: foodPercentage === undefined
      ? `You recorded ${formatINR(foodThisMonth / 100)} in Food & Dining spending this month.`
      : `You recorded ${formatINR(foodThisMonth / 100)} this month, up ${formatINR(Math.abs(foodDifference) / 100)} (${formatPercentage(Math.abs(foodPercentage))}) from August 2026.`,
    comparison: foodPercentage,
    comparisonPeriod: "August 2026",
    sourceData: ["Food & Dining transactions", "August 2026 posted transactions"],
    source: { category: "food", period: "this-month" },
    actions: [
      { label: "View spending", kind: "view" },
      { label: "Ask Coach", kind: "ask" },
    ],
    severity: "attention",
    route: "/(app)/coach/insight/food-dining",
  },
  {
    id: "increase-sip",
    type: "investment",
    title: "Increase your SIP",
    description: "You can build wealth faster and reach your goals sooner.",
    amount: 2000,
    summary: "A small monthly increase could improve your long-term progress.",
    actions: [{ label: "Ask Coach", kind: "ask" }],
    severity: "positive",
    route: "/(app)/coach/insight/increase-sip",
  },
];

export const demoGoals: FinancialGoal[] = [
  {
    id: "retirement-fund",
    name: "Retirement Fund",
    targetAmount: 4000000,
    currentAmount: 2720000,
    progressPercentage: 68,
    gapAmount: 1280000,
    targetDate: "2045",
    monthlyContribution: 50000,
    status: "on-track",
  },
];

export const demoRecommendations: CoachRecommendation[] = [
  {
    id: "emergency-fund",
    title: "Build an emergency fund",
    description: "A financial buffer can help cover unexpected expenses without disrupting your other goals.",
    reason: "You do not have an emergency-fund goal set up yet.",
    actionLabel: "Set a target",
    priority: 2,
    category: "emergency-fund",
    route: "/(app)/coach/recommendation/emergency-fund",
    isEligible: true,
  },
  {
    id: "retirement-plan",
    title: "Start planning for retirement",
    description: "Explore how regular monthly contributions could grow toward your long-term goal.",
    reason: "You already have a Retirement Fund goal to build on.",
    actionLabel: "Explore plan",
    priority: 6,
    category: "retirement",
    route: "/(app)/coach/recommendation/retirement-plan",
    isEligible: true,
  },
];

export const demoWealthCoachDashboard: WealthCoachDashboard = {
  metrics: demoMetrics,
  insights: demoInsights,
  goals: demoGoals,
  recommendations: demoRecommendations,
  periodLabel: "1–30 Sep 2026",
  scopeLabel: "Posted transactions · as of 6 Sep 2026",
};
