import type { ApiAccount, AccountsResponse } from "./types";
import {
  apiAccountToBankAccount,
  apiAccountsResponseToOverview,
  apiGoalToFinancialGoal,
  apiInsightToCoachWealthInsight,
  parseOptionalApiMoneyToMinorUnits,
} from "./view-models";

const fixedDepositApiAccount: ApiAccount = {
  id: "acc-fixed",
  type: "fixed_deposit",
  name: "Fixed Deposit",
  nickname: "Fixed Deposit",
  maskedAccountNumber: "•••• 9012",
  currency: "INR",
  isPrimary: false,
  status: "active",
  branchName: null,
  ifsc: null,
  ledgerBalance: "70678.00",
  availableBalance: "0.00",
  holds: "0.00",
  asOf: "2026-09-20T08:00:00.000Z",
  updatedAt: "2026-09-20T08:00:00.000Z",
  sourceProvider: "seed",
  sourceEnvironment: "demo",
};

describe("wealth API view models", () => {
  it("preserves zero separately from unavailable API money", () => {
    expect(parseOptionalApiMoneyToMinorUnits("0.00")).toBe(0);
    expect(parseOptionalApiMoneyToMinorUnits(null)).toBeNull();
    expect(parseOptionalApiMoneyToMinorUnits(undefined)).toBeNull();
    expect(parseOptionalApiMoneyToMinorUnits("not-money")).toBeNull();
  });

  it("does not expose a deposit's inapplicable available balance as zero", () => {
    const account = apiAccountToBankAccount(fixedDepositApiAccount);

    expect(account.balanceMinorUnits).toBe(7_067_800);
    expect(account.balanceDataAvailable).toBe(true);
    expect(account.availableBalanceMinorUnits).toBeUndefined();
    expect(account.capabilities.canManageCard).toBe(false);
  });

  it("treats backend fallback zeroes as unavailable when no balance snapshot exists", () => {
    const missingBalanceAccount: ApiAccount = {
      ...fixedDepositApiAccount,
      id: "acc-unsynced-fixed",
      ledgerBalance: "0.00",
      availableBalance: "0.00",
      holds: "0.00",
      asOf: null,
    };
    const response: AccountsResponse = {
      accounts: [missingBalanceAccount],
      summary: {
        totalBalance: "0.00",
        availableToSpend: "0.00",
        deposits: "0.00",
        currency: "INR",
        updatedAt: null,
      },
    };

    const account = apiAccountToBankAccount(missingBalanceAccount);
    const overview = apiAccountsResponseToOverview(response);

    expect(account.balanceDataAvailable).toBe(false);
    expect(account.ledgerBalanceMinorUnits).toBeUndefined();
    expect(overview.summary.totalBalanceMinorUnits).toBeNull();
    expect(overview.summary.depositBalanceMinorUnits).toBeNull();
    expect(overview.accounts[0]?.mainBalanceMinorUnits).toBeNull();
  });

  it("does not turn an unsynced transaction account into available ₹0.00", () => {
    const missingBalanceAccount: ApiAccount = {
      ...fixedDepositApiAccount,
      id: "acc-unsynced-savings",
      type: "savings",
      name: "Savings Account",
      nickname: "Savings Account",
      ledgerBalance: "0.00",
      availableBalance: "0.00",
      asOf: null,
    };
    const overview = apiAccountsResponseToOverview({
      accounts: [missingBalanceAccount],
      summary: {
        totalBalance: "0.00",
        availableToSpend: "0.00",
        deposits: "0.00",
        currency: "INR",
        updatedAt: null,
      },
    });

    expect(overview.summary.totalBalanceMinorUnits).toBeNull();
    expect(overview.summary.availableToSpendMinorUnits).toBeNull();
    expect(overview.accounts[0]).toMatchObject({
      productKind: "transaction",
      mainBalanceMinorUnits: null,
      currentBalanceMinorUnits: null,
    });
  });

  it("maps the canonical API response to product-specific accounts and server totals", () => {
    const response: AccountsResponse = {
      accounts: [fixedDepositApiAccount],
      summary: {
        totalBalance: "70678.00",
        availableToSpend: "0.00",
        deposits: "70678.00",
        currency: "INR",
        updatedAt: "2026-09-20T08:00:00.000Z",
      },
    };

    expect(apiAccountsResponseToOverview(response)).toMatchObject({
      summary: {
        totalBalanceMinorUnits: 7_067_800,
        availableToSpendMinorUnits: 0,
        depositBalanceMinorUnits: 7_067_800,
        accountCount: 1,
      },
      accounts: [{
        productKind: "fixed-deposit",
        mainBalanceLabel: "Current value",
        mainBalanceMinorUnits: 7_067_800,
      }],
      meta: {
        lastUpdated: "2026-09-20T08:00:00.000Z",
        source: "Demo data",
      },
    });
  });

  it("maps a focused insight response without requiring a wealth summary", () => {
    expect(apiInsightToCoachWealthInsight({
      id: "insight-bills",
      type: "bill",
      title: "Upcoming electricity bill",
      summary: "A recurring electricity payment is due soon.",
      severity: "attention",
      metricValue: "4200",
      metricUnit: "INR",
      comparisonValue: null,
      comparisonPeriod: null,
      source: { accountIds: ["account-1"] },
      actionRoute: "/activity",
      createdAt: "2026-09-20T00:00:00.000Z",
      expiresAt: null,
    })).toMatchObject({
      id: "insight-bills",
      type: "bills",
      metric: 4200,
      metricUnit: "currency",
      severity: "attention",
    });
  });

  it("maps a focused goal response and calculates bounded progress", () => {
    expect(apiGoalToFinancialGoal({
      id: "goal-emergency",
      type: "savings",
      title: "Emergency fund",
      targetAmount: "100000.00",
      currentAmount: "68000.00",
      currency: "INR",
      targetDate: "2027-09-20",
      monthlyContribution: "8000.00",
      status: "on_track",
      updatedAt: "2026-09-20T00:00:00.000Z",
    })).toEqual({
      id: "goal-emergency",
      name: "Emergency fund",
      targetAmount: 100000,
      currentAmount: 68000,
      progressPercentage: 68,
      gapAmount: 32000,
      targetDate: "2027-09-20",
      monthlyContribution: 8000,
      status: "on-track",
    });
  });
});
