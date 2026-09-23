// Explicit opt-in read-only integration check. Never calls Gemini or provider APIs.
import { db, closeDatabase } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { getTransactions, assertScope, getGoals, getAccounts } from './repository.js';
import { coachQueryPlanSchema, resolvePeriod } from './plan.js';
import { calculate } from './finance.js';
import assert from 'node:assert/strict';
import { searchActivity } from '../services/activity.service.js';
try {
    const user = await db.execute<{
        id: string;
    }>(sql `select id from users where external_auth_id='demo-customer-a' limit 1`);
    assert(user.rows[0], 'Expected existing development fixture identity');
    const userId = user.rows[0].id;
    const plan = coachQueryPlanSchema.parse({ intent: 'transaction_search', period: { relative: 'all_available' } });
    const result = await getTransactions(userId, plan, resolvePeriod(plan.period));
    const expected = await db.execute<{
        count: string;
    }>(sql `select count(*)::text as count from transactions t join accounts a on a.id=t.account_id where a.user_id=${userId} and t.status='completed' and a.financial_connection_id is null and t.transaction_at < (current_date+interval '1 day')::timestamp at time zone 'Asia/Kolkata'`);
    assert(result.rows.length >= Number(expected.rows[0].count), 'Read all account records');
    assert((await getTransactions('unknown-user', plan, resolvePeriod(plan.period))).rows.length === 0, 'Foreign user must have no rows');
    await assert.rejects(() => assertScope('unknown-user', coachQueryPlanSchema.parse({ intent: 'transaction_search', filters: { accountIds: [result.rows[0].accountId!] } })));
    const f = coachQueryPlanSchema.parse({ intent: 'transaction_search', filters: { minimumAmount: '5000', status: 'completed' } });
    assert((await getTransactions(userId, f, resolvePeriod({ relative: 'all_available' }))).rows.every(t => Number(t.amount) >= 5000));
    const merchant = coachQueryPlanSchema.parse({ intent: 'transaction_search', filters: { merchants: ['Swiggy'] } });
    assert((await getTransactions(userId, merchant, resolvePeriod({ relative: 'all_available' }))).rows.every(t => t.merchant.toLowerCase().includes('swiggy')));
    const spendingPlan = coachQueryPlanSchema.parse({ intent: 'category_breakdown', period: { relative: 'current_month' }, filters: { direction: 'debit' } });
    const spendingPeriod = resolvePeriod(spendingPlan.period);
    const spendingRows = await getTransactions(userId, spendingPlan, spendingPeriod);
    const spending = calculate(spendingPlan, spendingPeriod, spendingRows.rows);
    assert(spending.categoryTotals[0], 'Expected current-month debit transactions for the exact Coach question');
    console.log(`[COACH] deterministic current-month result: ${spending.categoryTotals[0].label} ₹${spending.categoryTotals[0].amount}`);
    await getGoals(userId, coachQueryPlanSchema.parse({ intent: 'goal_progress' }));
    await getAccounts(userId, coachQueryPlanSchema.parse({ intent: 'balance_query' }));
    const page = await searchActivity(userId, { scope: { mode: 'accounts', accountIds: result.rows.filter(t => t.accountId).map(t => t.accountId!).filter((v, i, a) => a.indexOf(v) === i), cardIds: [] }, search: '', period: 'all', direction: 'all', status: 'all', category: 'all', channel: 'all', transactionType: 'all', currency: 'INR', sort: 'newest', page: 1, pageSize: 2 });
    assert(page.items.length <= 2);
    assert(page.totalItems >= page.items.length);
    console.log('Read-only development database checks passed: retrieval, ownership, amount filters, merchant filters, goals, balances.');
}
finally {
    await closeDatabase();
}
