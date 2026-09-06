import type { TransactionCategory, TransactionStatus } from "@/types/banking";

export type CardProductKind = "debit" | "credit" | "unknown";
export type CardFormFactor = "physical" | "virtual";
export type CardLifecycleStatus =
  | "active"
  | "temporarily-disabled"
  | "blocked"
  | "expired"
  | "issuer-restricted"
  | "unknown";

export type CardChannel = "atm" | "in-store" | "online" | "contactless";
export type CardChannelGroup = "domestic" | "international";
export type CardControlState = "enabled" | "disabled";
export type CardMasterState = "on" | "off";
export type CardOperationStatus = "confirmed" | "pending" | "failed" | "unknown";
export type CardOperationKind = "master-state" | "channel-state" | "limit" | "hotlist";
export type DemoControlOutcome = "applied" | "rejected" | "pending" | "unknown";

export type CardCapabilitySet = {
  canTemporarilyDisable: boolean;
  canReenable: boolean;
  canManageDomesticUsage: boolean;
  canManageInternationalUsage: boolean;
  canManageLimits: boolean;
  canHotlist: boolean;
  canRequestReplacement: boolean;
  canViewStatements: boolean;
};

export type CardControl = {
  group: CardChannelGroup;
  channel: CardChannel;
  state: CardControlState;
  supported: boolean;
  unavailableReason?: string;
};

export type CardLimit = {
  id: string;
  label: string;
  group: CardChannelGroup;
  channel: CardChannel;
  period: "per-transaction" | "daily";
  amountMinorUnits: number;
  maximumMinorUnits: number;
  currency: "INR";
  resetTimeZone?: string;
};

export type CreditFacilitySummary = {
  id: string;
  facilityLabel: string;
  currentOutstandingMinorUnits?: number;
  availableCreditMinorUnits?: number;
  approvedCreditLimitMinorUnits?: number;
  statementTotalDueMinorUnits?: number;
  minimumAmountDueMinorUnits?: number;
  paymentDueDate?: string;
  statementPeriod?: string;
  paymentStatus?: "not-due" | "due" | "overdue" | "paid" | "unknown";
};

export type CardRecord = {
  id: string;
  providerReference: string;
  sourceEnvironment: "Demo data";
  productKind: CardProductKind;
  formFactor: CardFormFactor;
  productName: string;
  nickname?: string;
  lastFour: string;
  holderDisplayName?: string;
  expiryMonth?: number;
  expiryYear?: number;
  network?: string;
  linkedAccountId?: string;
  linkedCreditFacilityId?: string;
  lifecycleStatus: CardLifecycleStatus;
  capabilities: CardCapabilitySet;
  controls: CardControl[];
  limits: CardLimit[];
  creditFacility?: CreditFacilitySummary;
  demoControlOutcome: DemoControlOutcome;
  sourceRevision: number;
  lastSuccessfulUpdate: string;
};

export type CardTransactionType =
  | "purchase"
  | "cash-withdrawal"
  | "refund"
  | "reversal"
  | "fee"
  | "repayment"
  | "authorisation"
  | "declined";

export type CardTransaction = {
  id: string;
  sourceTransactionId: string;
  cardId: string;
  facilityId?: string;
  merchant?: string;
  description: string;
  amountMinorUnits: number;
  currency: "INR";
  direction: "debit" | "credit";
  status: TransactionStatus;
  transactionDate: string;
  postedDate?: string;
  transactionTime?: string;
  category?: TransactionCategory;
  channel?: CardChannel;
  transactionType: CardTransactionType;
  reference?: string;
  originalCurrency?: string;
  postedAmountMinorUnits?: number;
  linkedTransactionId?: string;
  associationKey?: string;
  sourceEnvironment: "Demo data";
};

export type CardTransactionPeriod = "all" | "this-month" | "last-month";

export type CardTransactionFilters = {
  search?: string;
  period?: CardTransactionPeriod;
  status?: TransactionStatus | "all";
  transactionType?: CardTransactionType | "all";
  category?: TransactionCategory | "all";
};

export type NormalizedCardTransactionFilters = {
  search: string;
  period: CardTransactionPeriod;
  status: TransactionStatus | "all";
  transactionType: CardTransactionType | "all";
  category: TransactionCategory | "all";
};

export type CardTransactionSummary = {
  postedPurchasesMinorUnits: number;
  postedCashWithdrawalsMinorUnits: number;
  postedFeesMinorUnits: number;
  postedRefundsMinorUnits: number;
  includedPurchaseCount: number;
  scopeLabel: string;
  coverageLabel: string;
};

export type CardTransactionPage = {
  items: CardTransaction[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: NormalizedCardTransactionFilters;
  summary: CardTransactionSummary;
};

export type CardControlOperation = {
  id: string;
  idempotencyKey: string;
  customerId: string;
  cardId: string;
  kind: CardOperationKind;
  requestedChange: string;
  beforeState: string;
  status: CardOperationStatus;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
  sourceEnvironment: "Demo data";
};

export type CardServiceRequest = {
  id: string;
  cardId: string;
  kind: "lost-stolen" | "replacement" | "help";
  status: CardOperationStatus;
  reason?: "lost" | "stolen";
  createdAt: string;
  sourceEnvironment: "Demo data";
};
