import { and, desc, eq } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { transferEvents, transfers } from "../schema/index.js";

export async function listTransfers(userId: string, limit = 50, executor: DbExecutorLike = db) {
  return executor.select().from(transfers).where(eq(transfers.userId, userId)).orderBy(desc(transfers.createdAt)).limit(limit);
}

export async function getTransfer(userId: string, transferId: string, executor: DbExecutorLike = db) {
  const [transfer] = await executor.select().from(transfers)
    .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId))).limit(1);
  return transfer;
}

export async function getTransferEvents(transferId: string, executor: DbExecutorLike = db) {
  return executor.select().from(transferEvents).where(eq(transferEvents.transferId, transferId)).orderBy(transferEvents.createdAt);
}

export async function insertTransfer(input: typeof transfers.$inferInsert, executor: DbExecutorLike = db) {
  const [transfer] = await executor.insert(transfers).values(input).returning();
  return transfer;
}

export async function updateTransfer(transferId: string, patch: Partial<typeof transfers.$inferInsert>, executor: DbExecutorLike = db) {
  const [transfer] = await executor.update(transfers).set({ ...patch, updatedAt: new Date() }).where(eq(transfers.id, transferId)).returning();
  return transfer;
}

export async function insertTransferEvent(input: typeof transferEvents.$inferInsert, executor: DbExecutorLike = db) {
  const [event] = await executor.insert(transferEvents).values(input).returning();
  return event;
}
