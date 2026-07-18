import type {
  CoachRecommendation,
  FinancialGoal,
  FinancialMetric,
  WealthCoachDashboard,
  WealthInsight,
} from "@/types/wealth-coach";

// Temporary normalized fixtures. Production data must come from the approved banking service.
export const demoMetrics: FinancialMetric[] = [
  {
    id: "spending-change",
    label: "Spending",
    value: 12,
    format: "percentage",
    supportingLabel: "vs last month",
    trend: "negative",
    icon: "trending-up",
  },
  {
    id: "savings-rate",
    label: "Savings",
    value: 28,
    format: "percentage",
    supportingLabel: "of income",
    trend: "positive",
    icon: "piggy-bank",
  },
  {
    id: "goal-progress",
    label: "Progress",
    value: 68,
    format: "percentage",
    supportingLabel: "avg across goals",
    trend: "positive",
    icon: "target",
  },
];

export const demoInsights: WealthInsight[] = [
  {
    id: "food-dining",
    type: "spending",
    title: "Food & Dining",
    description: "You spent more on Food & Dining this month.",
    amount: 4200,
    percentage: 18,
    severity: "attention",
    route: "/(app)/coach/insight/food-dining",
  },
  {
    id: "increase-sip",
    type: "investment",
    title: "Increase your SIP",
    description: "You can build wealth faster and reach your goals sooner.",
    amount: 2000,
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
  },
];

export const demoRecommendations: CoachRecommendation[] = [
  {
    id: "start-sip",
    title: "Start a New SIP",
    category: "investment",
    route: "/(app)/coach/recommendation/start-sip",
    isEligible: true,
  },
  {
    id: "health-insurance",
    title: "Health Insurance",
    category: "insurance",
    route: "/(app)/coach/recommendation/health-insurance",
    isEligible: true,
  },
  {
    id: "emergency-fund",
    title: "Emergency Fund",
    category: "emergency-fund",
    route: "/(app)/coach/recommendation/emergency-fund",
    isEligible: true,
  },
  {
    id: "retirement-plan",
    title: "Plan for Retirement",
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
};
