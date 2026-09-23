import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { wealthGoals } from '../db/schema/index.js';
import { ApiError } from '../lib/errors.js';
import * as audit from '../db/repositories/audit.repository.js';
const amount = z.string().regex(/^\d{1,14}(\.\d{1,2})?$/);
export const goalPatchSchema = z.object({ title: z.string().trim().min(1).max(100).optional(), targetAmount: amount.optional(), currentAmount: amount.optional(), monthlyContribution: amount.optional(), targetDate: z.string().date().nullable().optional(), status: z.enum(['active', 'completed', 'paused']).optional() }).strict();
export const goalCreateSchema = goalPatchSchema.extend({ title: z.string().trim().min(1).max(100), targetAmount: amount, type: z.enum(['emergency_fund', 'retirement', 'travel', 'purchase', 'education', 'custom']).default('custom') });
export async function createGoal(userId: string, input: unknown) {
    const values = goalCreateSchema.parse(input);
    return db.transaction(async (tx) => { const [goal] = await tx.insert(wealthGoals).values({ ...values, id: randomUUID(), userId }).returning(); await audit.insertAuditEvent({ id: randomUUID(), userId, eventType: 'goal_created', entityType: 'goal', entityId: goal.id }, tx); return { goal }; });
}
export async function updateGoal(userId: string, id: string, input: unknown) {
    const values = goalPatchSchema.parse(input);
    return db.transaction(async (tx) => { const [goal] = await tx.update(wealthGoals).set({ ...values, updatedAt: new Date() }).where(and(eq(wealthGoals.id, id), eq(wealthGoals.userId, userId))).returning(); if (!goal)
        throw new ApiError('GOAL_NOT_FOUND', 'Goal not found.', 404); await audit.insertAuditEvent({ id: randomUUID(), userId, eventType: 'goal_updated', entityType: 'goal', entityId: id, metadataJson: { fields: Object.keys(values) } }, tx); return { goal }; });
}
