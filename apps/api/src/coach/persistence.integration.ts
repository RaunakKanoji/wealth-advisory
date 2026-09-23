// Opt-in development database test; Gemini is fully mocked, no banking data is sent.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
vi.mock('./model.js', () => ({ GeminiCoachModel: class {
        async plan() { return { intent: 'education' }; }
        async explain() { return { explanation: 'Compound interest includes interest on previously earned interest.', suggestedPrompts: [] }; }
    } }));
import { db, closeDatabase } from '../db/client.js';
import { users, coachRuns, coachContext } from '../db/schema/index.js';
import { sendMessage, getMessages, listConversations, saveReport, listReports, getAnswerSources } from '../services/coach.service.js';
const userId = randomUUID(), otherUser = randomUUID();
beforeAll(async () => { await db.insert(users).values({ id: userId, externalAuthId: `coach-integration-${userId}` }); });
afterAll(async () => { await db.delete(users).where(eq(users.id, userId)); await closeDatabase(); });
describe('persistent Coach conversations on development database', () => {
    it('persists the answer, run, context, and report and replays one idempotent request', async () => {
        const requestId = randomUUID();
        const message = 'What is compound interest?';
        const first = await sendMessage(userId, { message, requestId });
        const replay = await sendMessage(userId, { message, requestId });
        expect(replay.message.id).toBe(first.message.id);
        const saved = await getMessages(userId, first.conversation.id);
        expect(saved.messages).toHaveLength(2);
        expect(saved.messages[0].role).toBe('user');
        expect(saved.messages[1].content).toContain('Compound interest');
        const [run] = await db.select().from(coachRuns).where(eq(coachRuns.id, requestId));
        expect(run.status).toBe('completed');
        const [context] = await db.select().from(coachContext).where(eq(coachContext.conversationId, first.conversation.id));
        expect(context.contextJson.answerId).toBe(first.message.id);
        await saveReport(userId, first.message.id, 'Education summary');
        expect((await listReports(userId)).items).toHaveLength(1);
        expect((await getAnswerSources(userId,first.message.id,1,20)).totalItems).toBe(0);
        await expect(getAnswerSources(otherUser,first.message.id,1,20)).rejects.toMatchObject({code:'ANSWER_NOT_FOUND'});
        expect((await listConversations(userId)).items).toHaveLength(1);
        await expect(getMessages(otherUser, first.conversation.id)).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
        await expect(sendMessage(otherUser, { message, conversationId: first.conversation.id })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
        await expect(sendMessage(userId, { message: 'Different question', requestId })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    }, 30000);
});
