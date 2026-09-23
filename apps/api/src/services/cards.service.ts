import { z } from "zod";

import * as cardsRepository from "../db/repositories/cards.repository.js";
import * as auditRepository from "../db/repositories/audit.repository.js";
import { ApiError } from "../lib/errors.js";
import { id } from "../lib/ids.js";
import { db } from "../db/client.js";

export const cardControlsPatchSchema = z.object({
  domesticEnabled: z.boolean().optional(),
  internationalEnabled: z.boolean().optional(),
  onlineEnabled: z.boolean().optional(),
  contactlessEnabled: z.boolean().optional(),
  atmEnabled: z.boolean().optional(),
  dailyPosLimit: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
  dailyOnlineLimit: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
  dailyAtmLimit: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
}).strict();

export const cardStatusPatchSchema = z.object({
  status: z.enum(["active", "temporarily_blocked"]),
}).strict();

export const cardNicknamePatchSchema = z.object({
  nickname: z.string().trim().min(1).max(40),
}).strict();

function cardDto(row: Awaited<ReturnType<typeof cardsRepository.listCards>>[number]) {
  return {
    id: row.card.id,
    writeMode: "simulated", // Until a bank write adapter is configured.

    accountId: row.card.accountId,
    type: row.card.cardType,
    network: row.card.network,
    maskedCardNumber: row.card.maskedCardNumber,
    nickname: row.card.nickname,
    status: row.card.status,
    expiryMonth: row.card.expiryMonth,
    expiryYear: row.card.expiryYear,
    isPrimary: row.card.isPrimary,
    updatedAt: row.card.updatedAt.toISOString(),
    controls: row.controls ? {
      domesticEnabled: row.controls.domesticEnabled,
      internationalEnabled: row.controls.internationalEnabled,
      onlineEnabled: row.controls.onlineEnabled,
      contactlessEnabled: row.controls.contactlessEnabled,
      atmEnabled: row.controls.atmEnabled,
      dailyPosLimit: row.controls.dailyPosLimit,
      dailyOnlineLimit: row.controls.dailyOnlineLimit,
      dailyAtmLimit: row.controls.dailyAtmLimit,
    } : null,
  };
}

function cardTransactionDto(row: Awaited<ReturnType<typeof cardsRepository.listCardTransactions>>[number]) {
  const transaction = row.transaction;
  return {
    id: transaction.id,
    cardId: transaction.cardId,
    transactionId: transaction.transactionId,
    merchantName: transaction.merchantName,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    transactionAt: transaction.transactionAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}

export async function listCards(userId: string, accountId?: string) {
  try {
    return { cards: (await cardsRepository.listCards(userId, accountId)).map(cardDto) };
  } catch (error) {
    console.error("[CARDS] query failed", {
      event: "cards_query_failed",
      userId,
      accountId,
      errorType: error instanceof Error ? error.constructor.name : "UnknownError",
      message: error instanceof Error ? error.message : "unknown error",
    });
    throw error;
  }
}

export async function getCard(userId: string, cardId: string) {
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  return cardDto(row);
}

export async function updateControls(userId: string, cardId: string, input: unknown) {
  const patch = cardControlsPatchSchema.parse(input);
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row || !row.controls) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  await cardsRepository.updateCardControls(cardId, patch);
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "card_control_changed", entityType: "card", entityId: cardId, metadataJson: { changedFields: Object.keys(patch) } });
  const updated = await cardsRepository.getCard(userId, cardId);
  if (!updated) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  return cardDto(updated);
}

export async function updateStatus(userId: string, cardId: string, input: unknown) {
  const { status } = cardStatusPatchSchema.parse(input);
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  const card = await cardsRepository.updateCard(cardId, { status });
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "card_status_changed", entityType: "card", entityId: cardId, metadataJson: { status } });
  return cardDto({ card, controls: row.controls });
}

export async function updateNickname(userId: string, cardId: string, input: unknown) {
  const { nickname } = cardNicknamePatchSchema.parse(input);
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  const card = await cardsRepository.updateCard(cardId, { nickname });
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "card_nickname_changed", entityType: "card", entityId: cardId, metadataJson: { nicknameChanged: true } });
  return cardDto({ card, controls: row.controls });
}

export async function blockCard(userId: string, cardId: string) {
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  if (row.card.status === "blocked") return cardDto(row);
  const card = await db.transaction(async (tx) => {
    const updated = await cardsRepository.updateCard(cardId, { status: "blocked" }, tx);
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "card_blocked", entityType: "card", entityId: cardId, metadataJson: { demo: true } }, tx);
    return updated;
  });
  return { ...cardDto({ card, controls: row.controls }), demo: true };
}

export async function listCardTransactions(userId: string, cardId: string) {
  const row = await cardsRepository.getCard(userId, cardId);
  if (!row) throw new ApiError("CARD_NOT_FOUND", "Card not found.", 404);
  return { items: (await cardsRepository.listCardTransactions(userId, cardId)).map(cardTransactionDto) };
}

export async function getCardTransaction(userId:string,cardId:string,transactionId:string) {
 const row=await cardsRepository.getCardTransaction(userId,cardId,transactionId);
 if(!row) throw new ApiError('TRANSACTION_NOT_FOUND','Card transaction not found.',404);
 return {transaction:cardTransactionDto(row)};
}
