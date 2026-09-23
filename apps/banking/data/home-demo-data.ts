import type { BankingActivity, WealthInsight } from "../types/banking";
import { DEMO_SCENARIO_DATE, demoTransactions } from "./accounts-demo-data";
import { demoInsights } from "./wealth-coach-demo-data";

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

const [demoCoachInsight] = demoInsights;

export const demoInsight: WealthInsight = {
  id: demoCoachInsight.id,
  title: demoCoachInsight.title,
  comparisonLabel: demoCoachInsight.summary,
  severity: demoCoachInsight.severity,
  createdAt: DEMO_SCENARIO_DATE,
};
