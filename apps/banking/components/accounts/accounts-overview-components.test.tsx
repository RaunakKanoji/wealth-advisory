import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { demoAccounts } from "@/data/accounts-demo-data";
import { buildAccountsOverview, normalizeAccountOverviewItem } from "@/lib/account-overview";
import type { BankAccount } from "@/types/banking";

import { AccountListItem } from "./account-list-item";
import { AccountsBalanceCard } from "./accounts-balance-card";

describe("Accounts overview components", () => {
  const overview = buildAccountsOverview(demoAccounts);

  it("formats the canonical summary with one shared INR rule", async () => {
    const screen = await render(
      <AccountsBalanceCard
        availableToSpendMinorUnits={overview.summary.availableToSpendMinorUnits}
        depositBalanceMinorUnits={overview.summary.depositBalanceMinorUnits}
        isVisible
        onToggleVisibility={jest.fn()}
        totalBalanceMinorUnits={overview.summary.totalBalanceMinorUnits}
      />,
    );

    expect(screen.getByText("₹3,45,678.00")).toBeTruthy();
    expect(screen.getByText("₹2,25,000.00")).toBeTruthy();
    expect(screen.getByText("₹1,20,678.00")).toBeTruthy();
  });

  it("shows fixed-deposit value, rate, maturity and product actions", async () => {
    const onActionPress = jest.fn();
    const account = overview.accounts.find((item) => item.productKind === "fixed-deposit");
    expect(account).toBeDefined();
    const screen = await render(
      <AccountListItem
        account={account!}
        isBalanceVisible
        onActionPress={onActionPress}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Current value")).toBeTruthy();
    expect(screen.getByText("₹75,000.00")).toBeTruthy();
    expect(screen.getByText("6.75% p.a. · Matures 12 Jun 2027")).toBeTruthy();
    expect(screen.queryByText("Available balance")).toBeNull();
    expect(screen.getByLabelText(/Open Fixed Deposit/).props.accessibilityLabel).toContain(
      "Current value, ₹75,000.00",
    );
    expect(screen.getByLabelText(/Open Fixed Deposit/).props.accessibilityLabel).toContain(
      "6.75% p.a., Matures 12 Jun 2027",
    );
    fireEvent.press(screen.getByLabelText("Maturity for Fixed Deposit"));
    expect(onActionPress).toHaveBeenCalledWith("maturity");
  });

  it("shows recurring-deposit contribution, next date and Schedule action", async () => {
    const onActionPress = jest.fn();
    const account = overview.accounts.find((item) => item.productKind === "recurring-deposit");
    expect(account).toBeDefined();
    const screen = await render(
      <AccountListItem
        account={account!}
        isBalanceVisible
        onActionPress={onActionPress}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Monthly contribution")).toBeTruthy();
    expect(screen.getByText("₹5,000.00")).toBeTruthy();
    expect(screen.getByText("10 Oct 2026")).toBeTruthy();
    expect(screen.getByLabelText(/Open Recurring Deposit/).props.accessibilityLabel).toContain(
      "Monthly contribution, ₹5,000.00. Next deposit 10 Oct 2026",
    );
    fireEvent.press(screen.getByLabelText("Schedule for Recurring Deposit"));
    expect(onActionPress).toHaveBeenCalledWith("schedule");
  });

  it("does not expose private amounts in an account card accessibility label", async () => {
    const account = overview.accounts.find((item) => item.productKind === "recurring-deposit");
    expect(account).toBeDefined();
    const screen = await render(
      <AccountListItem
        account={account!}
        isBalanceVisible={false}
        onActionPress={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const accessibilityLabel = screen.getByLabelText(/Open Recurring Deposit/).props.accessibilityLabel;
    expect(accessibilityLabel).toContain("Current value, amount hidden");
    expect(accessibilityLabel).toContain("Monthly contribution, amount hidden");
    expect(accessibilityLabel).not.toContain("₹45,678.00");
    expect(accessibilityLabel).not.toContain("₹5,000.00");
  });

  it("renders zero as money and missing availability as unavailable", async () => {
    const zero = normalizeAccountOverviewItem(transactionAccount(0, "zero"));
    const unavailable = normalizeAccountOverviewItem(transactionAccount(undefined, "missing"));
    const screen = await render(
      <View>
        <AccountListItem
          account={zero}
          isBalanceVisible
          onActionPress={jest.fn()}
          onPress={jest.fn()}
        />
        <AccountListItem
          account={unavailable}
          isBalanceVisible
          onActionPress={jest.fn()}
          onPress={jest.fn()}
        />
      </View>,
    );
    expect(screen.getByText("₹0.00")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });
});

function transactionAccount(
  availableBalanceMinorUnits: number | undefined,
  id: string,
): BankAccount {
  return {
    id,
    name: "Savings Account",
    type: "savings",
    balance: 100,
    balanceMinorUnits: 10_000,
    availableBalance: availableBalanceMinorUnits === undefined
      ? undefined
      : availableBalanceMinorUnits / 100,
    availableBalanceMinorUnits,
    ledgerBalance: 100,
    ledgerBalanceMinorUnits: 10_000,
    lastFour: "1234",
    currency: "INR",
    isPrimary: false,
    status: "active",
    holderDisplayName: "Test customer",
    sourceEnvironment: "Test source",
    lastSuccessfulUpdate: "2026-09-20T08:00:00.000Z",
    capabilities: {
      canExportTransactions: true,
      canManageCard: true,
      canSetPrimary: true,
    },
  };
}
