import type { PaymentChannel, TransactionCategory, TransactionDirection, TransactionStatus } from "@/types/banking";
import type { CardChannel } from "@/types/cards";

export type ActivityScopeMode = "all" | "accounts" | "cards" | "mixed";
export type ActivityPeriodPreset = "all" | "this-month" | "last-month" | "last-90-days" | "custom";
export type ActivitySort = "newest" | "oldest" | "amount-desc" | "amount-asc";
export type ActivitySourceKind = "account-ledger" | "card-event" | "transfer-group";
export type ActivityTransactionType =
  | "purchase"
  | "cash-withdrawal"
  | "refund"
  | "reversal"
  | "fee"
  | "repayment"
  | "authorisation"
  | "declined"
  | "transfer"
  | "deposit"
  | "salary"
  | "interest"
  | "other";

export type ActivityScope = {
  mode: ActivityScopeMode;
  accountIds: string[];
  cardIds: string[];
};

export type ActivityQueryInput = {
  scope?: Partial<ActivityScope>;
  search?: string;
  period?: ActivityPeriodPreset;
  fromDate?: string;
  toDate?: string;
  direction?: TransactionDirection | "all";
  transactionType?: ActivityTransactionType | "all";
  status?: TransactionStatus | "all";
  category?: TransactionCategory | "all";
  channel?: PaymentChannel | CardChannel | "all";
  minAmountMinorUnits?: number;
  maxAmountMinorUnits?: number;
  currency?: "INR" | "all";
  sort?: ActivitySort;
  page?: number;
  pageSize?: number;
};

export type NormalizedActivityQuery = {
  scope: ActivityScope;
  search: string;
  period: ActivityPeriodPreset;
  fromDate?: string;
  toDate?: string;
  direction: TransactionDirection | "all";
  transactionType: ActivityTransactionType | "all";
  status: TransactionStatus | "all";
  category: TransactionCategory | "all";
  channel: PaymentChannel | CardChannel | "all";
  minAmountMinorUnits?: number;
  maxAmountMinorUnits?: number;
  currency: "INR" | "all";
  sort: ActivitySort;
};

export type ActivitySourceReference = {
  kind: "account" | "card" | "account-transaction" | "card-transaction";
  id: string;
  accountId?: string;
  cardId?: string;
  label: string;
};

export type ActivityLedgerEntry = {
  id: string;
  accountId: string;
  direction: TransactionDirection;
  amountMinorUnits: number;
  status: TransactionStatus;
  transactionDate: string;
  reference?: string;
};

export type ActivityRecord = {
  id: string;
  sourceKind: ActivitySourceKind;
  title: string;
  description: string;
  amountMinorUnits: number;
  currency: "INR";
  direction: TransactionDirection | "transfer";
  status: TransactionStatus;
  transactionType: ActivityTransactionType;
  category: TransactionCategory;
  originalCategory?: TransactionCategory;
  channel?: PaymentChannel | CardChannel;
  transactionDate: string;
  postedDate?: string;
  valueDate?: string;
  transactionTime?: string;
  bankDescription?: string;
  reference?: string;
  originalCurrency?: string;
  postedAmountMinorUnits?: number;
  accountId?: string;
  cardId?: string;
  accountLabel?: string;
  cardLabel?: string;
  sourceEnvironment: string;
  sourceReferences: ActivitySourceReference[];
  ledgerEntries: ActivityLedgerEntry[];
  relatedRecordIds: string[];
  activityGroupId?: string;
  linkedActivityId?: string;
  movementFrom?: string;
  movementTo?: string;
  annotation?: { category?: TransactionCategory; note?: string };
  searchText?: string;
};

export type ActivitySummary = {
  accountCreditsMinorUnits: number;
  accountDebitsMinorUnits: number;
  netAccountMovementMinorUnits: number;
  cardPostedPurchasesMinorUnits: number;
  cardPostedRefundsMinorUnits: number;
  includedPostedCount: number;
  pendingCount: number;
  failedCount: number;
  scopeLabel: string;
  coverageLabel: string;
};

export type ActivityCoverage = {
  includedResources: string[];
  availableFrom?: string;
  availableTo?: string;
  lastSuccessfulUpdate?: string;
  sourceEnvironment: string;
  isPartial: boolean;
  note: string;
};

export type ActivityQuerySnapshot = {
  id: string;
  queryKey: string;
  dataRevision: string;
  generatedAt: string;
};

export type ActivityPage = {
  items: ActivityRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  query: NormalizedActivityQuery;
  summary: ActivitySummary;
  coverage: ActivityCoverage;
  snapshot: ActivityQuerySnapshot;
};

export type ActivityExportPreview = {
  scopeLabel: string;
  periodLabel: string;
  filterLabel: string;
  includedStatuses: string;
  format: "CSV";
  notePolicy: "Personal notes excluded";
  rowCount: number;
};

export type ActivityCsv = ActivityExportPreview & {
  filename: string;
  csv: string;
};
