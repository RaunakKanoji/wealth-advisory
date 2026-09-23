import { and, desc, eq } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { cardControls, cardTransactions, cards } from "../schema/index.js";

export async function listCards(userId: string, accountId?: string, executor: DbExecutorLike = db) {
  return executor.select({ card: cards, controls: cardControls })
    .from(cards)
    .leftJoin(cardControls, eq(cardControls.cardId, cards.id))
    .where(and(eq(cards.userId, userId), accountId ? eq(cards.accountId, accountId) : undefined))
    .orderBy(desc(cards.isPrimary), cards.createdAt);
}

export async function getCard(userId: string, cardId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select({ card: cards, controls: cardControls })
    .from(cards)
    .leftJoin(cardControls, eq(cardControls.cardId, cards.id))
    .where(and(eq(cards.userId, userId), eq(cards.id, cardId))).limit(1);
  return row;
}

export async function updateCardControls(cardId: string, patch: Partial<typeof cardControls.$inferInsert>, executor: DbExecutorLike = db) {
  const [controls] = await executor.update(cardControls).set({ ...patch, updatedAt: new Date() })
    .where(eq(cardControls.cardId, cardId)).returning();
  return controls;
}

export async function updateCard(cardId: string, patch: Partial<typeof cards.$inferInsert>, executor: DbExecutorLike = db) {
  const [card] = await executor.update(cards).set({ ...patch, updatedAt: new Date() })
    .where(eq(cards.id, cardId)).returning();
  return card;
}

export async function listCardTransactions(userId: string, cardId: string, limit = 50, executor: DbExecutorLike = db) {
  return executor.select({ transaction: cardTransactions })
    .from(cardTransactions)
    .innerJoin(cards, eq(cards.id, cardTransactions.cardId))
    .where(and(eq(cards.userId, userId), eq(cards.id, cardId)))
    .orderBy(desc(cardTransactions.transactionAt)).limit(limit);
}

export async function getCardTransaction(userId:string,cardId:string,transactionId:string,executor:DbExecutorLike=db) {
 const [row]=await executor.select({transaction:cardTransactions}).from(cardTransactions).innerJoin(cards,eq(cards.id,cardTransactions.cardId)).where(and(eq(cards.userId,userId),eq(cards.id,cardId),eq(cardTransactions.id,transactionId))).limit(1);
 return row;
}
