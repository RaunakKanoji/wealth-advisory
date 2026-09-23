export type ApiAccount = {
  id: string;
  type: string;
  name: string;
  nickname: string;
  maskedAccountNumber: string;
  currency: string;
  isPrimary: boolean;
  status: string;
  branchName: string | null;
  ifsc: string | null;
  ledgerBalance: string;
  /** Null means the source did not report an available balance. */
  availableBalance: string | null;
  holds: string | null;
  asOf: string | null;
  updatedAt: string | null;
  sourceProvider: string;
  sourceEnvironment: string;
};

export type AccountsResponse = {
  accounts: ApiAccount[];
  summary: {
    totalBalance: string;
    availableToSpend: string;
    deposits: string;
    currency: string;
    updatedAt: string | null;
  };
  meta?: {
    source: "account_aggregator" | "demo" | string;
    lastUpdated: string | null;
    stale: boolean;
    accountCount: number;
  };
};

export type AAConsent = {
  id: string;
  provider: string;
  status: string;
  providerStatus: string | null;
  purposeCode: string;
  purposeText: string;
  fiTypes: string[];
  fiSections: string[];
  selectedAccountCount: number;
  consentStart: string | null;
  consentExpiry: string | null;
  requestedFrom: string;
  requestedTo: string;
  fetchType: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAAConsentResponse = { consent: AAConsent; redirectUrl: string };

export type ApiTransaction = {
  id: string;
  accountId: string;
  type: string;
  direction: "credit" | "debit";
  amount: string;
  currency: string;
  description: string;
  merchantName: string | null;
  category: string | null;
  categoryName: string | null;
  reference: string | null;
  transactionAt: string;
  status: string;
  metadata: Record<string, unknown>;
};

export type TransactionsResponse = { items: ApiTransaction[]; nextCursor: string | null };

export type ApiBeneficiary = {
  id: string;
  type: "bank" | "upi";
  name: string;
  nickname: string | null;
  maskedAccountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
  status: "active" | "cooling_off" | "disabled";
  coolingOffUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiTransfer = {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string | null;
  beneficiaryId: string | null;
  transferType: string;
  amount: string;
  currency: string;
  note: string | null;
  status: string;
  demoTransaction: boolean;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
};

export type ApiCard = {
  id: string;
  accountId: string | null;
  type: string;
  network: string;
  maskedCardNumber: string;
  nickname: string;
  status: string;
  expiryMonth: number;
  expiryYear: number;
  isPrimary: boolean;
  updatedAt: string;
  controls: {
    domesticEnabled: boolean;
    internationalEnabled: boolean;
    onlineEnabled: boolean;
    contactlessEnabled: boolean;
    atmEnabled: boolean;
    dailyPosLimit: string;
    dailyOnlineLimit: string;
    dailyAtmLimit: string;
  } | null;
};

export type ApiCardTransaction = {
  id: string;
  cardId: string;
  transactionId: string | null;
  merchantName: string;
  amount: string;
  currency: string;
  status: string;
  transactionAt: string;
  createdAt: string;
};

export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  destinationRoute: string | null;
  destinationParams: Record<string, string> | null;
  createdAt: string;
};

export type NotificationsResponse = { items: ApiNotification[]; unreadCount: number };

export type ApiService = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  iconKey: string;
  iconTone: string;
  route: string;
  searchTerms: string[];
  isFavorite: boolean;
  displayOrder: number;
};

export type ApiInsight = {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: string;
  metricValue: string | null;
  metricUnit: string | null;
  comparisonValue: string | null;
  comparisonPeriod: string | null;
  source: Record<string, unknown>;
  actionRoute: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export type ApiRecommendation = {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  actionLabel: string;
  amount: string | null;
  currency: string;
  priority: number;
  category: string;
  route: string;
  isEligible: boolean;
  source: Record<string, unknown>;
};

export type ApiGoal = {
  id: string;
  type: string;
  title: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string | null;
  monthlyContribution: string | null;
  status: string;
  updatedAt: string;
};

export type WealthSummaryResponse = {
  snapshot: {
    month: string;
    periodEnd?: string | null;
    scopeLabel?: string | null;
    income: string;
    expenses: string;
    savings: string;
    savingsRate: string;
    spendingChangePercent: string;
    goalProgressPercent: string;
  } | null;
  goals: ApiGoal[];
  insights: ApiInsight[];
  recommendations?: ApiRecommendation[];
};

export type ApiConversation = {
  id: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ApiCoachMetricCard = {
  type: "metric";
  title: string;
  value: string;
  description?: string;
};

export type ApiCoachStructuredCard = ApiCoachMetricCard | {
  type: string;
  title?: string;
  value?: string;
  description?: string;
};

export type ApiCoachSource = {
  id?: string;
  transactionIds?: string[];
  count?: number;
  type: string;
  label?: string;
  title?: string;
  period?: string;
};

export type ApiWealthAnalyticsResponse = {
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
  evidence: Array<{ type: string; metric?: string | null; transactionCount?: number | null; total?: number | null; period?: string | null; transactionIds?: string[] }>;
  followUps: string[];
  dataFreshness: { lastUpdated?: string | null; source?: string | null; [key: string]: string | null | undefined };
  context: Record<string, unknown>;
};

export type ApiCoachTransaction = { id: string; accountId: string | null; cardId: string | null; kind: 'account' | 'card'; amount: string; currency: string; direction: 'credit' | 'debit'; status: string; category: string; merchant: string; description: string; transactionAt: string };
export type ApiCoachStructuredPayload = {
  analysis?: ApiWealthAnalyticsResponse;
  goals?: {id:string;title:string;monthlyContribution:string|null;monthsToTarget?:string|null}[];
  chart?: {label:string;amount:string;count:number;percentage:string}[];
  transactions?: ApiCoachTransaction[];
  warnings?: string[];
  dataAsOf?: string | null;
  dataEnvironment?: string;
  incomplete?: boolean;
  consentRequired?: boolean;
  modelStatus?: string;
  error?: {code:string;retryable:boolean};
  cards?: ApiCoachStructuredCard[];
  sources?: ApiCoachSource[];
  suggestedPrompts?: string[];
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  structuredPayloadJson?: ApiCoachStructuredPayload | null;
  createdAt: string;
};

export type CoachConversationsResponse = {
  items: (ApiConversation & { messageCount: number })[];
};

export type CoachConversationMessagesResponse = {
  conversation: ApiConversation;
  messages: ApiMessage[];
};

export type CoachMessageResponse = {
  conversation: ApiConversation;
  message: ApiMessage;
  demo?: boolean;
};
