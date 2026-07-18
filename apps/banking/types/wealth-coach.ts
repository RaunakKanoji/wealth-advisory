export type FinancialMetric = {
  id: string;
  label: string;
  value: number;
  format: "percentage" | "currency" | "number";
  supportingLabel: string;
  trend?: "positive" | "negative" | "neutral";
  icon: string;
};

export type WealthInsightType =
  | "spending"
  | "savings"
  | "investment"
  | "goal"
  | "protection";

export type WealthInsight = {
  id: string;
  type: WealthInsightType;
  title: string;
  description: string;
  amount?: number;
  percentage?: number;
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
};

export type CoachRecommendation = {
  id: string;
  title: string;
  category:
    | "investment"
    | "insurance"
    | "emergency-fund"
    | "retirement"
    | "tax";
  route: string;
  isEligible: boolean;
};

export type WealthCoachDashboard = {
  metrics: FinancialMetric[];
  insights: WealthInsight[];
  goals: FinancialGoal[];
  recommendations: CoachRecommendation[];
};
