import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
vi.mock('../db/client.js', () => ({ db: { execute: vi.fn(async () => ({ rows: [] })) } }));
vi.mock('../db/repositories/accounts.repository.js', () => ({ getAccount: vi.fn(), listAccounts: vi.fn(async () => []) }));
vi.mock('../db/repositories/cards.repository.js', () => ({ getCard: vi.fn() }));
vi.mock('../db/repositories/wealth.repository.js', () => ({ getGoal: vi.fn(), listGoals: vi.fn(async () => []) }));
import { db } from '../db/client.js';
import { assertScope, getTransactions } from './repository.js';
import { coachQueryPlanSchema, resolvePeriod } from './plan.js';
describe('authorized query construction', () => {
    beforeEach(() => vi.clearAllMocks());
    it('binds ownership in both branches, enforces consent and deduplicates linked cards', async () => {
        await getTransactions('authenticated-user', coachQueryPlanSchema.parse({ intent: 'transaction_search' }), resolvePeriod());
        const query = new PgDialect().sqlToQuery(vi.mocked(db.execute).mock.calls[0][0] as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(query.params).toContain('authenticated-user');
        expect(query.sql).toContain('a.user_id=');
        expect(query.sql).toContain('c.user_id=');
        expect(query.sql).toContain("ac.status='active'");
        expect(query.sql).toContain('ct.transaction_id is null');
    });
    it('parameterizes hostile merchant text instead of treating it as SQL', async () => {
        await getTransactions('u', coachQueryPlanSchema.parse({ intent: 'transaction_search', filters: { merchants: ["x'; DROP TABLE users; --"], status: 'failed', minimumAmount: '5000', search: 'power' } }), resolvePeriod());
        const query = new PgDialect().sqlToQuery(vi.mocked(db.execute).mock.calls[0][0] as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(query.sql).not.toContain('DROP TABLE');
        expect(query.params).toContain('5000');
        expect(query.params).toContain('failed');
        expect(query.params).toContain('%power%');
    });
    it('rejects unknown accounts and cards before retrieval', async () => {
        await expect(assertScope('u', coachQueryPlanSchema.parse({ intent: 'balance_query', filters: { accountIds: ['foreign'] } }))).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
        await expect(assertScope('u', coachQueryPlanSchema.parse({ intent: 'card_spending', filters: { cardIds: ['foreign'] } }))).rejects.toMatchObject({ code: 'CARD_NOT_FOUND' });
        expect(db.execute).not.toHaveBeenCalled();
    });
});

it('does not hide failed or pending records when resolving an exact transaction', async () => {
    vi.mocked(db.execute).mockClear();
    await getTransactions('u', coachQueryPlanSchema.parse({intent:'transaction_detail',filters:{transactionIds:['exact-record']}}),resolvePeriod({relative:'all_available'}));
    const query=new PgDialect().sqlToQuery(vi.mocked(db.execute).mock.calls[0][0] as Parameters<PgDialect['sqlToQuery']>[0]);
    expect(query.sql).not.toContain("t.status='completed'");
    expect(query.params).toContain('exact-record');
});
