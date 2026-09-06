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
  sourceEnvironment: "Demo data";
  lastSuccessfulUpdate: string;
  holdsMinorUnits?: number;
  fixedDeposit?: FixedDepositDetails;
  recurringDeposit?: RecurringDepositDetails;
  capabilities: AccountCapabilities;
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
  sourceEnvironment: "Demo data";
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
