import type { BankingActivity, WealthInsight } from "../types/banking";
import { demoTransactions } from "./accounts-demo-data";

// Home and Accounts intentionally share the same account IDs and source data.
export { demoAccounts } from "./accounts-demo-data";

export const demoActivities: BankingActivity[] = demoTransactions
  .filter((transaction) => transaction.accountId === "savings-primary")
  .slice(0, 2)
  .map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    title: transaction.counterparty ?? transaction.description,
    timestamp: `${transaction.transactionDate}${transaction.transactionTime ? `, ${transaction.transactionTime}` : ""}`,
    amount: transaction.amountMinorUnits / 100,
    amountMinorUnits: transaction.amountMinorUnits,
    direction: transaction.direction,
    category: transaction.originalCategory,
  }));

export const demoInsight: WealthInsight = {
  id: "insight-shopping",
  title: "You've spent 12% more on shopping this month.",
  comparisonLabel: "vs last month",
  severity: "attention",
  createdAt: new Date().toISOString(),
};
