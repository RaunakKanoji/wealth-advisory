import * as accountsRepository from "../db/repositories/accounts.repository.js";
import * as beneficiariesRepository from "../db/repositories/beneficiaries.repository.js";
import * as transfersRepository from "../db/repositories/transfers.repository.js";
import * as transactionsRepository from "../db/repositories/transactions.repository.js";
import * as notificationsRepository from "../db/repositories/notifications.repository.js";
import * as auditRepository from "../db/repositories/audit.repository.js";
import { db } from "../db/client.js";
import type { DbTransaction } from "../db/client.js";
import { ApiError } from "../lib/errors.js";
import { id } from "../lib/ids.js";
import { assertMoney, fromMinorUnits, parseMinorUnits } from "../lib/money.js";
import { assertBeneficiaryUsable } from "./beneficiaries.service.js";
import { requireOwnedAccount } from "./accounts.service.js";
import { isDemoMode } from "../env.js";

export type TransferInput = {
  sourceAccountId: string;
  beneficiaryId?: string;
  destinationAccountId?: string;
  transferType: "own_account" | "bank" | "upi" | "neft" | "imps" | "rtgs";
  amount: string;
  note?: string;
};

function transferDto(transfer: Awaited<ReturnType<typeof transfersRepository.insertTransfer>>) {
  return {
    id: transfer.id,
    sourceAccountId: transfer.sourceAccountId,
    destinationAccountId: transfer.destinationAccountId,
    beneficiaryId: transfer.beneficiaryId,
    transferType: transfer.transferType,
    amount: transfer.amount,
    currency: transfer.currency,
    note: transfer.note,
    status: transfer.status,
    demoTransaction: transfer.demoTransaction,
    reference: transfer.reference,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
    submittedAt: transfer.submittedAt?.toISOString() ?? null,
    completedAt: transfer.completedAt?.toISOString() ?? null,
  };
}

async function requireTransfer(userId: string, transferId: string) {
  const transfer = await transfersRepository.getTransfer(userId, transferId);
  if (!transfer) throw new ApiError("TRANSFER_NOT_FOUND", "Transfer not found.", 404);
  return transfer;
}

type TransferEventStatus = "draft" | "reviewing" | "submitted" | "processing" | "completed" | "failed" | "cancelled";

async function addEvent(transferId: string, status: TransferEventStatus, message: string, executor?: DbTransaction) {
  return transfersRepository.insertTransferEvent({ id: id("transfer_event"), transferId, status, message }, executor);
}

export async function listTransfers(userId: string) {
  return { items: (await transfersRepository.listTransfers(userId)).map(transferDto) };
}

export async function getTransfer(userId: string, transferId: string) {
  const transfer = await requireTransfer(userId, transferId);
  return { transfer: transferDto(transfer), events: await transfersRepository.getTransferEvents(transfer.id) };
}

export async function createDraft(userId: string, input: TransferInput) {
  if (!isDemoMode) throw new ApiError("DEMO_MODE_REQUIRED", "Real transfers are disabled for this prototype.", 403);
  const amount = assertMoney(input.amount);
  await requireOwnedAccount(userId, input.sourceAccountId);
  if (input.transferType === "own_account") {
    if (!input.destinationAccountId || input.destinationAccountId === input.sourceAccountId) throw new ApiError("INVALID_DESTINATION", "Choose a different destination account.", 422);
    await requireOwnedAccount(userId, input.destinationAccountId);
  } else if (!input.beneficiaryId) {
    throw new ApiError("BENEFICIARY_REQUIRED", "Choose a beneficiary before creating a transfer.", 422);
  } else {
    await beneficiariesRepository.getBeneficiary(userId, input.beneficiaryId).then((beneficiary) => {
      if (!beneficiary) throw new ApiError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
    });
  }
  const transfer = await db.transaction(async (tx) => {
    const created = await transfersRepository.insertTransfer({
      id: id("transfer"),
      userId,
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId ?? null,
      beneficiaryId: input.beneficiaryId ?? null,
      transferType: input.transferType,
      amount,
      currency: "INR",
      note: input.note?.trim() || null,
      status: "draft",
      demoTransaction: true,
      reference: `IDB-DEMO-${Date.now().toString(36).toUpperCase()}`,
    }, tx);
    await addEvent(created.id, "draft", "Transfer draft created.", tx);
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "transfer_draft_created", entityType: "transfer", entityId: created.id, metadataJson: { demo: true } }, tx);
    return created;
  });
  return { transfer: transferDto(transfer), demo: true };
}

export async function reviewTransfer(userId: string, transferId: string) {
  const transfer = await requireTransfer(userId, transferId);
  if (transfer.status !== "draft") throw new ApiError("INVALID_TRANSFER_STATE", "Only draft transfers can be reviewed.", 409);
  if (transfer.beneficiaryId) {
    const beneficiary = await beneficiariesRepository.getBeneficiary(userId, transfer.beneficiaryId);
    if (!beneficiary) throw new ApiError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
    assertBeneficiaryUsable(beneficiary);
  }
  const updated = await db.transaction(async (tx) => {
    const next = await transfersRepository.updateTransfer(transferId, { status: "reviewing" }, tx);
    await addEvent(transferId, "reviewing", "Transfer is ready for demo submission.", tx);
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "transfer_reviewed", entityType: "transfer", entityId: transferId, metadataJson: { demo: true } }, tx);
    return next;
  });
  return { transfer: transferDto(updated) };
}

export async function submitTransfer(userId: string, transferId: string) {
  if (!isDemoMode) throw new ApiError("DEMO_MODE_REQUIRED", "Real transfers are disabled for this prototype.", 403);
  const transfer = await requireTransfer(userId, transferId);
  if (transfer.status !== "reviewing" && transfer.status !== "submitted") throw new ApiError("INVALID_TRANSFER_STATE", "Review the transfer before submitting it.", 409);
  const source = await requireOwnedAccount(userId, transfer.sourceAccountId);
  if (transfer.beneficiaryId) {
    const beneficiary = await beneficiariesRepository.getBeneficiary(userId, transfer.beneficiaryId);
    if (!beneficiary) throw new ApiError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
    assertBeneficiaryUsable(beneficiary);
  }
  const amountMinor = parseMinorUnits(transfer.amount);
  const availableMinor = parseMinorUnits(source.balance?.availableBalance ?? "0.00");
  const now = new Date();
  const succeeds = amountMinor <= availableMinor;
  const updated = await db.transaction(async (tx) => {
    if (!succeeds) {
      const failed = await transfersRepository.updateTransfer(transferId, { status: "failed", submittedAt: now }, tx);
      await addEvent(transferId, "failed", "The demo balance is not sufficient for this transfer.", tx);
      await notificationsRepository.insertNotification({ id: id("notification"), userId, type: "transaction", title: "Transfer failed", message: `₹${transfer.amount} could not be sent because the demo balance is insufficient.`, severity: "attention", destinationRoute: "/(app)/transfers/history", destinationParamsJson: {} }, tx);
      await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "transfer_failed", entityType: "transfer", entityId: transferId, metadataJson: { demo: true, reason: "insufficient_balance" } }, tx);
      return failed;
    }
    const completed = await transfersRepository.updateTransfer(transferId, { status: "completed", submittedAt: now, completedAt: now }, tx);
    await addEvent(transferId, "submitted", "Demo transfer submitted.", tx);
    await addEvent(transferId, "processing", "Demo transfer is processing.", tx);
    await addEvent(transferId, "completed", "Demo transfer completed.", tx);
    const remaining = fromMinorUnits(availableMinor - amountMinor);
    const ledger = parseMinorUnits(source.balance?.ledgerBalance ?? "0.00");
    await accountsRepository.insertAccountBalance({ id: id("balance"), accountId: source.account.id, ledgerBalance: fromMinorUnits(ledger - amountMinor), availableBalance: remaining, currency: "INR", asOf: now }, tx);
    await transactionsRepository.insertTransaction({ id: id("transaction"), accountId: source.account.id, type: "transfer", direction: "debit", amount: transfer.amount, currency: "INR", description: "Demo transfer", merchantName: null, categoryId: "category_transfer", reference: transfer.reference, transactionAt: now, status: "completed", metadataJson: { transferId: transfer.id, demo: true } }, tx);
    if (transfer.destinationAccountId) {
      const destination = await accountsRepository.getAccount(userId, transfer.destinationAccountId, tx);
      if (destination?.balance) {
        const destinationLedger = parseMinorUnits(destination.balance.ledgerBalance);
        const destinationAvailable = parseMinorUnits(destination.balance.availableBalance);
        await accountsRepository.insertAccountBalance({ id: id("balance"), accountId: destination.account.id, ledgerBalance: fromMinorUnits(destinationLedger + amountMinor), availableBalance: fromMinorUnits(destinationAvailable + amountMinor), currency: "INR", asOf: now }, tx);
      }
    }
    await notificationsRepository.insertNotification({ id: id("notification"), userId, type: "transaction", title: "Transfer completed", message: `₹${transfer.amount} was sent as a demo transfer.`, severity: "success", destinationRoute: "/(app)/transfers/history", destinationParamsJson: { transferId } }, tx);
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "transfer_completed", entityType: "transfer", entityId: transferId, metadataJson: { demo: true } }, tx);
    return completed;
  });
  return { transfer: transferDto(updated), demo: true };
}
