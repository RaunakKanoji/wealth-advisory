import { createManualPaymentQr, parsePaymentQr } from "@/lib/payment-qr-parser";
import { clearDemoPaymentLedger, getDemoPaymentActivities } from "@/services/demo-payment-ledger";
import {
  clearDemoPaymentState,
  executeDemoPayment,
  getEligibleFundingAccounts,
  preparePaymentDraft,
} from "@/services/payment-service";

describe("payment service demo adapter", () => {
  beforeEach(() => {
    clearDemoPaymentState();
    clearDemoPaymentLedger();
  });

  it("only exposes active ordinary payment accounts", async () => {
    const accounts = await getEligibleFundingAccounts("demo-customer-a");

    expect(accounts.map((account) => account.id)).toEqual(["savings-primary", "current-account"]);
    expect(accounts.some((account) => account.type === "fixed-deposit")).toBe(false);
    expect(accounts.some((account) => account.type === "recurring-deposit")).toBe(false);
  });

  it("records one synthetic activity and returns the same result for a repeated idempotent confirmation", async () => {
    const draft = await preparePaymentDraft(
      parsePaymentQr("upi://pay?pa=merchant@demo&pn=Demo%20Store&am=125.50&cu=INR"),
      "camera",
      { customerId: "demo-customer-a" },
    );

    const input = {
      draft,
      amountMinorUnits: 12_550,
      fundingAccountId: "savings-primary",
      idempotencyKey: "confirmation-1",
      customerId: "demo-customer-a",
    };
    const first = await executeDemoPayment(input);
    const second = await executeDemoPayment(input);

    expect(first).toEqual(second);
    expect(first.status).toBe("succeeded");
    expect(first.demoDisclosure).toBe("No money was transferred.");
    expect(getDemoPaymentActivities("demo-customer-a")).toHaveLength(1);
  });

  it("keeps deterministic failed and pending outcomes visibly separate", async () => {
    const failedDraft = await preparePaymentDraft(
      createManualPaymentQr("failed@demo"),
      "manual",
      { customerId: "demo-customer-a" },
    );
    const pendingDraft = await preparePaymentDraft(
      createManualPaymentQr("pending@demo"),
      "manual",
      { customerId: "demo-customer-a" },
    );

    await expect(executeDemoPayment({
      draft: failedDraft,
      amountMinorUnits: 500,
      fundingAccountId: "savings-primary",
      idempotencyKey: "failed-1",
      customerId: "demo-customer-a",
    })).resolves.toMatchObject({ status: "failed" });
    await expect(executeDemoPayment({
      draft: pendingDraft,
      amountMinorUnits: 500,
      fundingAccountId: "savings-primary",
      idempotencyKey: "pending-1",
      customerId: "demo-customer-a",
    })).resolves.toMatchObject({ status: "pending" });
    expect(getDemoPaymentActivities("demo-customer-a")).toHaveLength(0);
  });

  it("rejects account access violations, ineligible accounts, and idempotency reuse with changed details", async () => {
    const draft = await preparePaymentDraft(
      createManualPaymentQr("merchant@demo"),
      "manual",
      { customerId: "demo-customer-a" },
    );

    await expect(executeDemoPayment({
      draft,
      amountMinorUnits: 100,
      fundingAccountId: "fixed-deposit",
      idempotencyKey: "ineligible-1",
      customerId: "demo-customer-a",
    })).rejects.toThrow("eligible payment account");

    const firstInput = {
      draft,
      amountMinorUnits: 100,
      fundingAccountId: "savings-primary",
      idempotencyKey: "reuse-1",
      customerId: "demo-customer-a",
    };
    await executeDemoPayment(firstInput);
    await expect(executeDemoPayment({ ...firstInput, amountMinorUnits: 200 })).rejects.toThrow(
      "already used for different payment details",
    );

    await expect(executeDemoPayment({
      draft,
      amountMinorUnits: 100,
      fundingAccountId: "savings-primary",
      idempotencyKey: "customer-b-1",
      customerId: "demo-customer-b",
    })).rejects.toThrow("not available for the signed-in customer");
  });
});
