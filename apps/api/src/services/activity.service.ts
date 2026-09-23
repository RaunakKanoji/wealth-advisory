import { z } from 'zod';
import { assertScope, getTransactions } from '../coach/repository.js';
import { canonicalCategory, coachQueryPlanSchema, resolvePeriod } from '../coach/plan.js';
import { parseMinorUnits, fromMinorUnits } from '../lib/money.js';
import { ApiError } from '../lib/errors.js';
export const activityQuerySchema = z.object({
    scope: z.object({ mode: z.enum(['all', 'accounts', 'cards', 'mixed']), accountIds: z.array(z.string().max(200)).max(50), cardIds: z.array(z.string().max(200)).max(50) }).strict(),
    search: z.string().max(100), period: z.enum(['all', 'this-month', 'last-month', 'last-90-days', 'custom']), fromDate: z.string().date().optional(), toDate: z.string().date().optional(),
    direction: z.enum(['credit', 'debit', 'all']), status: z.enum(['posted', 'pending', 'failed', 'reversed', 'all']), category: z.string().max(80), channel: z.string().max(50), transactionType: z.string().max(50), currency: z.enum(['INR', 'all']),
    minAmountMinorUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(), maxAmountMinorUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    sort: z.enum(['newest', 'oldest', 'amount-desc', 'amount-asc']), page: z.number().int().min(1).max(10000).default(1), pageSize: z.number().int().min(1).max(100).default(30),
}).strict();
export async function searchActivity(userId: string, raw: unknown) {
    const q = activityQuerySchema.parse(raw);
    if (q.fromDate && q.toDate && q.fromDate > q.toDate)
        throw new ApiError('INVALID_PERIOD', 'Invalid date range.', 422);
    const plan = coachQueryPlanSchema.parse({ intent: 'transaction_search', filters: { accountIds: q.scope.mode === 'cards' ? undefined : q.scope.accountIds, cardIds: q.scope.mode === 'accounts' ? undefined : q.scope.cardIds, search: q.search || undefined, categories: q.category === 'all' ? undefined : [canonicalCategory(q.category === 'bill' ? 'utilities' : q.category)], direction: q.direction === 'all' ? undefined : q.direction, status: q.status === 'all' ? undefined : q.status === 'posted' ? 'completed' : q.status, minimumAmount: q.minAmountMinorUnits === undefined ? undefined : fromMinorUnits(BigInt(q.minAmountMinorUnits)), maximumAmount: q.maxAmountMinorUnits === undefined ? undefined : fromMinorUnits(BigInt(q.maxAmountMinorUnits)) } });
    await assertScope(userId, plan);
    const relative = q.period === 'this-month' ? 'current_month' : q.period === 'last-month' ? 'previous_month' : q.period === 'last-90-days' ? 'last_90_days' : 'all_available';
    const period = resolvePeriod({ relative, from: q.fromDate, to: q.toDate });
    const result = await getTransactions(userId, plan, period, { allStatuses: q.status === 'all', scopeMode: q.scope.mode, channel: q.channel === 'all' ? undefined : q.channel, transactionType: q.transactionType === 'all' ? undefined : q.transactionType === 'cash-withdrawal' ? 'cash' : q.transactionType });
    const rows = result.rows.filter(t => t.currency === 'INR');
    rows.sort((a, b) => {
        if (q.sort.startsWith('amount')) {
            const left = parseMinorUnits(a.amount), right = parseMinorUnits(b.amount);
            const c = left < right ? -1 : left > right ? 1 : 0;
            return (q.sort === 'amount-desc' ? -c : c) || a.id.localeCompare(b.id);
        }
        const c = a.transactionAt.localeCompare(b.transactionAt) || a.id.localeCompare(b.id);
        return q.sort === 'newest' ? -c : c;
    });
    const sum = (kind: string, direction: string) => fromMinorUnits(rows.filter(r => r.kind === kind && r.status === 'completed' && r.direction === direction).reduce((s, r) => s + parseMinorUnits(r.amount), 0n));
    const credits = sum('account', 'credit'), debits = sum('account', 'debit');
    const page = Math.min(q.page, Math.max(1, Math.ceil(rows.length / q.pageSize)));
    return { items: rows.slice((page - 1) * q.pageSize, page * q.pageSize), page, pageSize: q.pageSize, totalItems: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / q.pageSize)), summary: { accountCredits: credits, accountDebits: debits, netAccountMovement: fromMinorUnits(parseMinorUnits(credits) - parseMinorUnits(debits)), cardPostedPurchases: sum('card', 'debit'), cardPostedRefunds: sum('card', 'credit'), includedPostedCount: rows.filter(r => r.status === 'completed').length, pendingCount: rows.filter(r => r.status === 'pending').length, failedCount: rows.filter(r => r.status === 'failed').length }, truncated: result.truncated, dataAsOf: rows.map(r => r.dataAsOf).sort()[0] ?? null, period };
}
