export type BankAccount = {
  id: string;
  name: string;
  type:
    | "savings"
    | "current"
    | "salary"
    | "fixed-deposit"
    | "recurring-deposit";
  availableBalance: number;
  lastFour: string;
  isPrimary: boolean;
  currency: "INR";
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
