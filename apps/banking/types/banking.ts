export type AccountType =
  | "savings"
  | "current"
  | "salary"
  | "fixed-deposit"
  | "recurring-deposit";

export type AccountStatus = "active" | "inactive" | "matured";

export type TransactionDirection = "credit" | "debit";

export type TransactionStatus = "posted" | "pending" | "failed" | "reversed";

export type TransactionCategory =
  | "salary"
  | "shopping"
  | "food"
  | "bill"
  | "transfer"
  | "refund"
  | "cash"
  | "deposit"
  | "interest"
  | "other";

export type PaymentChannel =
  | "UPI"
  | "Card"
  | "NEFT"
  | "IMPS"
  | "ATM"
  | "Standing instruction"
  | "Branch";

/** Money values in the demo data are represented exactly in paise. */
export type MinorUnitAmount = {
  minorUnits: number;
  currency: "INR";
};

export type FixedDepositDetails = {
  principal: MinorUnitAmount;
  reportedCurrentValue?: MinorUnitAmount;
  startDate: string;
  maturityDate?: string;
  maturityValue?: MinorUnitAmount;
  interestRate?: string;
};

export type RecurringDepositDetails = {
  contributionAmount: MinorUnitAmount;
  contributionFrequency: "Monthly" | "Quarterly";
  contributionsRecorded: number;
  reportedBalance: MinorUnitAmount;
  startDate: string;
  maturityDate?: string;
  nextContributionDate?: string;
};

export type AccountCapabilities = {
  canSetPrimary: boolean;
  canManageCard: boolean;
  canExportTransactions: boolean;
};

export type BankAccount = {
  id: string;
  name: string;
  nickname?: string;
  type: AccountType;
  /** Legacy major-unit value kept for existing cards; calculations use minorUnits. */
  balance: number;
  balanceMinorUnits: number;
  /** False when no balance snapshot exists; numeric compatibility fields must not be presented as real zero. */
  balanceDataAvailable?: boolean;
  availableBalance?: number;
  availableBalanceMinorUnits?: number;
  ledgerBalance?: number;
  ledgerBalanceMinorUnits?: number;
  lastFour: string;
  currency: "INR";
  isPrimary: boolean;
  status: AccountStatus;
  cardAvailable?: boolean;
  maturityDate?: string;
  holderDisplayName: string;
  branch?: string;
  ifsc?: string;
  openingDate?: string;
  ownershipMode?: string;
  sourceEnvironment: string;
  lastSuccessfulUpdate: string;
  holdsMinorUnits?: number;
  fixedDeposit?: FixedDepositDetails;
  recurringDeposit?: RecurringDepositDetails;
  capabilities: AccountCapabilities;
};

export type AccountOverviewAction =
  | "transfer"
  | "statement"
  | "details"
  | "maturity"
  | "schedule";

type AccountOverviewBase = {
  /** Original domain record retained for existing details and action routes. */
  account: BankAccount;
  id: string;
  type: AccountType;
  displayName: string;
  typeLabel: string;
  lastFour: string;
  isPrimary: boolean;
  status: AccountStatus;
  mainBalanceLabel: string;
  /** `null` means the source did not provide this value; zero remains a real zero. */
  mainBalanceMinorUnits: number | null;
  actions: readonly AccountOverviewAction[];
};

export type TransactionAccountOverview = AccountOverviewBase & {
  productKind: "transaction";
  type: "savings" | "current" | "salary";
  mainBalanceLabel: "Available balance";
  currentBalanceMinorUnits: number | null;
  actions: readonly ["transfer", "statement", "details"];
};

export type FixedDepositAccountOverview = AccountOverviewBase & {
  productKind: "fixed-deposit";
  type: "fixed-deposit";
  mainBalanceLabel: "Current value";
  principalMinorUnits: number | null;
  maturityValueMinorUnits: number | null;
  interestRate?: string;
  maturityDate?: string;
  actions: readonly ["maturity", "statement", "details"];
};

export type RecurringDepositAccountOverview = AccountOverviewBase & {
  productKind: "recurring-deposit";
  type: "recurring-deposit";
  mainBalanceLabel: "Current value";
  monthlyContributionMinorUnits: number | null;
  contributionFrequency?: RecurringDepositDetails["contributionFrequency"];
  nextDepositDate?: string;
  maturityDate?: string;
  actions: readonly ["schedule", "statement", "details"];
};

export type AccountOverviewItem =
  | TransactionAccountOverview
  | FixedDepositAccountOverview
  | RecurringDepositAccountOverview;

export type AccountsOverview = {
  summary: {
    totalBalanceMinorUnits: number | null;
    availableToSpendMinorUnits: number | null;
    depositBalanceMinorUnits: number | null;
    accountCount: number;
  };
  accounts: AccountOverviewItem[];
  meta: {
    lastUpdated: string | null;
    source: string | null;
  };
};

export type AccountTransaction = {
  id: string;
  sourceTransactionId: string;
  accountId: string;
  amountMinorUnits: number;
  currency: "INR";
  direction: TransactionDirection;
  status: TransactionStatus;
  transactionDate: string;
  postedDate?: string;
  valueDate?: string;
  transactionTime?: string;
  counterparty?: string;
  description: string;
  bankDescription: string;
  channel?: PaymentChannel;
  originalCategory: TransactionCategory;
  reference?: string;
  linkedTransactionId?: string;
  /** Stable relationship supplied by the transfer ledger for grouping, never inferred from amount/date. */
  activityGroupId?: string;
  sourceEnvironment: string;
  annotation?: {
    category?: TransactionCategory;
    note?: string;
  };
};

/** The compact activity shape used by Home. */
export type BankingActivity = {
  id: string;
  accountId?: string;
  title: string;
  timestamp: string;
  amount: number;
  amountMinorUnits?: number;
  direction: TransactionDirection;
  category: TransactionCategory;
};

export type WealthInsight = {
  id: string;
  title: string;
  comparisonLabel?: string;
  severity: "positive" | "neutral" | "attention";
  createdAt: string;
};
