import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { coachConsents, coachContext, coachConversations, coachMessages, coachReports, coachRuns } from '../db/schema/index.js';
import * as repository from '../db/repositories/coach.repository.js';
import * as audit from '../db/repositories/audit.repository.js';
import { type InitialScope } from '../coach/engine.js';
import { executeCoachWithAnalytics } from './wealth-analytics.service.js';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';
type Conversation = NonNullable<Awaited<ReturnType<typeof repository.getConversation>>>;
function conversationDto(c: Conversation) { return { id: c.id, title: c.title, status: c.status, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }; }
function messageDto(m: typeof coachMessages.$inferSelect) { return { ...m, createdAt: m.createdAt.toISOString() }; }
export async function listConversations(userId: string) { return { items: (await repository.listConversations(userId)).map(({ conversation, messageCount }) => ({ ...conversationDto(conversation), messageCount })) }; }
export async function getMessages(userId: string, conversationId: string) {
    const conversation = await repository.getConversation(userId, conversationId);
    if (!conversation)
        throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    return { conversation: conversationDto(conversation), messages: (await repository.listMessages(conversationId)).map(messageDto) };
}
export async function getConsent(userId: string) { const [row] = await db.select().from(coachConsents).where(eq(coachConsents.userId, userId)); return { granted: row?.granted ?? false }; }
export async function setConsent(userId: string, granted: boolean) {
    await db.transaction(async (tx) => {
        await tx.insert(coachConsents).values({ userId, granted }).onConflictDoUpdate({ target: coachConsents.userId, set: { granted, updatedAt: new Date() } });
        if (!granted)
            await tx.update(coachRuns).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(coachRuns.userId, userId), eq(coachRuns.status, 'running')));
        await audit.insertAuditEvent({ id: randomUUID(), userId, eventType: 'coach_consent_changed', entityType: 'user', entityId: userId, metadataJson: { granted } }, tx);
    });
    return { granted };
}
export async function cancelRun(userId: string, runId: string) {
    const rows = await db.update(coachRuns).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(coachRuns.id, runId), eq(coachRuns.userId, userId), eq(coachRuns.status, 'running'))).returning();
    return { cancelled: rows.length > 0 };
}
export async function sendMessage(userId: string, input: {
    conversationId?: string;
    message: string;
    title?: string;
    requestId?: string;
    scope?: InitialScope;
}) {
    const content = input.message.trim();
    if (!content || content.length > 1000)
        throw new ApiError('INVALID_COACH_MESSAGE', 'Messages must contain 1–1,000 characters.', 422);
    const runId = input.requestId ?? randomUUID();
    const claimed = await db.transaction(async (tx) => {
        // Serialize request claiming across API instances. No model calls inside this transaction.
        await tx.execute(sql `select pg_advisory_xact_lock(hashtext(${runId}))`);
        const [existing] = await tx.select().from(coachRuns).where(eq(coachRuns.id, runId));
        if (existing) {
            if (existing.userId !== userId)
                throw new ApiError('RUN_NOT_FOUND', 'Run not found.', 404);
            const c = await repository.getConversation(userId, existing.conversationId, tx);
            const [m] = existing.assistantMessageId ? await tx.select().from(coachMessages).where(eq(coachMessages.id, existing.assistantMessageId)) : [];
            const [original] = await tx.select().from(coachMessages).where(eq(coachMessages.id, existing.userMessageId));
            if (original?.content !== content || (input.conversationId && input.conversationId !== existing.conversationId))
                throw new ApiError('IDEMPOTENCY_CONFLICT', 'This request ID belongs to a different question.', 409);
            if (existing.status === 'failed' || existing.status === 'cancelled') {
                // A retry reclaims the same durable user message and request ID.
                // Remove only the prior failure record so a successful retry does
                // not create a duplicate user/assistant pair.
                if (existing.assistantMessageId)
                    await tx.delete(coachMessages).where(eq(coachMessages.id, existing.assistantMessageId));
                await tx.update(coachRuns).set({ status: 'running', assistantMessageId: null, failureCode: null, updatedAt: new Date() }).where(eq(coachRuns.id, runId));
                if (!c)
                    throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
                return { conversation: c, existing: undefined };
            }
            if (c && m)
                return { conversation: c, existing: m };
            throw new ApiError('RUN_IN_PROGRESS', 'This request is already in progress or was cancelled. Review history before retrying.', 409);
        }
        await tx.execute(sql `select pg_advisory_xact_lock(hashtext(${userId}))`);
        const recent = await tx.execute<{
            count: number;
        }>(sql `select count(*)::int as count from coach_runs where user_id=${userId} and created_at>now()-interval '1 minute'`);
        if (recent.rows[0].count >= 10)
            throw new ApiError('RATE_LIMITED', 'Please wait a minute before sending more Coach questions.', 429);
        let conversation = input.conversationId ? await repository.getConversation(userId, input.conversationId, tx) : undefined;
        if (input.conversationId && !conversation)
            throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
        if (!conversation)
            conversation = await repository.insertConversation({ id: randomUUID(), userId, title: input.title?.trim() || content.slice(0, 60) }, tx);
        await tx.execute(sql `select id from coach_conversations where id=${conversation.id} for update`);
        await tx.update(coachRuns).set({ status: 'failed', failureCode: 'INTERRUPTED', updatedAt: new Date() }).where(and(eq(coachRuns.conversationId, conversation.id), eq(coachRuns.status, 'running'), lt(coachRuns.updatedAt, new Date(Date.now() - 120000))));
        const [active] = await tx.select({ id: coachRuns.id }).from(coachRuns).where(and(eq(coachRuns.conversationId, conversation.id), eq(coachRuns.status, 'running')));
        if (active)
            throw new ApiError('RUN_IN_PROGRESS', 'Wait for the current answer or stop it before sending another question.', 409);
        const message = await repository.insertMessage({ id: randomUUID(), conversationId: conversation.id, role: 'user', content }, tx);
        await tx.insert(coachRuns).values({ id: runId, userId, conversationId: conversation.id, userMessageId: message.id, status: 'running' });
        return { conversation, existing: undefined };
    });
    const conversation = claimed.conversation;
    if (claimed.existing)
        return { conversation: conversationDto(conversation), message: messageDto(claimed.existing), runId };
    try {
        const [saved] = await db.select().from(coachContext).where(eq(coachContext.conversationId, conversation.id));
        const consent = (await getConsent(userId)).granted;
        const history = await repository.listMessages(conversation.id);
        const result = await executeCoachWithAnalytics({ userId, question: content, consent, previous: saved?.contextJson, history: history.map(m => ({ role: m.role, content: m.content })), scope: saved?.scopeJson ?? input.scope }, runId, conversation.id);
        return await db.transaction(async (tx) => {
            // Lock consent before the run, matching revocation's lock order.
            if (result.verified && !['education', 'clarification'].includes(result.plan.intent)) {
                const [currentConsent] = await tx.select().from(coachConsents).where(eq(coachConsents.userId, userId)).for('update');
                if (!currentConsent?.granted)
                    throw new ApiError('CONSENT_REQUIRED', 'Consent was revoked while preparing the response.', 403);
            }
            const [run] = await tx.select().from(coachRuns).where(and(eq(coachRuns.id, runId), eq(coachRuns.userId, userId))).for('update');
            if (run?.status !== 'running')
                throw new ApiError('RUN_CANCELLED', 'This response was stopped.', 409);
            const assistant = await repository.insertMessage({ id: randomUUID(), conversationId: conversation.id, role: 'assistant', content: result.content, structuredPayloadJson: result.payload }, tx);
            if (result.context)
                await tx.insert(coachContext).values({ conversationId: conversation.id, contextJson: { ...result.context, answerId: assistant.id }, scopeJson: saved?.scopeJson ?? input.scope }).onConflictDoUpdate({ target: coachContext.conversationId, set: { contextJson: { ...result.context, answerId: assistant.id }, updatedAt: new Date() } });
            await tx.update(coachRuns).set({ status: 'completed', assistantMessageId: assistant.id, planJson: result.plan, verifiedJson: result.verified as unknown as Record<string, unknown> | undefined, sourceRecordsJson: 'sourceRecords' in result ? result.sourceRecords : [], modelMetadataJson: { model: env.GEMINI_MODEL ?? null, status: 'modelStatus' in result.payload ? result.payload.modelStatus : 'consent-required' }, updatedAt: new Date() }).where(eq(coachRuns.id, runId));
            const updated = await repository.touchConversation(conversation.id, tx);
            await audit.insertAuditEvent({ id: randomUUID(), userId, eventType: 'coach_run_completed', entityType: 'conversation', entityId: conversation.id, metadataJson: { runId, intent: result.plan.intent } }, tx);
            return { conversation: conversationDto(updated), message: messageDto(assistant), runId };
        });
    }
    catch (error) {
        const failure = error instanceof ApiError ? error : new ApiError('COACH_UNAVAILABLE', "I couldn't retrieve your latest financial data right now. Please retry.", 503);
        // Persist an honest failure if storage remains available, but never replace the previous context.
        await db.transaction(async (tx) => {
            const [run] = await tx.select().from(coachRuns).where(eq(coachRuns.id, runId)).for('update');
            if (run?.status !== 'running')
                return;
            const message = await repository.insertMessage({ id: randomUUID(), conversationId: conversation.id, role: 'assistant', content: failure.message, structuredPayloadJson: { error: { code: failure.code, retryable: failure.retryable }, suggestedPrompts: [] } }, tx);
            await tx.update(coachRuns).set({ status: 'failed', failureCode: failure.code, assistantMessageId: message.id, updatedAt: new Date() }).where(eq(coachRuns.id, runId));
        }).catch(() => undefined);
        throw failure;
    }
}
export async function updateConversation(userId: string, conversationId: string, title: string) {
    const [row] = await db.update(coachConversations).set({ title, updatedAt: new Date() }).where(and(eq(coachConversations.userId, userId), eq(coachConversations.id, conversationId))).returning();
    if (!row)
        throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    return { conversation: conversationDto(row) };
}
export async function deleteConversation(userId: string, conversationId: string) { await db.delete(coachConversations).where(and(eq(coachConversations.userId, userId), eq(coachConversations.id, conversationId))); return { deleted: true }; }
export async function listReports(userId: string) { return { items: await db.select({ report: coachReports, message: coachMessages }).from(coachReports).innerJoin(coachMessages, eq(coachMessages.id, coachReports.messageId)).where(eq(coachReports.userId, userId)).orderBy(desc(coachReports.createdAt)) }; }
export async function saveReport(userId: string, messageId: string, title: string) {
    const [message] = await db.select({ id: coachMessages.id }).from(coachMessages).innerJoin(coachConversations, eq(coachConversations.id, coachMessages.conversationId)).where(and(eq(coachConversations.userId, userId), eq(coachMessages.id, messageId), eq(coachMessages.role, 'assistant')));
    if (!message)
        throw new ApiError('MESSAGE_NOT_FOUND', 'Answer not found.', 404);
    const [report] = await db.insert(coachReports).values({ userId, messageId, title }).onConflictDoNothing().returning();
    return { report };
}

export async function getAnswerSources(userId:string,messageId:string,page:number,pageSize:number) {
 const [run]=await db.select({sources:coachRuns.sourceRecordsJson,verified:coachRuns.verifiedJson}).from(coachRuns).where(and(eq(coachRuns.userId,userId),eq(coachRuns.assistantMessageId,messageId),eq(coachRuns.status,'completed')));
 if(!run) throw new ApiError('ANSWER_NOT_FOUND','Answer sources not found.',404);
 const totalItems=run.sources.length,totalPages=Math.max(1,Math.ceil(totalItems/pageSize)),selectedPage=Math.min(page,totalPages);
 return {items:run.sources.slice((selectedPage-1)*pageSize,selectedPage*pageSize),page:selectedPage,totalPages,totalItems,period:run.verified?.period,dataAsOf:run.verified?.dataAsOf,calculation:run.verified?.calculation};
}
