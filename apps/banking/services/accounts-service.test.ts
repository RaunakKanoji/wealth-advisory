import {
  clearCustomerPreferences,
  createTransactionCsv,
  getAccount,
  getAccountPreference,
  getAccountTransactions,
  getAccounts,
  getBalanceVisibility,
  subscribeBalanceVisibility,
  updateAccountPreference,
  updateBalanceVisibility,
  updateTransactionAnnotation,
} from "./accounts-service";

describe("accounts service", () => {
  beforeEach(async () => {
    await clearCustomerPreferences("demo-customer-a");
    await clearCustomerPreferences("demo-customer-b");
    await clearCustomerPreferences("usr_demo_a");
  });

  it("uses the shared illustrative balances and keeps deposits separate", async () => {
    const accounts = await getAccounts({ customerId: "demo-customer-a" });

    expect(accounts.map((account) => account.id)).toEqual([
      "savings-primary",
      "current-account",
      "fixed-deposit",
      "recurring-deposit",
    ]);
    expect(accounts.reduce((total, account) => total + account.balanceMinorUnits, 0)).toBe(34_567_800);
    expect(accounts.filter((account) => account.capabilities.canSetPrimary)).toHaveLength(2);
    expect(accounts.find((account) => account.id === "fixed-deposit")?.availableBalanceMinorUnits).toBeUndefined();
  });

  it("persists one balance visibility preference across the accounts experience", async () => {
    expect(await getBalanceVisibility({ customerId: "demo-customer-a" })).toBe(true);

    await updateBalanceVisibility("savings-primary", false, { customerId: "demo-customer-a" });

    expect(await getBalanceVisibility({ customerId: "demo-customer-a" })).toBe(false);
    expect((await getAccountPreference("current-account", { customerId: "demo-customer-a" })).balanceVisible).toBe(false);

    await updateBalanceVisibility("savings-primary", true, { customerId: "demo-customer-a" });
    expect(await getBalanceVisibility({ customerId: "demo-customer-a" })).toBe(true);
  });

  it("does not erase hidden balances when other account preferences change", async () => {
    await updateBalanceVisibility(undefined, false, { customerId: "demo-customer-a" });

    await updateAccountPreference(
      "current-account",
      { nickname: "Bills account" },
      { customerId: "demo-customer-a" },
    );
    expect(await getBalanceVisibility({ customerId: "demo-customer-a" })).toBe(false);

    await updateTransactionAnnotation(
      "savings-primary",
      "sav-20260810-amazon",
      { note: "Household purchase" },
      { customerId: "demo-customer-a" },
    );
    expect(await getBalanceVisibility({ customerId: "demo-customer-a" })).toBe(false);
  });

  it("persists visibility for authenticated API users without requiring a local account fixture", async () => {
    await updateBalanceVisibility("acc_demo_savings", false, { customerId: "usr_demo_a" });

    expect(await getBalanceVisibility({ customerId: "usr_demo_a" })).toBe(false);
  });

  it("notifies mounted financial surfaces when balance visibility changes", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBalanceVisibility(listener, { customerId: "demo-customer-a" });

    await updateBalanceVisibility(undefined, false, { customerId: "demo-customer-a" });
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
    await updateBalanceVisibility(undefined, true, { customerId: "demo-customer-a" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("calculates summaries across the full matching dataset and excludes pending/failed rows", async () => {
    const page = await getAccountTransactions("savings-primary", {
      customerId: "demo-customer-a",
      page: 1,
      pageSize: 3,
    });

    expect(page.totalItems).toBe(18);
    expect(page.totalPages).toBe(6);
    expect(page.items).toHaveLength(3);
    expect(page.summary.includedTransactionCount).toBe(16);
    expect(page.summary.moneyInMinorUnits).toBe(17_166_500);
    expect(page.summary.moneyOutMinorUnits).toBe(6_488_900);
    expect(page.summary.netMovementMinorUnits).toBe(10_677_600);
  });

  it("searches the complete account dataset and has deterministic paging", async () => {
    const search = await getAccountTransactions("savings-primary", {
      customerId: "demo-customer-a",
      filters: { search: "salary" },
      pageSize: 1,
      page: 2,
    });

    expect(search.totalItems).toBe(2);
    expect(search.page).toBe(2);
    expect(search.items[0]?.description).toBe("Salary credit");
  });

  it("does not let one customer read another customer's account", async () => {
    await expect(
      getAccountTransactions("savings-primary", { customerId: "demo-customer-b" }),
    ).rejects.toThrow("Account unavailable");
    expect(await getAccount("savings-primary", { customerId: "demo-customer-b" })).toBeUndefined();
  });

  it("persists customer annotations and enforces a single eligible primary account", async () => {
    await updateTransactionAnnotation(
      "savings-primary",
      "sav-20260810-amazon",
      { category: "food", note: "Team lunch order" },
      { customerId: "demo-customer-a" },
    );
    const refreshed = await getAccountTransactions("savings-primary", {
      customerId: "demo-customer-a",
      filters: { search: "Amazon" },
    });
    expect(refreshed.items.find((item) => item.id === "sav-20260810-amazon")?.annotation).toEqual({ category: "food", note: "Team lunch order" });

    await updateAccountPreference("current-account", { isPrimary: true }, { customerId: "demo-customer-a" });
    const accounts = await getAccounts({ customerId: "demo-customer-a" });
    expect(accounts.filter((account) => account.isPrimary).map((account) => account.id)).toEqual(["current-account"]);
    await expect(
      updateAccountPreference("fixed-deposit", { isPrimary: true }, { customerId: "demo-customer-a" }),
    ).rejects.toThrow("Deposits cannot be set");
  });

  it("exports every matching row and includes no personal note column", async () => {
    await updateTransactionAnnotation(
      "savings-primary",
      "sav-20260810-amazon",
      { note: "Private note" },
      { customerId: "demo-customer-a" },
    );
    const result = await createTransactionCsv(
      "savings-primary",
      { period: "last-month" },
      { customerId: "demo-customer-a" },
    );

    expect(result.filename).toBe("idbi-savings-primary-transactions.csv");
    expect(result.rowCount).toBe(9);
    expect(result.csv).toContain("Demo transaction summary — not an official bank statement.");
    expect(result.csv).toContain("Amazon India");
    expect(result.csv).not.toContain("Private note");
    expect(result.csv).not.toContain("Personal note");
  });
});
