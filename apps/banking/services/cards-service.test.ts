import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import {
  checkCardOperationStatus,
  clearCardServiceState,
  formatLimitInput,
  getCard,
  getCardFundingSummary,
  getCardTransactions,
  getCards,
  parseLimitInput,
  reportCardLostOrStolen,
  updateCardLimit,
  updateCardMasterState,
  updateCardNickname,
} from "@/services/cards-service";

let scopeSequence = 0;

function isolatedCustomer(): string {
  scopeSequence += 1;
  return `cards-service-test-${scopeSequence}`;
}

describe("cards service demo adapter", () => {
  beforeEach(async () => {
    await clearCardServiceState();
  });

  it("keeps customer access isolated even when two customers share a last four", async () => {
    const customerACard = await getCard("card-debit-primary", { customerId: DEMO_CUSTOMER_A });
    const customerBCard = await getCard("card-debit-customer-b", { customerId: DEMO_CUSTOMER_B });

    expect(customerACard?.lastFour).toBe("4321");
    expect(customerBCard?.lastFour).toBe("4321");
    expect(customerACard?.id).not.toBe(customerBCard?.id);
    await expect(getCard("card-debit-primary", { customerId: DEMO_CUSTOMER_B })).resolves.toBeUndefined();
    await expect(getCards({ customerId: DEMO_CUSTOMER_B })).resolves.toHaveLength(1);
  });

  it("uses the linked account for debit funding and one shared facility for credit funding", async () => {
    const customerId = isolatedCustomer();
    const debit = await getCardFundingSummary("card-debit-primary", { customerId });
    const credit = await getCardFundingSummary("card-credit-demo", { customerId });

    expect(debit.type).toBe("debit");
    if (debit.type === "debit") expect(debit.account.id).toBe("savings-primary");
    expect(credit).toMatchObject({
      type: "credit",
      facility: {
        id: "credit-facility-demo-a",
        currentOutstandingMinorUnits: 1_845_000,
        availableCreditMinorUnits: 8_155_000,
        approvedCreditLimitMinorUnits: 10_000_000,
      },
    });
  });

  it("returns masked card metadata without payment credentials", async () => {
    const card = await getCard("card-debit-primary", { customerId: isolatedCustomer() });

    expect(card).toMatchObject({ lastFour: "4321", productKind: "debit" });
    expect(JSON.stringify(card)).not.toMatch(/pan|cvv|pin|securityCode/i);
    expect(JSON.stringify(card)).not.toMatch(/\d{12,}/);
  });

  it("deduplicates authorisation and settlement while retaining pending, refunds, fees, and repayments", async () => {
    const customerId = isolatedCustomer();
    const debitPage = await getCardTransactions("card-debit-primary", {
      customerId,
      pageSize: 20,
    });

    expect(debitPage.totalItems).toBe(5);
    expect(debitPage.items.filter((item) => item.merchant === "Amazon India")).toHaveLength(2);
    expect(debitPage.items.some((item) => item.transactionType === "authorisation")).toBe(true);
    expect(debitPage.items.some((item) => item.id === "card-a-amazon-auth")).toBe(false);
    expect(debitPage.summary.postedPurchasesMinorUnits).toBe(359_000);
    expect(debitPage.summary.postedCashWithdrawalsMinorUnits).toBe(500_000);
    expect(debitPage.summary.postedRefundsMinorUnits).toBe(124_000);

    const creditPage = await getCardTransactions("card-credit-demo", {
      customerId,
      pageSize: 20,
    });
    expect(creditPage.items.map((item) => item.transactionType)).toEqual(
      expect.arrayContaining(["purchase", "fee", "repayment"]),
    );
    expect(creditPage.summary.postedPurchasesMinorUnits).toBe(1_240_000);
    expect(creditPage.summary.postedFeesMinorUnits).toBe(32_000);
  });

  it("persists non-sensitive nicknames and validates exact limits against provider maxima", async () => {
    const customerId = isolatedCustomer();
    await updateCardNickname("card-debit-primary", "Travel card", { customerId });
    await clearCardServiceState();

    await expect(getCard("card-debit-primary", { customerId })).resolves.toMatchObject({ nickname: "Travel card" });
    expect(() => parseLimitInput("80,000.00")).toThrow("up to two decimal places");
    expect(parseLimitInput("80000.00")).toBe(8_000_000);
    expect(formatLimitInput(8_000_000)).toBe("80000.00");
    await expect(updateCardLimit(
      "card-debit-primary",
      "domestic-online-daily",
      15_000_001,
      { customerId, idempotencyKey: "limit-too-high", expectedRevision: 1 },
    )).rejects.toThrow("issuer-permitted maximum");

    const operation = await updateCardLimit(
      "card-debit-primary",
      "domestic-online-daily",
      8_000_000,
      { customerId, idempotencyKey: "limit-valid", expectedRevision: 1 },
    );
    expect(operation.status).toBe("confirmed");
    await expect(getCard("card-debit-primary", { customerId })).resolves.toMatchObject({
      limits: expect.arrayContaining([
        expect.objectContaining({ id: "domestic-online-daily", amountMinorUnits: 8_000_000 }),
      ]),
    });
  });

  it("keeps pending control outcomes unapplied until status is checked and honors idempotency", async () => {
    const customerId = isolatedCustomer();
    const first = await updateCardMasterState(
      "card-debit-virtual",
      "off",
      { customerId, idempotencyKey: "virtual-off", expectedRevision: 1 },
    );
    const retry = await updateCardMasterState(
      "card-debit-virtual",
      "off",
      { customerId, idempotencyKey: "virtual-off", expectedRevision: 1 },
    );

    expect(first).toEqual(retry);
    expect(first.status).toBe("pending");
    await expect(getCard("card-debit-virtual", { customerId })).resolves.toMatchObject({ lifecycleStatus: "active" });

    await expect(checkCardOperationStatus(first.id, { customerId })).resolves.toMatchObject({ status: "confirmed" });
    await expect(getCard("card-debit-virtual", { customerId })).resolves.toMatchObject({ lifecycleStatus: "temporarily-disabled" });
  });

  it("returns the same confirmed operation when a client retries with its original revision", async () => {
    const customerId = isolatedCustomer();
    const first = await updateCardMasterState(
      "card-debit-primary",
      "off",
      { customerId, idempotencyKey: "primary-off", expectedRevision: 1 },
    );
    const retry = await updateCardMasterState(
      "card-debit-primary",
      "off",
      { customerId, idempotencyKey: "primary-off", expectedRevision: 1 },
    );

    expect(first.status).toBe("confirmed");
    expect(retry).toEqual(first);
  });

  it("permanently blocks a lost card and does not allow a temporary re-enable", async () => {
    const customerId = isolatedCustomer();
    const operation = await reportCardLostOrStolen(
      "card-debit-primary",
      "lost",
      { customerId, idempotencyKey: "lost-primary", expectedRevision: 1 },
    );

    expect(operation.status).toBe("confirmed");
    await expect(getCard("card-debit-primary", { customerId })).resolves.toMatchObject({ lifecycleStatus: "blocked" });
    await expect(updateCardMasterState(
      "card-debit-primary",
      "on",
      { customerId, idempotencyKey: "blocked-on", expectedRevision: 2 },
    )).rejects.toThrow("not eligible");
  });
});
