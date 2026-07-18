export type AccountType =
  | "savings"
  | "current"
  | "salary"
  | "fixed-deposit"
  | "recurring-deposit";

export type BankAccount = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  availableBalance?: number;
  lastFour: string;
  currency: "INR";
  isPrimary: boolean;
  status: "active" | "inactive" | "matured";
  maturityDate?: string;
  cardAvailable?: boolean;
};

export type BankingActivity = {
  id: string;
  title: string;
  timestamp: string;
  amount: number;
  direction: "credit" | "debit";
  category:
    | "shopping"
    | "salary"
    | "transfer"
    | "card"
    | "bill"
    | "cash";
};

export type WealthInsight = {
  id: string;
  title: string;
  comparisonLabel?: string;
  severity: "positive" | "neutral" | "attention";
  createdAt: string;
};
