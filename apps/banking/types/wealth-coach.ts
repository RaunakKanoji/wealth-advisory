export type FinancialMetric = {
  id: string;
  label: string;
  value: number;
  format: "percentage" | "currency" | "number";
  supportingLabel: string;
  trend?: "positive" | "negative" | "neutral";
  icon: string;
  showSign?: boolean;
};

export type WealthInsightType =
  | "spending"
  | "savings"
  | "cash-flow"
  | "subscriptions"
  | "bills"
  | "investment"
  | "debt"
  | "emergency-fund"
  | "goal"
  | "protection";

export type WealthInsight = {
  id: string;
  type: WealthInsightType;
  title: string;
  description: string;
  amount?: number;
  currentAmount?: number;
  previousAmount?: number;
  differenceAmount?: number;
  direction?: "increase" | "decrease" | "unchanged";
  category?: string;
  period?: string;
  percentage?: number;
  summary?: string;
  metric?: number;
  metricUnit?: "currency" | "percentage" | "number";
  comparison?: number;
  comparisonPeriod?: string;
  sourceData?: string[];
  source?: Record<string, unknown>;
  actions?: {
    label: string;
    kind: "view" | "ask";
  }[];
  severity: "positive" | "attention" | "neutral";
  route?: string;
};

export type FinancialGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercentage: number;
  gapAmount: number;
  targetDate?: string;
  monthlyContribution?: number;
  status?: "on-track" | "attention" | "completed";
};

export type CoachRecommendation = {
  id: string;
  title: string;
  description: string;
  reason: string;
  actionLabel: string;
  priority: number;
  category:
    | "investment"
    | "insurance"
    | "emergency-fund"
    | "retirement"
    | "tax";
  route: string;
  isEligible: boolean;
  amount?: number;
};

export type WealthCoachDashboard = {
  metrics: FinancialMetric[];
  insights: WealthInsight[];
  goals: FinancialGoal[];
  recommendations: CoachRecommendation[];
  periodLabel?: string;
  scopeLabel?: string;
};
