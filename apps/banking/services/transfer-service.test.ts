import { getAccount, getAccountTransactions } from "@/services/accounts-service";
import { parsePaymentQr } from "@/lib/payment-qr-parser";
import { clearDemoTransferLedger } from "@/services/demo-transfer-ledger";
import {
  archiveBeneficiary,
  checkTransferStatus,
  clearTransferServiceState,
  createBeneficiary,
  createTransferQrIntake,
  createTransferDraft,
  executeTransfer,
  getBeneficiaries,
  getTransfer,
  getTransferQrIntake,
  getTransferHistory,
  parseTransferAmount,
  quoteTransfer,
  updateTransferDraft,
} from "@/services/transfer-service";

let sequence = 0;

function customerId(): string {
  sequence += 1;
  return `transfer-service-test-${sequence}`;
}

async function prepareOwnTransfer(scope: string, amount = "1000.00") {
  const draft = await createTransferDraft({
    destinationType: "own-account",
    customerId: scope,
    sourceAccountId: "savings-primary",
    destinationAccountId: "current-account",
  });
  const updated = await updateTransferDraft(draft.id, {
    amountMinorUnits: parseTransferAmount(amount),
    method: "internal",
  }, { customerId: scope });
  const quote = await quoteTransfer(updated.id, { customerId: scope });
  return { draft: updated, quote };
}

describe("transfer service demo adapter", () => {
  beforeEach(async () => {
    await clearTransferServiceState();
    await clearDemoTransferLedger();
  });

  it("completes an own-account transfer once and reconciles both account balances and activity", async () => {
    const scope = customerId();
    const beforeSource = (await getAccount("savings-primary", { customerId: scope }))!;
    const beforeDestination = (await getAccount("current-account", { customerId: scope }))!;
    const { draft, quote } = await prepareOwnTransfer(scope);
    const first = await executeTransfer({ draftId: draft.id, quoteId: quote.id, idempotencyKey: "own-transfer-1", customerId: scope });
    const retry = await executeTransfer({ draftId: draft.id, quoteId: quote.id, idempotencyKey: "own-transfer-1", customerId: scope });

    expect(first).toEqual(retry);
    expect(first.status).toBe("succeeded");
    expect((await getAccount("savings-primary", { customerId: scope }))?.balanceMinorUnits).toBe(beforeSource.balanceMinorUnits - 100_000);
    expect((await getAccount("current-account", { customerId: scope }))?.balanceMinorUnits).toBe(beforeDestination.balanceMinorUnits + 100_000);
    const sourceActivity = await getAccountTransactions("savings-primary", { customerId: scope, filters: { search: first.internalReference } });
    const destinationActivity = await getAccountTransactions("current-account", { customerId: scope, filters: { search: first.internalReference } });
    expect(sourceActivity.totalItems).toBe(1);
    expect(destinationActivity.totalItems).toBe(1);
    expect((await getTransferHistory({ customerId: scope })).totalItems).toBe(1);
  });

  it("preserves leading-zero account numbers, separates entered and returned names, and validates destinations", async () => {
    const scope = customerId();
    const saved = await createBeneficiary({
      type: "bank-account",
      accountNumber: "000123456789",
      confirmAccountNumber: "000123456789",
      ifsc: "IBKL0000123",
      recipientName: "Returned Name",
      nickname: "Family account",
    }, { customerId: scope });

    expect(saved.maskedAccountNumber).toBe("•••• 6789");
    expect(saved.bankReturnedName).toBe("Returned Name");
    expect(saved).not.toHaveProperty("accountNumber");
    await expect(createBeneficiary({
      type: "bank-account",
      accountNumber: "000123456789",
      confirmAccountNumber: "123456789",
      ifsc: "IBKL0000123",
      recipientName: "Someone",
    }, { customerId: scope })).rejects.toThrow("do not match");
    await expect(createBeneficiary({
      type: "bank-account",
      accountNumber: "123456789",
      confirmAccountNumber: "123456789",
      ifsc: "NOT-AN-IFSC",
      recipientName: "Someone",
    }, { customerId: scope })).rejects.toThrow("valid IFSC");
    await archiveBeneficiary(saved.id, { customerId: scope });
    expect((await getBeneficiaries({ customerId: scope })).some((item) => item.id === saved.id)).toBe(false);
  });

  it("does not allow an activating beneficiary to reach review", async () => {
    const scope = customerId();
    const draft = await createTransferDraft({
      destinationType: "bank-account",
      customerId: scope,
      beneficiaryId: "beneficiary-a-activation",
      sourceAccountId: "savings-primary",
    });
    const updated = await updateTransferDraft(draft.id, { amountMinorUnits: 10_000, method: "imps" }, { customerId: scope });
    await expect(quoteTransfer(updated.id, { customerId: scope })).rejects.toThrow("not active yet");
  });

  it("keeps pending and unknown outcomes distinct and never duplicates a retry", async () => {
    const scope = customerId();
    const pendingDraft = await createTransferDraft({ destinationType: "upi", customerId: scope, recipientInput: { type: "upi", upiId: "pending@demo", saveBeneficiary: false }, sourceAccountId: "savings-primary" });
    const pendingUpdated = await updateTransferDraft(pendingDraft.id, { amountMinorUnits: 5_000, method: "upi" }, { customerId: scope });
    const pendingQuote = await quoteTransfer(pendingUpdated.id, { customerId: scope });
    const pending = await executeTransfer({ draftId: pendingUpdated.id, quoteId: pendingQuote.id, idempotencyKey: "pending-1", customerId: scope });
    expect(pending.status).toBe("pending");
    expect(await executeTransfer({ draftId: pendingUpdated.id, quoteId: pendingQuote.id, idempotencyKey: "pending-1", customerId: scope })).toEqual(pending);
    expect((await getAccount("savings-primary", { customerId: scope }))?.balanceMinorUnits).toBe(10_000_000);
    expect((await checkTransferStatus(pending.id, { customerId: scope })).status).toBe("succeeded");
    expect((await getAccount("savings-primary", { customerId: scope }))?.balanceMinorUnits).toBe(9_995_000);

    const unknownDraft = await createTransferDraft({ destinationType: "upi", customerId: scope, recipientInput: { type: "upi", upiId: "unknown@demo", saveBeneficiary: false }, sourceAccountId: "savings-primary" });
    const unknownUpdated = await updateTransferDraft(unknownDraft.id, { amountMinorUnits: 500, method: "upi" }, { customerId: scope });
    const unknownQuote = await quoteTransfer(unknownUpdated.id, { customerId: scope });
    const unknown = await executeTransfer({ draftId: unknownUpdated.id, quoteId: unknownQuote.id, idempotencyKey: "unknown-1", customerId: scope });
    expect((await checkTransferStatus(unknown.id, { customerId: scope })).status).toBe("status-unknown");
    expect((await checkTransferStatus(unknown.id, { customerId: scope })).status).toBe("succeeded");
  });

  it("rejects customer access violations and changed idempotency details", async () => {
    const scope = customerId();
    const otherCustomer = "customer-b-transfer-test";
    const { draft, quote } = await prepareOwnTransfer(scope, "250.00");
    await expect(getTransfer(draft.id, { customerId: otherCustomer })).resolves.toBeUndefined();
    const first = await executeTransfer({ draftId: draft.id, quoteId: quote.id, idempotencyKey: "reuse-transfer", customerId: scope });
    const changedDraft = await createTransferDraft({ destinationType: "upi", customerId: scope, recipientInput: { type: "upi", upiId: "success@demo", saveBeneficiary: false }, sourceAccountId: "savings-primary" });
    const changed = await updateTransferDraft(changedDraft.id, { amountMinorUnits: 25_000, method: "upi" }, { customerId: scope });
    const changedQuote = await quoteTransfer(changed.id, { customerId: scope });
    await expect(executeTransfer({ draftId: changed.id, quoteId: changedQuote.id, idempotencyKey: first.idempotencyKey, customerId: scope })).rejects.toThrow("different transfer details");
    await expect(createTransferDraft({ destinationType: "own-account", customerId: otherCustomer, sourceAccountId: "savings-primary", destinationAccountId: "current-account" })).rejects.toThrow("eligible funding account");
  });

  it("keeps QR handoff data behind an opaque customer-scoped intake", async () => {
    const scope = customerId();
    const intake = await createTransferQrIntake(parsePaymentQr("upi://pay?pa=merchant@demo&pn=Demo%20Store&am=100.00&cu=INR"), { customerId: scope });

    expect(intake.id).toMatch(/^qr-intake-/);
    expect(await getTransferQrIntake(intake.id, { customerId: scope })).toMatchObject({ upiId: "merchant@demo", amountMinorUnits: 10_000 });
    await expect(getTransferQrIntake(intake.id, { customerId: "customer-b-transfer-test" })).resolves.toBeUndefined();
  });
});
