import { and, desc, eq, sql } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { coachConversations, coachMessages } from "../schema/index.js";

export async function listConversations(userId: string, executor: DbExecutorLike = db) {
  return executor.select({ conversation: coachConversations, messageCount: sql<number>`count(${coachMessages.id})::int` })
    .from(coachConversations)
    .leftJoin(coachMessages, eq(coachMessages.conversationId, coachConversations.id))
    .where(eq(coachConversations.userId, userId))
    .groupBy(coachConversations.id)
    .having(sql`count(${coachMessages.id}) > 0`)
    .orderBy(desc(coachConversations.updatedAt));
}

export async function getConversation(userId: string, conversationId: string, executor: DbExecutorLike = db) {
  const [conversation] = await executor.select().from(coachConversations)
    .where(and(eq(coachConversations.userId, userId), eq(coachConversations.id, conversationId))).limit(1);
  return conversation;
}

export async function listMessages(conversationId: string, executor: DbExecutorLike = db) {
  return executor.select().from(coachMessages).where(eq(coachMessages.conversationId, conversationId)).orderBy(coachMessages.createdAt);
}

export async function insertConversation(input: typeof coachConversations.$inferInsert, executor: DbExecutorLike = db) {
  const [conversation] = await executor.insert(coachConversations).values(input).returning();
  return conversation;
}

export async function insertMessage(input: typeof coachMessages.$inferInsert, executor: DbExecutorLike = db) {
  const [message] = await executor.insert(coachMessages).values(input).returning();
  return message;
}

export async function touchConversation(conversationId: string, executor: DbExecutorLike = db) {
  const [conversation] = await executor.update(coachConversations).set({ updatedAt: new Date() }).where(eq(coachConversations.id, conversationId)).returning();
  return conversation;
}
