import {
  clearCustomerPreferences,
  createTransactionCsv,
  getAccount,
  getAccountTransactions,
  getAccounts,
  updateAccountPreference,
  updateTransactionAnnotation,
} from "./accounts-service";

describe("accounts service", () => {
  beforeEach(async () => {
    await clearCustomerPreferences("demo-customer-a");
    await clearCustomerPreferences("demo-customer-b");
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

  it("calculates summaries across the full matching dataset and excludes pending/failed rows", async () => {
    const page = await getAccountTransactions("savings-primary", {
      customerId: "demo-customer-a",
      page: 1,
      pageSize: 3,
    });

    expect(page.totalItems).toBe(12);
    expect(page.totalPages).toBe(4);
    expect(page.items).toHaveLength(3);
    expect(page.summary.includedTransactionCount).toBe(10);
    expect(page.summary.moneyInMinorUnits).toBe(17_166_500);
    expect(page.summary.moneyOutMinorUnits).toBe(3_788_900);
    expect(page.summary.netMovementMinorUnits).toBe(13_377_600);
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
    expect(result.rowCount).toBe(6);
    expect(result.csv).toContain("Demo transaction summary — not an official bank statement.");
    expect(result.csv).toContain("Amazon India");
    expect(result.csv).not.toContain("Private note");
    expect(result.csv).not.toContain("Personal note");
  });
});
