import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import { apiRequest } from "@/lib/api/client";
import type { AccountsResponse, ApiCard, ApiCardTransaction, ApiTransaction } from "@/lib/api/types";
import { clearCustomerPreferences, updateTransactionAnnotation } from "@/services/accounts-service";
import { clearCardServiceState, updateCardTransactionAnnotation } from "@/services/cards-service";
import { clearDemoTransferLedger, recordDemoTransferLedger } from "@/services/demo-transfer-ledger";

import {
  createActivityCsv,
  createRemoteActivityCsv,
  getRemoteTransactionExplorerPage,
  getTransactionExplorerPage,
  updateActivityAnnotation,
} from "./transaction-explorer-service";

jest.mock("@/lib/api/client", () => ({ apiRequest: jest.fn() }));

const apiRequestMock = apiRequest as jest.Mock;
const remoteOptions = { getToken: jest.fn(async () => "remote-token") };

const remoteAccount: AccountsResponse["accounts"][number] = {
  id: "account-owned",
  type: "savings",
  name: "Primary Savings",
  nickname: "Savings",
  maskedAccountNumber: "XXXXXXXX1234",
  currency: "INR",
  isPrimary: true,
  status: "active",
  branchName: null,
  ifsc: null,
  ledgerBalance: "125000.00",
  availableBalance: "120000.00",
  holds: "5000.00",
  asOf: "2026-09-20T08:00:00.000Z",
  updatedAt: "2026-09-20T08:00:00.000Z",
  sourceProvider: "bank_api",
  sourceEnvironment: "production",
};

const remoteCard: ApiCard = {
  id: "card-owned",
  accountId: remoteAccount.id,
  type: "debit",
  network: "Visa",
  maskedCardNumber: "XXXXXXXXXXXX9876",
  nickname: "Everyday Card",
  status: "active",
  expiryMonth: 12,
  expiryYear: 2029,
  isPrimary: true,
  updatedAt: "2026-09-20T08:00:00.000Z",
  controls: null,
};

const remoteCardTransaction: ApiCardTransaction = {
  id: "card-transaction-owned",
  cardId: remoteCard.id,
  transactionId: null,
  merchantName: "Remote Merchant",
  amount: "1250.00",
  currency: "INR",
  status: "posted",
  transactionAt: "2026-09-19T10:30:00.000Z",
  createdAt: "2026-09-19T10:30:00.000Z",
};

function mockRemoteApi({
  accountTransactions = [],
  cards = [remoteCard],
  cardTransactions = [remoteCardTransaction],
}: {
  accountTransactions?: ApiTransaction[];
  cards?: ApiCard[];
  cardTransactions?: ApiCardTransaction[];
} = {}) {
  apiRequestMock.mockImplementation(async (path: string, options?: { body?: { scope?: { mode?: string }; pageSize?: number } }) => {
    if (path === "/api/v1/accounts/overview") {
      return {
        accounts: [remoteAccount],
        summary: {
          totalBalance: "125000.00",
          availableToSpend: "120000.00",
          deposits: "0.00",
          currency: "INR",
          updatedAt: "2026-09-20T08:00:00.000Z",
        },
      } satisfies AccountsResponse;
    }
    if (path === '/api/v1/activity/search') {
      const cardOnly=options?.body?.scope?.mode==='cards';
      const items=cardOnly?cardTransactions.map(t=>({id:t.id,kind:'card',accountId:remoteAccount.id,cardId:t.cardId,amount:t.amount,currency:t.currency,direction:'debit',status:t.status,category:'other',merchant:t.merchantName,description:t.merchantName,transactionAt:t.transactionAt,sourceEnvironment:'Bank API',dataAsOf:t.createdAt,transactionType:'purchase'})):accountTransactions.map(t=>({id:t.id,kind:'account',accountId:t.accountId,cardId:null,amount:t.amount,currency:t.currency,direction:t.direction,status:t.status,category:t.category??'other',merchant:t.merchantName??'',description:t.description,transactionAt:t.transactionAt,sourceEnvironment:t.metadata.source==='account_aggregator'?`Account Aggregator · ${t.metadata.provider}`:'Bank API',dataAsOf:'2026-09-20T08:00:00.000Z',transactionType:t.type}));
      return {items,page:1,pageSize:options?.body?.pageSize??30,totalItems:items.length,totalPages:1,truncated:false,dataAsOf:'2026-09-20T08:00:00.000Z',period:{to:'2026-09-20'},summary:{accountCredits:'0.00',accountDebits:cardOnly?'0.00':accountTransactions[0]?.amount??'0.00',netAccountMovement:cardOnly?'0.00':`-${accountTransactions[0]?.amount??'0.00'}`,cardPostedPurchases:cardOnly?cardTransactions[0]?.amount??'0.00':'0.00',cardPostedRefunds:'0.00',includedPostedCount:items.length,pendingCount:0,failedCount:0}};
    }
    if (path === "/api/v1/cards") return { cards };
    if (path.startsWith("/api/v1/transactions?")) return { items: accountTransactions, nextCursor: null };
    if (path === `/api/v1/cards/${remoteCard.id}/transactions`) return { items: cardTransactions };
    throw new Error(`Unexpected remote request: ${path}`);
  });
}

describe("transaction explorer service", () => {
  beforeEach(async () => {
    apiRequestMock.mockReset();
    remoteOptions.getToken.mockClear();
    await clearCustomerPreferences(DEMO_CUSTOMER_A);
    await clearCustomerPreferences(DEMO_CUSTOMER_B);
    await clearCardServiceState();
    await clearDemoTransferLedger();
  });

  it("searches and summarizes the complete matching dataset beyond the visible page", async () => {
    const page = await getTransactionExplorerPage({ search: "salary", pageSize: 1 }, { customerId: DEMO_CUSTOMER_A });

    expect(page.totalItems).toBeGreaterThan(1);
    expect(page.items).toHaveLength(1);
    expect(page.summary.accountCreditsMinorUnits).toBeGreaterThan(0);
    expect(page.summary.includedPostedCount).toBe(page.totalItems);
  });

  it("applies date, status, category, amount, and direction filters to the full result", async () => {
    const page = await getTransactionExplorerPage({
      period: "last-month",
      direction: "debit",
      category: "shopping",
      status: "posted",
      minAmountMinorUnits: 100_000,
      maxAmountMinorUnits: 300_000,
      pageSize: 2,
    }, { customerId: DEMO_CUSTOMER_A });

    expect(page.totalItems).toBeGreaterThan(0);
    expect(page.items.every((item) => item.transactionDate >= "2026-08-01" && item.transactionDate <= "2026-08-31")).toBe(true);
    expect(page.items.every((item) => item.direction === "debit" && item.category === "shopping" && item.status === "posted")).toBe(true);
    expect(page.items.every((item) => item.amountMinorUnits >= 100_000 && item.amountMinorUnits <= 300_000)).toBe(true);
    expect(page.summary.pendingCount).toBe(0);
  });

  it("keeps explicit account/card relationships as one activity and preserves related sources", async () => {
    const page = await getTransactionExplorerPage({ search: "Amazon India", pageSize: 30 }, { customerId: DEMO_CUSTOMER_A });
    const amazon = page.items.filter((item) => item.title === "Amazon India");

    expect(amazon.some((item) => item.sourceKind === "account-ledger")).toBe(true);
    expect(amazon.filter((item) => item.sourceKind === "account-ledger")).toHaveLength(2);
    expect(amazon.flatMap((item) => item.relatedRecordIds)).toContain("card:card-a-amazon-settled");
    expect(amazon.some((item) => item.sourceKind === "card-event" && item.status === "posted")).toBe(false);
  });

  it("groups an own-account transfer only when both explicit ledger sides are in scope", async () => {
    await recordDemoTransferLedger({
      transferId: "explorer-own-account",
      customerId: DEMO_CUSTOMER_A,
      sourceAccountId: "savings-primary",
      destinationAccountId: "current-account",
      amountMinorUnits: 100_000,
      method: "imps",
      recipientLabel: "My current account",
      internalReference: "EXP-OWN-001",
      transactionDate: "2026-09-05",
    });

    const all = await getTransactionExplorerPage({ pageSize: 50 }, { customerId: DEMO_CUSTOMER_A });
    expect(all.items.filter((item) => item.sourceKind === "transfer-group")).toHaveLength(1);

    const accountOnly = await getTransactionExplorerPage({ scope: { mode: "accounts", accountIds: ["savings-primary"], cardIds: [] }, pageSize: 50 }, { customerId: DEMO_CUSTOMER_A });
    expect(accountOnly.items.some((item) => item.sourceKind === "transfer-group")).toBe(false);
    expect(accountOnly.items.some((item) => item.id === "account:ledger-explorer-own-account-debit")).toBe(true);
  });

  it("persists customer-scoped annotations and keeps them out of CSV export", async () => {
    await updateTransactionAnnotation("savings-primary", "sav-20260810-amazon", { category: "food", note: "Private context" }, { customerId: DEMO_CUSTOMER_A });
    const accountPage = await getTransactionExplorerPage({ search: "Amazon India", scope: { mode: "accounts", accountIds: ["savings-primary"], cardIds: [] }, pageSize: 30 }, { customerId: DEMO_CUSTOMER_A });
    const accountActivity = accountPage.items.find((item) => item.sourceReferences.some((source) => source.id === "sav-20260810-amazon"));
    expect(accountActivity?.category).toBe("food");
    expect(accountActivity?.annotation?.note).toBe("Private context");
    if (accountActivity) await updateActivityAnnotation(accountActivity, { category: "shopping", note: "Updated" }, DEMO_CUSTOMER_A);

    await updateCardTransactionAnnotation("card-debit-primary", "card-a-coffee-pending", { category: "food", note: "Card note" }, { customerId: DEMO_CUSTOMER_A });
    const cardPage = await getTransactionExplorerPage({ scope: { mode: "cards", accountIds: [], cardIds: ["card-debit-primary"] }, search: "pending", pageSize: 30 }, { customerId: DEMO_CUSTOMER_A });
    expect(cardPage.items.find((item) => item.id === "card:card-a-coffee-pending")?.annotation?.note).toBe("Card note");

    const csv = await createActivityCsv({ search: "Amazon India" }, { customerId: DEMO_CUSTOMER_A });
    expect(csv.rowCount).toBe(accountPage.totalItems);
    expect(csv.csv).not.toContain("Private context");
    expect(csv.csv).toContain("Notes: Personal notes excluded");
    expect(csv.csv).toContain("Demo transaction summary");
  });

  it("does not expose another customer's resources", async () => {
    const page = await getTransactionExplorerPage(undefined, { customerId: DEMO_CUSTOMER_B });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => !item.sourceReferences.some((source) => source.id === "savings-primary" || source.id === "card-debit-primary"))).toBe(true);
    await expect(getTransactionExplorerPage({ scope: { mode: "accounts", accountIds: ["savings-primary"], cardIds: [] } }, { customerId: DEMO_CUSTOMER_B })).rejects.toThrow("Account unavailable");
  });

  it("loads authenticated remote card resources and card-scoped transactions", async () => {
    mockRemoteApi();

    const page = await getRemoteTransactionExplorerPage({
      scope: { mode: "cards", accountIds: [], cardIds: [remoteCard.id] },
      pageSize: 10,
    }, remoteOptions);

    expect(page.query.scope).toEqual({ mode: "cards", accountIds: [], cardIds: [remoteCard.id] });
    expect(page.items).toEqual([
      expect.objectContaining({
        id: `card:${remoteCardTransaction.id}`,
        cardId: remoteCard.id,
        cardLabel: "Everyday Card · •••• 9876",
        sourceEnvironment: "Bank API",
      }),
    ]);
    expect(page.summary.cardPostedPurchasesMinorUnits).toBe(125_000);
    expect(page.coverage).toMatchObject({
      includedResources: ["Everyday Card · •••• 9876"],
      sourceEnvironment: "Bank API",
      note: expect.stringMatching(/authenticated banking API/i),
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/activity/search", expect.objectContaining({ getToken: remoteOptions.getToken, method:"POST", body:expect.objectContaining({scope:{mode:"cards",accountIds:[],cardIds:[remoteCard.id]},page:1,pageSize:10}) }));
    expect(apiRequestMock.mock.calls.some(([path]) => String(path).startsWith("/api/v1/transactions?"))).toBe(false);
  });

  it("rejects a remote card outside the authenticated resource list before requesting its transactions", async () => {
    mockRemoteApi();

    await expect(getRemoteTransactionExplorerPage({
      scope: { mode: "cards", accountIds: [], cardIds: ["card-not-owned"] },
    }, remoteOptions)).rejects.toThrow("Card unavailable or you do not have access to it");

    expect(apiRequestMock.mock.calls.some(([path]) => String(path).includes("card-not-owned"))).toBe(false);
  });

  it("labels non-AA remote account data and CSV exports as Bank API", async () => {
    const bankTransaction: ApiTransaction = {
      id: "bank-transaction-owned",
      accountId: remoteAccount.id,
      type: "purchase",
      direction: "debit",
      amount: "500.00",
      currency: "INR",
      description: "Bank API payment",
      merchantName: "Bank Merchant",
      category: "shopping",
      categoryName: "Shopping",
      reference: "BANK-001",
      transactionAt: "2026-09-18T09:00:00.000Z",
      status: "posted",
      metadata: { source: "bank_api", channel: "upi" },
    };
    mockRemoteApi({ accountTransactions: [bankTransaction] });
    const scope = { mode: "accounts" as const, accountIds: [remoteAccount.id], cardIds: [] };

    const page = await getRemoteTransactionExplorerPage({ scope }, remoteOptions);
    const csv = await createRemoteActivityCsv({ scope }, remoteOptions);

    expect(page.items[0]?.sourceEnvironment).toBe("Bank API");
    expect(page.coverage.sourceEnvironment).toBe("Bank API");
    expect(page.coverage.note).toMatch(/authenticated banking API/i);
    expect(page.snapshot.dataRevision).toBe("2026-09-20T08:00:00.000Z");
    expect(csv.csv).toContain("Bank API transaction summary");
    expect(csv.csv).not.toContain("Demo transaction summary");
  });

  it("retains Account Aggregator source and export labels for AA transactions", async () => {
    const aaTransaction: ApiTransaction = {
      id: "aa-transaction-owned",
      accountId: remoteAccount.id,
      type: "purchase",
      direction: "debit",
      amount: "750.00",
      currency: "INR",
      description: "AA payment",
      merchantName: "AA Merchant",
      category: "food_dining",
      categoryName: "Food & Dining",
      reference: "AA-001",
      transactionAt: "2026-09-17T09:00:00.000Z",
      status: "posted",
      metadata: { source: "account_aggregator", provider: "Finvu" },
    };
    mockRemoteApi({ accountTransactions: [aaTransaction] });
    const scope = { mode: "accounts" as const, accountIds: [remoteAccount.id], cardIds: [] };

    const page = await getRemoteTransactionExplorerPage({ scope }, remoteOptions);
    const csv = await createRemoteActivityCsv({ scope }, remoteOptions);

    expect(page.items[0]?.sourceEnvironment).toBe("Account Aggregator · Finvu");
    expect(page.coverage.sourceEnvironment).toBe("Account Aggregator · Finvu");
    expect(page.coverage.note).toMatch(/approved Account Aggregator consent/i);
    expect(page.snapshot.dataRevision).toBe("2026-09-20T08:00:00.000Z");
    expect(csv.csv).toContain("Account Aggregator data");
  });
});
