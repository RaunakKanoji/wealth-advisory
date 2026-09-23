import { and, eq } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { beneficiaries } from "../schema/index.js";

export async function listBeneficiaries(userId: string, executor: DbExecutorLike = db) {
  return executor.select().from(beneficiaries).where(eq(beneficiaries.userId, userId)).orderBy(beneficiaries.name);
}

export async function getBeneficiary(userId: string, beneficiaryId: string, executor: DbExecutorLike = db) {
  const [beneficiary] = await executor.select().from(beneficiaries)
    .where(and(eq(beneficiaries.userId, userId), eq(beneficiaries.id, beneficiaryId))).limit(1);
  return beneficiary;
}

export async function insertBeneficiary(input: typeof beneficiaries.$inferInsert, executor: DbExecutorLike = db) {
  const [beneficiary] = await executor.insert(beneficiaries).values(input).returning();
  return beneficiary;
}
