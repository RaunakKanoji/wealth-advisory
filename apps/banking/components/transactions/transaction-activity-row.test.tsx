import { render } from "@testing-library/react-native";
import React from "react";

import type { ActivityRecord } from "@/types/transaction-explorer";

import { TransactionActivityRow } from "./transaction-activity-row";

const activity: ActivityRecord = {
  id: "activity-private",
  sourceKind: "account-ledger",
  title: "Neighbourhood Market",
  description: "Card purchase",
  amountMinorUnits: 125000,
  currency: "INR",
  direction: "debit",
  status: "posted",
  transactionType: "purchase",
  category: "shopping",
  transactionDate: "2026-09-20",
  sourceEnvironment: "Demo",
  sourceReferences: [],
  ledgerEntries: [],
  relatedRecordIds: [],
};

describe("TransactionActivityRow", () => {
  it("shows the INR amount and includes it in the accessibility label when visible", async () => {
    const screen = await render(
      <TransactionActivityRow activity={activity} isBalanceVisible onPress={jest.fn()} />,
    );

    expect(screen.getByText("-₹1,250.00")).toBeTruthy();
    expect(screen.getByLabelText(/Neighbourhood Market, Debit, -₹1,250\.00/)).toBeTruthy();
  });

  it("removes the amount from both visible and accessibility text when hidden", async () => {
    const screen = await render(
      <TransactionActivityRow activity={activity} isBalanceVisible={false} onPress={jest.fn()} />,
    );

    expect(screen.getByText("Amount hidden")).toBeTruthy();
    expect(screen.queryByText("-₹1,250.00")).toBeNull();
    expect(screen.getByLabelText(/Neighbourhood Market, Debit, amount hidden/)).toBeTruthy();
    expect(screen.queryByLabelText(/₹|1,250/)).toBeNull();
  });
});
