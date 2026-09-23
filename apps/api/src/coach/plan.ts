import { z } from 'zod';
export const categories = ['salary', 'shopping', 'food', 'groceries', 'transport', 'fuel', 'utilities', 'rent', 'entertainment', 'travel', 'healthcare', 'education', 'transfer', 'cash', 'deposit', 'investment', 'refund', 'fees', 'interest', 'other'] as const;
const identifier = z.string().trim().min(1).max(200);
const date = z.string().date();
export const periodSchema = z.object({
    relative: z.enum(['current_month', 'previous_month', 'current_year', 'last_90_days', 'all_available', 'custom']).optional(),
    from: date.optional(), to: date.optional(),
}).strict().refine(p => p.relative !== 'custom' || Boolean(p.from && p.to), 'Custom periods require both dates')
    .refine(p => !p.from || !p.to || p.from <= p.to, 'Invalid date range');
export const filterSchema = z.object({
    accountIds: z.array(identifier).max(50).optional(), cardIds: z.array(identifier).max(50).optional(),
    transactionIds: z.array(identifier).max(100).optional(),
    status: z.enum(['completed', 'pending', 'failed', 'reversed']).optional(),
    direction: z.enum(['credit', 'debit']).optional(), categories: z.array(z.enum(categories)).max(20).optional(),
    merchants: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    search: z.string().trim().max(100).optional(),
    minimumAmount: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).optional(),
    maximumAmount: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).optional(),
}).strict();
export const coachQueryPlanSchema = z.object({
    intent: z.enum(['account_overview', 'balance_query', 'transaction_search', 'transaction_detail', 'spending_summary', 'category_breakdown', 'merchant_breakdown', 'spending_comparison', 'income_analysis', 'recurring_payments', 'subscriptions', 'unusual_transactions', 'cash_flow', 'saving_analysis', 'goal_progress', 'goal_simulation', 'education', 'card_spending', 'account_comparison', 'transaction_count', 'spending_trend', 'largest_transactions', 'recent_transactions', 'reduce_spending', 'clarification']),
    period: periodSchema.optional(), comparisonPeriod: periodSchema.optional(),
    filters: filterSchema.default({}),
    grouping: z.enum(['category', 'merchant', 'month', 'account', 'none']).default('none'),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
    limit: z.number().int().min(1).max(100).default(20),
    followUpOf: identifier.optional(),
    inherit: z.array(z.enum(['period', 'accounts', 'cards', 'category', 'merchants', 'transactions', 'goal', 'direction', 'status', 'amounts', 'search'])).max(11).default([]),
    goalId: identifier.optional(), goalName: z.string().trim().max(100).optional(),
    monthlyContribution: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).optional(),
    clarification: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((p, c) => {
    if (p.intent === 'clarification' && !p.clarification)
        c.addIssue({ code: 'custom', message: 'Clarification text is required' });
    if (p.inherit.length && !p.followUpOf)
        c.addIssue({ code: 'custom', message: 'Inheritance requires a previous answer reference' });
    if (p.filters.minimumAmount && p.filters.maximumAmount && Number(p.filters.minimumAmount) > Number(p.filters.maximumAmount))
        c.addIssue({ code: 'custom', message: 'Invalid amount range' });
});
export type CoachQueryPlan = z.infer<typeof coachQueryPlanSchema>;
export type Period = {
    from?: string;
    to: string;
    label: string;
};
export type CoachContext = {
    calculations?: {totalDebit:string;totalCredit:string;transactionCount:number;net:string};
    sourceReferences?: {accountIds:string[];transactionIds:string[];goalIds:string[]};
    answerId: string;
    plan: CoachQueryPlan;
    period: Period;
    category?: string;
    merchants?: string[];
    transactionIds: string[];
    goalId?: string;
};
// Calendar boundaries are India-local, independent of the backend host timezone.
export function resolvePeriod(input?: z.infer<typeof periodSchema>, now = new Date()): Period {
    const today = new Date(now.valueOf() + 330 * 60000).toISOString().slice(0, 10);
    const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
    let from = input?.from, to = input?.to ?? today;
    if (!from && !input?.to) {
        switch (input?.relative ?? 'current_month') {
            case 'current_month':
                from = `${today.slice(0, 7)}-01`;
                break;
            case 'previous_month':
                from = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
                to = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
                break;
            case 'current_year':
                from = `${year}-01-01`;
                break;
            case 'last_90_days':
                from = new Date(new Date(`${today}T00:00:00Z`).valueOf() - 89 * 86400000).toISOString().slice(0, 10);
                break;
        }
    }
    return { from, to, label: `${from ?? 'All available data'} – ${to}` };
}
export function continuePlan(raw: unknown, previous?: CoachContext): CoachQueryPlan {
    const plan = coachQueryPlanSchema.parse(raw);
    if (!plan.followUpOf)
        return plan;
    if (!previous || previous.answerId !== plan.followUpOf)
        throw new Error('The referenced answer is unavailable. Please clarify your question.');
    for (const key of plan.inherit) {
        if (key === 'period' && !plan.period)
            plan.period = { relative: previous.period.from ? 'custom' : 'all_available', from: previous.period.from, to: previous.period.to };
        if (key === 'accounts' && !plan.filters.accountIds)
            plan.filters.accountIds = previous.plan.filters.accountIds;
        if (key === 'cards' && !plan.filters.cardIds)
            plan.filters.cardIds = previous.plan.filters.cardIds;
        if (key === 'category' && !plan.filters.categories && previous.category)
            plan.filters.categories = [previous.category as typeof categories[number]];
        if (key === 'merchants' && !plan.filters.merchants)
            plan.filters.merchants = previous.merchants;
        if (key === 'transactions' && !plan.filters.transactionIds)
            plan.filters.transactionIds = previous.transactionIds;
        if (key === 'goal' && !plan.goalId)
            plan.goalId = previous.goalId;
        if (key === 'direction' && !plan.filters.direction)
            plan.filters.direction = previous.plan.filters.direction;
        if (key === 'status' && !plan.filters.status)
            plan.filters.status = previous.plan.filters.status;
        if (key === 'amounts') {
            plan.filters.minimumAmount ??= previous.plan.filters.minimumAmount;
            plan.filters.maximumAmount ??= previous.plan.filters.maximumAmount;
        }
        if (key === 'search' && !plan.filters.search)
            plan.filters.search = previous.plan.filters.search;
    }
    if (plan.inherit.includes('category') && !plan.filters.direction && ['category_breakdown', 'merchant_breakdown', 'spending_summary', 'reduce_spending'].includes(previous.plan.intent))
        plan.filters.direction = 'debit';
    return plan;
}
export function normalizeMerchant(value: string): string {
    return value.normalize('NFKC').replace(/[*@].*$/, '').replace(/\b(UPI|LIMITED|LTD|PRIVATE|PVT)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
export function canonicalCategory(value: string | undefined): typeof categories[number] {
    const normalized = (value ?? '').trim().toLowerCase().replace(/[ &-]+/g, '_');
    const aliases: Record<string, typeof categories[number]> = { food_dining: 'food', food_and_dining: 'food', dining: 'food', restaurants: 'food', bills: 'utilities', utility: 'utilities', electricity: 'utilities', health: 'healthcare', medical: 'healthcare', fee: 'fees', investments: 'investment', groceries: 'groceries' };
    return aliases[normalized] ?? (categories.includes(normalized as typeof categories[number]) ? normalized as typeof categories[number] : 'other');
}
