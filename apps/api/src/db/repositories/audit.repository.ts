import { db, type DbExecutorLike } from "../client.js";
import { auditEvents } from "../schema/index.js";

export async function insertAuditEvent(input: typeof auditEvents.$inferInsert, executor: DbExecutorLike = db) {
  const [event] = await executor.insert(auditEvents).values(input).returning();
  return event;
}
