import { sql } from 'drizzle-orm';
import { db, type DbExecutorLike } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import * as accountsRepository from '../db/repositories/accounts.repository.js';
import * as cardsRepository from '../db/repositories/cards.repository.js';
import * as wealthRepository from '../db/repositories/wealth.repository.js';
import { normalizeMerchant, type CoachQueryPlan, type Period } from './plan.js';
import type { FinancialAccount, FinancialGoal, FinancialTransaction } from './finance.js';
export async function assertScope(userId: string, plan: CoachQueryPlan) {
    for (const accountId of plan.filters.accountIds ?? []) {
        if (!await accountsRepository.getAccount(userId, accountId))
            throw new ApiError('ACCOUNT_NOT_FOUND', 'Account unavailable or not authorized.', 404);
    }
    for (const cardId of plan.filters.cardIds ?? []) {
        if (!await cardsRepository.getCard(userId, cardId))
            throw new ApiError('CARD_NOT_FOUND', 'Card unavailable or not authorized.', 404);
    }
    if (plan.goalId && !await wealthRepository.getGoal(userId, plan.goalId))
        throw new ApiError('GOAL_NOT_FOUND', 'Goal unavailable or not authorized.', 404);
}
export async function getAccounts(userId: string, plan: CoachQueryPlan): Promise<FinancialAccount[]> {
    const rows = await accountsRepository.listAccounts(userId);
    const accessible = await db.execute<{
        id: string;
    }>(sql `select a.id from accounts a where a.user_id=${userId} and ${accountConsent()}`);
    const allowed = new Set(accessible.rows.map(a => a.id));
    return rows.filter(r => allowed.has(r.account.id) && (!plan.filters.accountIds?.length || plan.filters.accountIds.includes(r.account.id))).map(r => ({ id: r.account.id, name: r.account.nickname, availableBalance: r.balance?.availableBalance ?? null, currency: r.account.currency, dataAsOf: r.balance?.asOf.toISOString() ?? null, environment: r.account.sourceEnvironment }));
}
function accountConsent() {
    return sql `(a.financial_connection_id is null or exists (select 1 from aa_consents ac join aa_consent_accounts aca on aca.consent_id=ac.id where ac.user_id=a.user_id and aca.account_id=a.id and aca.selected=true and ac.status='active' and ac.consent_expiry>now()))`;
}
export async function getGoals(userId: string, plan: CoachQueryPlan): Promise<FinancialGoal[]> {
    return (await wealthRepository.listGoals(userId)).filter(g => (!plan.goalId || g.id === plan.goalId) && (!plan.goalName || g.title.toLowerCase().includes(plan.goalName.toLowerCase()))).map(g => ({ id: g.id, title: g.title, targetAmount: g.targetAmount, currentAmount: g.currentAmount, monthlyContribution: g.monthlyContribution, targetDate: g.targetDate, updatedAt: g.updatedAt.toISOString() }));
}
export async function getTransactions(userId: string, plan: CoachQueryPlan, period: Period, options: {
    allStatuses?: boolean;
    scopeMode?: string;
    transactionType?: string;
    channel?: string;
} = {}, executor: DbExecutorLike = db): Promise<{
    rows: FinancialTransaction[];
    truncated: boolean;
}> {
    const f = plan.filters;
    const conditions = [sql `t.transaction_at < (${period.to}::date + interval '1 day')::timestamp at time zone 'Asia/Kolkata'`];
    if (period.from)
        conditions.push(sql `t.transaction_at >= ${period.from}::date::timestamp at time zone 'Asia/Kolkata'`);
    const accountCondition = f.accountIds ? (f.accountIds.length ? sql `t.account_id in (${sql.join(f.accountIds.map(i => sql `${i}`), sql `,`)})` : sql `false`) : undefined;
    const cardCondition = f.cardIds ? (f.cardIds.length ? sql `t.card_id in (${sql.join(f.cardIds.map(i => sql `${i}`), sql `,`)})` : sql `false`) : undefined;
    if (options.scopeMode === 'all' || options.scopeMode === 'mixed')
        conditions.push(sql `(${accountCondition ?? sql `false`} or ${cardCondition ?? sql `false`})`);
    else {
        if (accountCondition)
            conditions.push(accountCondition);
        if (cardCondition)
            conditions.push(cardCondition);
    }
    if (options.scopeMode === 'accounts')
        conditions.push(sql `t.kind='account'`);
    if (options.transactionType)
        conditions.push(sql `t.transaction_type=${options.transactionType}`);
    if (options.channel)
        conditions.push(sql `t.channel=${options.channel}`);
    if (f.transactionIds)
        conditions.push(f.transactionIds.length ? sql `t.id in (${sql.join(f.transactionIds.map(i => sql `${i}`), sql `,`)})` : sql `false`);
    if (f.categories?.length)
        conditions.push(sql `t.category in (${sql.join(f.categories.map(i => sql `${i}`), sql `,`)})`);
    if (f.status)
        conditions.push(sql `t.status=${f.status}`);
    else if (!options.allStatuses && plan.intent !== 'transaction_detail')
        conditions.push(sql `t.status='completed'`);
    if (f.direction)
        conditions.push(sql `t.direction=${f.direction}`);
    if (f.merchants?.length)
        conditions.push(sql `(${sql.join(f.merchants.map(m => sql `lower(t.merchant) like ${`%${normalizeMerchant(m).replace(/[%_\\]/g, '\\$&')}%`}`), sql ` or `)})`);
    if (f.search)
        conditions.push(sql `(t.description ilike ${`%${f.search.replace(/[%_\\]/g, '\\$&')}%`} or t.merchant ilike ${`%${f.search.replace(/[%_\\]/g, '\\$&')}%`})`);
    if (f.minimumAmount)
        conditions.push(sql `t.amount>=${f.minimumAmount}::numeric`);
    if (f.maximumAmount)
        conditions.push(sql `t.amount<=${f.maximumAmount}::numeric`);
    const result = await executor.execute<{
        id: string;
        account_id: string | null;
        card_id: string | null;
        kind: 'account' | 'card';
        amount: string;
        currency: string;
        direction: 'debit' | 'credit';
        status: string;
        category: string;
        merchant: string;
        description: string;
        transaction_at: string | Date;
        source_environment: string;
        data_as_of: string | Date;
        own_transfer: boolean;
        card_repayment: boolean;
        transaction_type: string;
        channel: string;
        reference: string | null;
    }>(sql `
    with t as (
      select tr.id, tr.account_id, (select ct.card_id from card_transactions ct join cards c on c.id=ct.card_id where ct.transaction_id=tr.id and c.user_id=${userId} limit 1) as card_id,
        'account' as kind,tr.amount,tr.currency,tr.direction::text,tr.status::text,case when tc.slug in ('food_dining','food-and-dining') then 'food' when tc.slug='fee' then 'fees' else coalesce(tc.slug,'other') end as category,
        coalesce(tr.merchant_name,'') as merchant,tr.description,tr.transaction_at,a.source_environment,
        coalesce(ib.ingested_at,tr.updated_at) as data_as_of,
        (coalesce(tr.metadata_json->>'ownTransfer','false')='true' or exists(select 1 from transfers tf where tf.user_id=${userId} and tf.reference=tr.reference and tf.transfer_type='own_account')) as own_transfer,
        coalesce(tr.metadata_json->>'cardRepayment','false')='true' as card_repayment, tr.type::text as transaction_type, tr.metadata_json->>'channel' as channel, tr.reference
      from transactions tr join accounts a on a.id=tr.account_id left join transaction_categories tc on tc.id=tr.category_id left join ingestion_batches ib on ib.id=tr.ingestion_batch_id
      where a.user_id=${userId} and ${accountConsent()}
      union all
      select ct.id,c.account_id,ct.card_id,'card',ct.amount,ct.currency,'debit',ct.status::text,'other',ct.merchant_name,ct.merchant_name,ct.transaction_at,
        coalesce(a.source_environment,'unknown'),ct.created_at,false,false,'purchase',null,null
      from card_transactions ct join cards c on c.id=ct.card_id left join accounts a on a.id=c.account_id
      where c.user_id=${userId} and ct.transaction_id is null and (a.id is null or (a.user_id=${userId} and ${accountConsent()}))
    ) select * from t where ${sql.join(conditions, sql ` and `)} order by transaction_at desc,id desc limit 20001
  `);
    return { rows: result.rows.slice(0, 20000).map(r => ({ id: r.id, accountId: r.account_id, cardId: r.card_id, kind: r.kind, amount: r.amount, currency: r.currency, direction: r.direction, status: r.status, category: r.category, merchant: r.merchant, description: r.description, transactionAt: new Date(r.transaction_at).toISOString(), sourceEnvironment: r.source_environment, dataAsOf: new Date(r.data_as_of).toISOString(), ownTransfer: r.own_transfer, cardRepayment: r.card_repayment, transactionType: r.transaction_type, channel: r.channel, reference: r.reference })), truncated: result.rows.length > 20000 };
}
