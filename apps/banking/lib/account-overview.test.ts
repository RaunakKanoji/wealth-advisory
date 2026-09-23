import { demoAccounts } from "@/data/accounts-demo-data";
import type { BankAccount } from "@/types/banking";

import { buildAccountsOverview, normalizeAccountOverviewItem } from "./account-overview";

function transactionAccount(
  availableBalanceMinorUnits: number | undefined,
): BankAccount {
  return {
    id: "test-account",
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
    isPrimary: true,
    status: "active",
    holderDisplayName: "Test customer",
    sourceEnvironment: "Test source",
    lastSuccessfulUpdate: "2026-09-20T08:00:00.000Z",
    capabilities: {
      canSetPrimary: true,
      canManageCard: true,
      canExportTransactions: true,
    },
  };
}

describe("accounts overview normalization", () => {
  it("keeps a genuine zero available balance distinct from an unavailable value", () => {
    const zero = normalizeAccountOverviewItem(transactionAccount(0));
    const unavailable = normalizeAccountOverviewItem(transactionAccount(undefined));

    expect(zero.productKind).toBe("transaction");
    expect(zero.mainBalanceMinorUnits).toBe(0);
    expect(unavailable.mainBalanceMinorUnits).toBeNull();
  });

  it("does not substitute ledger balance when available-to-spend is unavailable", () => {
    const overview = buildAccountsOverview([transactionAccount(undefined)]);

    expect(overview.summary.availableToSpendMinorUnits).toBeNull();
    expect(overview.summary.totalBalanceMinorUnits).toBeNull();
  });

  it("normalizes transaction and deposit products with product-specific actions", () => {
    const overview = buildAccountsOverview(demoAccounts);
    const fixedDeposit = overview.accounts.find((account) => account.productKind === "fixed-deposit");
    const recurringDeposit = overview.accounts.find((account) => account.productKind === "recurring-deposit");

    expect(overview.summary).toEqual({
      totalBalanceMinorUnits: 34_567_800,
      availableToSpendMinorUnits: 22_500_000,
      depositBalanceMinorUnits: 12_067_800,
      accountCount: 4,
    });
    expect(fixedDeposit).toMatchObject({
      mainBalanceLabel: "Current value",
      mainBalanceMinorUnits: 7_500_000,
      principalMinorUnits: 7_500_000,
      interestRate: "6.75% p.a.",
      actions: ["maturity", "statement", "details"],
    });
    expect(recurringDeposit).toMatchObject({
      mainBalanceLabel: "Current value",
      mainBalanceMinorUnits: 4_567_800,
      monthlyContributionMinorUnits: 500_000,
      nextDepositDate: "2026-10-10",
      actions: ["schedule", "statement", "details"],
    });
  });

  it("prefers product-reported deposit values and derives totals from the same values", () => {
    const fixedDeposit = demoAccounts.find((account) => account.type === "fixed-deposit")!;
    const recurringDeposit = demoAccounts.find((account) => account.type === "recurring-deposit")!;
    const overview = buildAccountsOverview([
      {
        ...fixedDeposit,
        fixedDeposit: {
          ...fixedDeposit.fixedDeposit!,
          // A reported zero is real data and must not fall back to the ledger.
          reportedCurrentValue: { minorUnits: 0, currency: "INR" },
        },
      },
      {
        ...recurringDeposit,
        recurringDeposit: {
          ...recurringDeposit.recurringDeposit!,
          reportedBalance: { minorUnits: 4_600_000, currency: "INR" },
        },
      },
    ]);

    expect(overview.accounts.map((account) => account.mainBalanceMinorUnits)).toEqual([
      0,
      4_600_000,
    ]);
    expect(overview.summary).toEqual({
      totalBalanceMinorUnits: 4_600_000,
      availableToSpendMinorUnits: 0,
      depositBalanceMinorUnits: 4_600_000,
      accountCount: 2,
    });
  });

  it("falls back to deposit ledgers only when reported product values are absent", () => {
    const fixedDeposit = demoAccounts.find((account) => account.type === "fixed-deposit")!;
    const recurringDeposit = demoAccounts.find((account) => account.type === "recurring-deposit")!;
    const fixedWithoutReportedValue: BankAccount = {
      ...fixedDeposit,
      ledgerBalanceMinorUnits: 7_400_000,
      fixedDeposit: {
        ...fixedDeposit.fixedDeposit!,
        reportedCurrentValue: undefined,
      },
    };
    const recurringWithoutProductDetails: BankAccount = {
      ...recurringDeposit,
      ledgerBalanceMinorUnits: 4_400_000,
      recurringDeposit: undefined,
    };

    expect(normalizeAccountOverviewItem(fixedWithoutReportedValue).mainBalanceMinorUnits)
      .toBe(7_400_000);
    expect(normalizeAccountOverviewItem(recurringWithoutProductDetails).mainBalanceMinorUnits)
      .toBe(4_400_000);
  });

  it("keeps a deposit unavailable when neither a product value nor ledger snapshot exists", () => {
    const fixedDeposit = demoAccounts.find((account) => account.type === "fixed-deposit")!;
    const unavailable: BankAccount = {
      ...fixedDeposit,
      balanceDataAvailable: false,
      ledgerBalanceMinorUnits: undefined,
      fixedDeposit: {
        ...fixedDeposit.fixedDeposit!,
        reportedCurrentValue: undefined,
      },
    };
    const overview = buildAccountsOverview([unavailable]);

    expect(overview.accounts[0].mainBalanceMinorUnits).toBeNull();
    expect(overview.summary.depositBalanceMinorUnits).toBeNull();
    expect(overview.summary.totalBalanceMinorUnits).toBeNull();
  });
});
