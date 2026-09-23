import { ApiError } from '../lib/errors.js';
import { continuePlan, resolvePeriod, type CoachContext, type CoachQueryPlan } from './plan.js';
import { calculate, selectTransactions, explanationIsGrounded, verifiedSummary, type FinancialAccount, type FinancialGoal, type FinancialTransaction, type VerifiedFinancialContext } from './finance.js';
import type { CoachModel } from './model.js';
export interface CoachTools {
    assertScope(userId: string, plan: CoachQueryPlan): Promise<void>;
    getAccounts(userId: string, plan: CoachQueryPlan): Promise<FinancialAccount[]>;
    getGoals(userId: string, plan: CoachQueryPlan): Promise<FinancialGoal[]>;
    getTransactions(userId: string, plan: CoachQueryPlan, period: ReturnType<typeof resolvePeriod>): Promise<{
        rows: FinancialTransaction[];
        truncated: boolean;
    }>;
}
export type InitialScope = {
    accountId?: string;
    cardId?: string;
    goalId?: string;
    transactionId?: string;
    category?: string;
    from?: string;
    to?: string;
    period?: string;
};

function deterministicPlan(question: string, previous?: CoachContext): unknown {
    const normalized = question.trim().toLowerCase();
    const inherit = ['period', 'accounts', 'cards', 'category', 'merchants', 'transactions', 'direction', 'status'];
    if (previous && /^(why|show me the transactions|show transactions|what about last month|how can i reduce|how can i save)/.test(normalized)) {
        if (normalized.startsWith('show')) return { intent: 'recent_transactions', followUpOf: previous.answerId, inherit, period: { relative: 'all_available' }, filters: { direction: 'debit' }, grouping: 'none', sort: 'date_desc', limit: 20 };
        if (normalized.startsWith('how can i reduce')) return { intent: 'reduce_spending', followUpOf: previous.answerId, inherit, filters: { direction: 'debit' }, grouping: 'category', sort: 'amount_desc', limit: 20 };
        return { ...previous.plan, followUpOf: previous.answerId, inherit };
    }
    if (/where did i spend the most|highest.*spend|most.*spend|spend.*most/.test(normalized)) return { intent: 'category_breakdown', period: { relative: 'current_month' }, filters: { direction: 'debit' }, grouping: 'category', sort: 'amount_desc', limit: 20 };
    if (/food|dining|restaurant|grocery|groceries/.test(normalized)) return { intent: 'category_breakdown', period: { relative: 'current_month' }, filters: { direction: 'debit', categories: [normalized.includes('grocery') ? 'groceries' : 'food'] }, grouping: 'category', sort: 'amount_desc', limit: 20 };
    if (/salary|income|earned|received/.test(normalized)) return { intent: 'income_analysis', period: { relative: 'current_month' }, filters: { direction: 'credit', categories: ['salary'] }, grouping: 'category', sort: 'amount_desc', limit: 20 };
    if (/save|saving|savings rate/.test(normalized)) return { intent: 'saving_analysis', period: { relative: 'current_month' }, filters: { direction: 'debit' }, grouping: 'month', sort: 'date_desc', limit: 20 };
    if (/goal|emergency fund|progressing/.test(normalized)) return { intent: 'goal_progress', period: { relative: 'all_available' }, grouping: 'none', sort: 'date_desc', limit: 20 };
    if (/how much money|how much do i have|balance|available balance/.test(normalized)) return { intent: 'balance_query', period: { relative: 'all_available' }, grouping: 'account', sort: 'date_desc', limit: 20 };
    if (/subscription|recurring/.test(normalized)) return { intent: 'subscriptions', period: { relative: 'last_90_days' }, filters: { direction: 'debit' }, grouping: 'merchant', sort: 'amount_desc', limit: 20 };
    if (/biggest expense|largest purchase|biggest purchase/.test(normalized)) return { intent: 'largest_transactions', period: { relative: 'current_month' }, filters: { direction: 'debit' }, grouping: 'none', sort: 'amount_desc', limit: 20 };
    return undefined;
}
export async function executeCoach(input: {
    userId: string;
    question: string;
    consent: boolean;
    previous?: CoachContext;
    history: {
        role: string;
        content: string;
    }[];
    scope?: InitialScope;
}, model: CoachModel, tools: CoachTools) {
    let plan: CoachQueryPlan;
    try {
        plan = continuePlan(await model.plan(input.question, input.consent ? input.previous : undefined, input.consent ? input.history : [], input.consent ? input.scope : undefined), input.consent ? input.previous : undefined);
    }
    catch (error) {
        const transientModelFailure = error instanceof ApiError && ['MODEL_UNAVAILABLE', 'MODEL_RATE_LIMITED', 'MODEL_TIMEOUT'].includes(error.code);
        const fallback = transientModelFailure ? deterministicPlan(input.question, input.consent ? input.previous : undefined) : undefined;
        if (fallback) {
            if (process.env.NODE_ENV !== 'production') console.warn('[AI] using deterministic planner fallback', { question: input.question.slice(0, 80) });
            plan = continuePlan(fallback, input.consent ? input.previous : undefined);
        }
        else if (error instanceof ApiError)
            throw error;
        else
            throw new ApiError('INVALID_QUERY_PLAN', 'I could not form a supported query. Please clarify the account, period, or question and retry.', 422);
    }
    const personal = !['education', 'clarification'].includes(plan.intent);
    if (personal && !input.consent)
        return { content: 'May Wealth Coach use your linked financial data to answer this question?', payload: { consentRequired: true, suggestedPrompts: [] }, plan, context: { plan, period: resolvePeriod(plan.period), transactionIds: [] as string[], category: undefined, merchants: undefined, goalId: undefined } };
    const scope = input.scope;
    if (personal && scope) {
        // The selected screen scope is authoritative; a model cannot broaden it.
        if (scope.accountId)
            plan.filters.accountIds = [scope.accountId];
        if (scope.cardId)
            plan.filters.cardIds = [scope.cardId];
        if (scope.goalId && ['goal_progress', 'goal_simulation'].includes(plan.intent))
            plan.goalId = scope.goalId;
        if (scope.transactionId && !plan.filters.transactionIds)
            plan.filters.transactionIds = [scope.transactionId];
        if (scope.category && !plan.filters.categories && !input.previous)
            plan.filters.categories = [scope.category as NonNullable<CoachQueryPlan['filters']['categories']>[number]];
        if (scope.period && !plan.period) {
            const relative = scope.period === 'current-month' ? 'current_month' : scope.period === 'previous-month' ? 'previous_month' : 'all_available';
            plan.period = { relative };
        }
        if ((scope.from || scope.to) && !plan.period)
            plan.period = { from: scope.from, to: scope.to };
    }
    if (plan.intent === 'transaction_detail' && !plan.period) plan.period = {relative:'all_available'};
    const period = resolvePeriod(plan.period);
    let records: {
        rows: FinancialTransaction[];
        truncated: boolean;
    } = { rows: [], truncated: false };
    let accounts: FinancialAccount[] = [], goals: FinancialGoal[] = [], comparison: {
        period: ReturnType<typeof resolvePeriod>;
        rows: FinancialTransaction[];
    } | undefined;
    if (personal) {
        await tools.assertScope(input.userId, plan);
        try {
            if (['account_overview', 'balance_query', 'account_comparison'].includes(plan.intent))
                accounts = await tools.getAccounts(input.userId, plan);
            else if (['goal_progress', 'goal_simulation'].includes(plan.intent))
                goals = await tools.getGoals(input.userId, plan);
            else {
                records = await tools.getTransactions(input.userId, plan, period);
                if (plan.intent === 'saving_analysis')
                    accounts = await tools.getAccounts(input.userId, plan);
                if (plan.intent === 'spending_comparison') {
                    const otherPeriod = resolvePeriod(plan.comparisonPeriod ?? { relative: 'previous_month' });
                    const other = await tools.getTransactions(input.userId, plan, otherPeriod);
                    records.truncated ||= other.truncated;
                    comparison = { period: otherPeriod, rows: other.rows };
                }
            }
        }
        catch (error) {
            if (error instanceof ApiError)
                throw error;
            throw new ApiError('FINANCIAL_DATA_UNAVAILABLE', "I couldn't retrieve your latest financial data right now. Please retry.", 503);
        }
    }
    const verified = calculate(plan, period, records.rows, accounts, goals, comparison, records.truncated);
    if (plan.intent === 'saving_analysis')
        verified.warnings.push('Cash flow and available balances do not establish affordability: future commitments and earmarked balances may be missing.');
    let content = verifiedSummary(verified), suggestedPrompts: string[] = [], modelStatus = 'verified-fallback';
    if (plan.intent !== 'clarification' && (plan.intent === 'education' || verified.transactionCount > 0 || verified.accounts.length > 0 || verified.goals.length > 0)) {
        try {
            const reply = await model.explain(input.question, verified);
            if (plan.intent === 'education' || explanationIsGrounded(reply.explanation, verified)) {
                content = reply.explanation;
                modelStatus = 'gemini';
            }
            suggestedPrompts = [...new Set(reply.suggestedPrompts)].filter(p => p.length <= 160 && !/[<>]|https?:|\b(?:delete|transfer money|send money)\b/i.test(p)).slice(0, 3);
        }
        catch { /* Financial calculations and evidence remain usable when the writer fails. */ }
    }
    return { content, payload: { ...evidence(verified), suggestedPrompts, modelStatus }, plan, verified, sourceRecords: [...new Map(selectTransactions([...records.rows,...(comparison?.rows??[])],plan).map(row=>[row.id,row])).values()], context: { plan, period, category: verified.categoryTotals[0]?.label ?? plan.filters.categories?.[0], merchants: plan.filters.merchants ?? (plan.intent==='merchant_breakdown'&&verified.merchantTotals[0]?[verified.merchantTotals[0].label]:undefined), calculations:{totalDebit:verified.totalDebit,totalCredit:verified.totalCredit,transactionCount:verified.transactionCount,net:verified.net},sourceReferences:{accountIds:verified.accounts.map(a=>a.id),transactionIds:verified.transactions.map(t=>t.id),goalIds:verified.goals.map(g=>g.id)}, transactionIds: verified.transactions.map(t => t.id), goalId: goals.length === 1 ? goals[0].id : plan.goalId } };
}
export function evidence(v: VerifiedFinancialContext) {
    const cards: {
        type: string;
        title: string;
        value: string;
        description?: string;
    }[] = [];
    if (v.transactionCount && !['education', 'clarification'].includes(v.intent))
        cards.push({ type: 'metric', title: 'Matching transactions', value: String(v.transactionCount) });
    if (v.transactionCount && !['transaction_search', 'transaction_detail', 'recent_transactions', 'transaction_count', 'largest_transactions', 'unusual_transactions'].includes(v.intent))
        cards.push({ type: 'metric', title: 'Matching debits', value: `₹${v.totalDebit}` });
    for (const a of v.accounts)
        cards.push({ type: 'metric', title: a.name, value: a.availableBalance === null ? 'Balance unavailable' : `${a.currency} ${a.availableBalance}` });
    for (const g of v.goals)
        cards.push({ type: 'metric', title: g.title, value: `₹${g.currentAmount} / ₹${g.targetAmount}`, description: `${g.progress}% allocated` });
    const chart = ['category_breakdown', 'spending_summary'].includes(v.intent) ? v.categoryTotals : ['merchant_breakdown', 'reduce_spending'].includes(v.intent) ? v.merchantTotals : v.intent === 'spending_trend' ? v.trend : v.comparison ? [{ label: v.period.label, amount: v.totalDebit, count: v.transactionCount, percentage: '0' }, { label: v.comparison.period.label, amount: v.comparison.amount, count: v.comparison.count, percentage: '0' }] : [];
    return { cards, chart, goals: v.intent === 'goal_simulation' ? v.goals : [], transactions: v.transactions, recurring: v.recurring, sources: [...v.accounts.map(a => ({ type: 'account', id: a.id, label: a.name, period: a.dataAsOf })), ...v.goals.map(g => ({ type: 'goal', id: g.id, label: g.title, period: g.updatedAt })), ...(v.transactionCount ? [{ type: 'calculation', label: v.calculation, period: v.period.label, query: v.query, transactionIds: v.transactions.map(t => t.id), count: v.transactionCount }] : [])], warnings: v.warnings, dataAsOf: v.dataAsOf, dataEnvironment: v.dataEnvironment, incomplete: v.incomplete };
}
