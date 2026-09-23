import type { TransactionCategory } from "@/types/banking";

export type CoachConsentStatus = "not-requested" | "granted" | "declined";

export type CoachScopeKind = "personal" | "account" | "card" | "goal";

export type CoachScope = {
  kind: CoachScopeKind;
  accountIds: string[];
  cardIds: string[];
  goalId?: string;
  label: string;
};

export type CoachPeriod = {
  id: "current-month" | "previous-month" | "all-available";
  label: string;
  from: string;
  to: string;
  isComplete: boolean;
};

export type CoachConversationContext = {
  scope: CoachScope;
  topic?: "spending" | "cash-flow" | "goals" | "recurring" | "education";
  period?: CoachPeriod;
  comparisonPeriod?: CoachPeriod;
  category?: TransactionCategory;
  selectedTransactionId?: string;
  selectedGoalId?: string;
  goalScenario?: GoalScenario;
};

export type CoachSourceReference = {
  id: string;
  kind: "account" | "card" | "transaction" | "goal" | "calculation";
  label: string;
  accountId?: string;
  cardId?: string;
  transactionId?: string;
  period?: CoachPeriod;
  sourceEnvironment: string;
  capturedAt: string;
};

export type CoachMetric = {
  key: string;
  label: string;
  valueMinorUnits?: number;
  value?: number;
  displayValue: string;
  unit: "INR" | "percentage" | "count" | "text";
  sourceReferenceId?: string;
};

export type CoachAnswerBlock =
  | {
      type: "text";
      id: string;
      text: string;
    }
  | {
      type: "metricSummary";
      id: string;
      metrics: CoachMetric[];
    }
  | {
      type: "spendingComparison";
      id: string;
      categoryLabel: string;
      current: { period: CoachPeriod; amountMinorUnits: number; count: number };
      previous: { period: CoachPeriod; amountMinorUnits: number; count: number };
      differenceMinorUnits: number;
      percentageChange?: number;
      pendingMinorUnits: number;
      failedMinorUnits: number;
      sourceReferenceIds: string[];
    }
  | {
      type: "categoryBreakdown";
      id: string;
      period: CoachPeriod;
      items: {
        category: string;
        label: string;
        amountMinorUnits: number;
        count: number;
        sourceReferenceId?: string;
      }[];
    }
  | {
      type: "transactionList";
      id: string;
      title: string;
      transactionIds: string[];
      items: {
        id: string;
        accountId?: string;
        cardId?: string;
        label: string;
        date: string;
        amountMinorUnits: number;
        direction: "credit" | "debit";
        status: string;
        sourceReferenceId: string;
      }[];
    }
  | {
      type: "goalProgress";
      id: string;
      goalId: string;
      name: string;
      targetMinorUnits: number;
      currentMinorUnits: number;
      remainingMinorUnits: number;
      progressPercentage: number;
      targetDate?: string;
      sourceReferenceId: string;
    }
  | {
      type: "goalScenario";
      id: string;
      goal: GoalScenario;
      options: GoalScenarioOption[];
      sourceReferenceId: string;
    }
  | {
      type: "clarification";
      id: string;
      question: string;
      options: string[];
    }
  | {
      type: "dataUnavailable";
      id: string;
      title: string;
      reason: string;
      retryable: boolean;
    };

export type CoachAnswer = {
  schemaVersion: "coach-answer.v1";
  messageId: string;
  conversationId: string;
  runId: string;
  answerStatus: "completed" | "partial" | "failed";
  blocks: CoachAnswerBlock[];
  scope: CoachScope;
  sourceReferences: CoachSourceReference[];
  dataAsOf: string;
  generatedAt: string;
  assumptions: string[];
  limitations: string[];
  suggestedFollowUps: string[];
  modelStatus: CoachModelStatus;
  dataEnvironment: string;
};

export type CoachModelStatus = "test-adapter" | "not-configured" | "server-provider";

export type GoalScenario = {
  name: string;
  targetMinorUnits: number;
  allocatedMinorUnits: number;
  remainingMinorUnits: number;
  targetDate?: string;
};

export type GoalScenarioOption = {
  monthlyContributionMinorUnits: number;
  months: number;
  finalContributionMinorUnits: number;
  label: string;
};

export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  runId?: string;
  status: "queued" | "retrieving" | "calculating" | "preparing" | "completed" | "partial" | "stopped" | "failed";
  answer?: CoachAnswer;
  errorMessage?: string;
};

export type CoachRun = {
  id: string;
  userMessageId: string;
  assistantMessageId?: string;
  status: CoachMessage["status"];
  sequence: number;
  createdAt: string;
  updatedAt: string;
};

export type CoachConversation = {
  id: string;
  environment: "demo";
  title: string;
  createdAt: string;
  updatedAt: string;
  context: CoachConversationContext;
  messages: CoachMessage[];
  runs: CoachRun[];
};

export type SavedCoachGoal = {
  id: string;
  idempotencyKey: string;
  conversationId: string;
  name: string;
  targetMinorUnits: number;
  allocatedMinorUnits: number;
  monthlyContributionMinorUnits: number;
  targetDate?: string;
  createdAt: string;
  sourceAnswerMessageId: string;
  sourceEnvironment: string;
};

export type SavedCoachReport = {
  id: string;
  idempotencyKey: string;
  conversationId: string;
  title: string;
  answer: CoachAnswer;
  createdAt: string;
  sourceEnvironment: "Demo data";
  demoIndicator: string;
};
