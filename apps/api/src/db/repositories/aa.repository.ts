import { and, desc, eq, or } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import {
  aaConsents,
  aaDataSessions,
  aaWebhookEvents,
  financialConnections,
  ingestionBatches,
  ingestionJobs,
} from "../schema/index.js";

export async function createConnection(input: typeof financialConnections.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(financialConnections).values(input).returning();
  return row;
}

export async function findConnection(userId: string, connectionId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(financialConnections)
    .where(and(eq(financialConnections.userId, userId), eq(financialConnections.id, connectionId))).limit(1);
  return row;
}

export async function findConnectionByProviderId(userId: string, provider: string, providerConnectionId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(financialConnections)
    .where(and(eq(financialConnections.userId, userId), eq(financialConnections.provider, provider), eq(financialConnections.providerConnectionId, providerConnectionId))).limit(1);
  return row;
}

export async function createConsent(input: typeof aaConsents.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(aaConsents).values(input).returning();
  return row;
}

export async function listConsents(userId: string, executor: DbExecutorLike = db) {
  return executor.select().from(aaConsents).where(eq(aaConsents.userId, userId)).orderBy(desc(aaConsents.updatedAt));
}

export async function findConsent(userId: string, consentId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(aaConsents)
    .where(and(eq(aaConsents.userId, userId), eq(aaConsents.id, consentId))).limit(1);
  return row;
}

export async function findConsentById(consentId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(aaConsents).where(eq(aaConsents.id, consentId)).limit(1);
  return row;
}

export async function findConsentByProviderReference(provider: string, providerConsentId?: string, providerConsentHandle?: string, executor: DbExecutorLike = db) {
  if (!providerConsentId && !providerConsentHandle) return undefined;
  const references = [
    providerConsentId ? eq(aaConsents.providerConsentId, providerConsentId) : undefined,
    providerConsentHandle ? eq(aaConsents.providerConsentHandle, providerConsentHandle) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const [row] = await executor.select().from(aaConsents).where(and(eq(aaConsents.provider, provider), or(...references))).limit(1);
  return row;
}

export async function updateConsent(id: string, input: Partial<typeof aaConsents.$inferInsert>, executor: DbExecutorLike = db) {
  const [row] = await executor.update(aaConsents).set({ ...input, updatedAt: new Date() }).where(eq(aaConsents.id, id)).returning();
  return row;
}

export async function createDataSession(input: typeof aaDataSessions.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(aaDataSessions).values(input).returning();
  return row;
}

export async function findDataSession(userId: string, sessionId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(aaDataSessions)
    .where(and(eq(aaDataSessions.userId, userId), eq(aaDataSessions.id, sessionId))).limit(1);
  return row;
}

export async function findDataSessionById(sessionId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(aaDataSessions).where(eq(aaDataSessions.id, sessionId)).limit(1);
  return row;
}

export async function findDataSessionByProviderId(providerSessionId: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(aaDataSessions).where(eq(aaDataSessions.providerSessionId, providerSessionId)).limit(1);
  return row;
}

export async function updateDataSession(id: string, input: Partial<typeof aaDataSessions.$inferInsert>, executor: DbExecutorLike = db) {
  const [row] = await executor.update(aaDataSessions).set({ ...input, updatedAt: new Date() }).where(eq(aaDataSessions.id, id)).returning();
  return row;
}

export async function createIngestionBatch(input: typeof ingestionBatches.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(ingestionBatches).values(input).returning();
  return row;
}

export async function updateIngestionBatch(id: string, input: Partial<typeof ingestionBatches.$inferInsert>, executor: DbExecutorLike = db) {
  const [row] = await executor.update(ingestionBatches).set(input).where(eq(ingestionBatches.id, id)).returning();
  return row;
}

export async function createWebhookEvent(input: typeof aaWebhookEvents.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(aaWebhookEvents).values(input)
    .onConflictDoNothing({ target: [aaWebhookEvents.provider, aaWebhookEvents.eventId] }).returning();
  return row;
}

export async function updateWebhookEvent(id: string, input: Partial<typeof aaWebhookEvents.$inferInsert>, executor: DbExecutorLike = db) {
  const [row] = await executor.update(aaWebhookEvents).set(input).where(eq(aaWebhookEvents.id, id)).returning();
  return row;
}

export async function createIngestionJob(input: typeof ingestionJobs.$inferInsert, executor: DbExecutorLike = db) {
  const [row] = await executor.insert(ingestionJobs).values(input)
    .onConflictDoNothing({ target: [ingestionJobs.sessionId] }).returning();
  return row;
}

export async function findIngestionJob(id: string, executor: DbExecutorLike = db) {
  const [row] = await executor.select().from(ingestionJobs).where(eq(ingestionJobs.id, id)).limit(1);
  return row;
}

export async function updateIngestionJob(id: string, input: Partial<typeof ingestionJobs.$inferInsert>, executor: DbExecutorLike = db) {
  const [row] = await executor.update(ingestionJobs).set({ ...input, updatedAt: new Date() }).where(eq(ingestionJobs.id, id)).returning();
  return row;
}
