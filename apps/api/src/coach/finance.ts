import { fromMinorUnits, parseMinorUnits, percentageFromRatio } from '../lib/money.js';
import { normalizeMerchant, type CoachQueryPlan, type Period } from './plan.js';
export type FinancialTransaction = {
    id: string;
    accountId: string | null;
    cardId: string | null;
    kind: 'account' | 'card';
    amount: string;
    currency: string;
    direction: 'debit' | 'credit';
    status: string;
    category: string;
    merchant: string;
    description: string;
    transactionAt: string;
    sourceEnvironment: string;
    dataAsOf: string;
    ownTransfer: boolean;
    cardRepayment: boolean;
    transactionType?: string;
    channel?: string;
    reference?: string | null;
};
export type FinancialAccount = {
    id: string;
    name: string;
    availableBalance: string | null;
    dataAsOf: string | null;
    environment: string;
    currency: string;
};
export type FinancialGoal = {
    id: string;
    title: string;
    targetAmount: string;
    currentAmount: string;
    monthlyContribution: string | null;
    targetDate: string | null;
    updatedAt: string;
};
export type Bucket = {
    label: string;
    amount: string;
    count: number;
    percentage: string;
};
export type VerifiedFinancialContext = {
    intent: CoachQueryPlan['intent'];
    period: Period;
    query: CoachQueryPlan;
    dataAsOf: string | null;
    dataEnvironment: string;
    transactionCount: number;
    totalDebit: string;
    totalCredit: string;
    net: string;
    categoryTotals: Bucket[];
    merchantTotals: Bucket[];
    trend: Bucket[];
    transactions: FinancialTransaction[];
    accounts: FinancialAccount[];
    goals: (FinancialGoal & {
        remaining: string;
        progress: string;
        monthsToTarget?: string | null;
    })[];
    comparison?: {
        period: Period;
        amount: string;
        count: number;
        difference: string;
        percentage: string | null;
    };
    recurring: {
        merchant: string;
        count: number;
        amount: string;
        transactionIds: string[];
    }[];
    warnings: string[];
    incomplete: boolean;
    calculation: string;
};
const spendingIntents = new Set<CoachQueryPlan['intent']>(['spending_summary', 'category_breakdown', 'merchant_breakdown', 'spending_comparison', 'subscriptions', 'recurring_payments', 'unusual_transactions', 'card_spending', 'spending_trend', 'largest_transactions', 'reduce_spending']);
export function isSpendingIntent(intent: CoachQueryPlan['intent']) { return spendingIntents.has(intent); }
export function selectTransactions(rows: FinancialTransaction[], plan: CoachQueryPlan) {
    return rows.filter(t => {
        if (t.currency !== 'INR')
            return false;
        if (isSpendingIntent(plan.intent) && (t.direction !== 'debit' || t.status !== 'completed' || t.ownTransfer || t.cardRepayment || ['transfer', 'deposit', 'investment'].includes(t.category)))
            return false;
        if (['cash_flow', 'saving_analysis', 'income_analysis'].includes(plan.intent) && (t.status !== 'completed' || t.ownTransfer || t.cardRepayment))
            return false;
        if (plan.intent === 'income_analysis' && (t.direction !== 'credit' || ['transfer', 'deposit', 'refund', 'investment'].includes(t.category)))
            return false;
        return true;
    });
}
export function aggregate(rows: FinancialTransaction[], key: (t: FinancialTransaction) => string): Bucket[] {
    const groups = new Map<string, {
        amount: bigint;
        count: number;
    }>();
    const total = rows.reduce((s, t) => s + parseMinorUnits(t.amount), 0n);
    for (const row of rows) {
        const label = key(row);
        const item = groups.get(label) ?? { amount: 0n, count: 0 };
        item.amount += parseMinorUnits(row.amount);
        item.count++;
        groups.set(label, item);
    }
    return [...groups].map(([label, v]) => ({ label, amount: fromMinorUnits(v.amount), count: v.count, percentage: percentageFromRatio(v.amount, total) })).sort((a, b) => parseMinorUnits(a.amount) > parseMinorUnits(b.amount) ? -1 : parseMinorUnits(a.amount) < parseMinorUnits(b.amount) ? 1 : a.label.localeCompare(b.label));
}
export function calculate(plan: CoachQueryPlan, period: Period, raw: FinancialTransaction[], accounts: FinancialAccount[] = [], goals: FinancialGoal[] = [], comparison?: {
    period: Period;
    rows: FinancialTransaction[];
}, truncated = false): VerifiedFinancialContext {
    const rows = selectTransactions(raw, plan);
    const debit = rows.filter(t => t.direction === 'debit').reduce((s, t) => s + parseMinorUnits(t.amount), 0n);
    const credit = rows.filter(t => t.direction === 'credit').reduce((s, t) => s + parseMinorUnits(t.amount), 0n);
    const warnings: string[] = [];
    if (truncated)
        warnings.push('The result exceeded the analysis limit. Narrow the date range; these totals are partial.');
    if (raw.some(t => t.currency !== 'INR'))
        warnings.push('Non-INR records are excluded; currencies are not combined.');
    if (accounts.some(a => a.availableBalance === null))
        warnings.push('Some accounts have no reported balance. Missing balances are not zero.');
    if (rows.length === 0 && !['education', 'clarification', 'goal_progress', 'goal_simulation', 'balance_query', 'account_overview', 'account_comparison'].includes(plan.intent))
        warnings.push('No matching transactions were found. This does not establish zero spending or complete coverage.');
    const dates = [...rows.map(t => t.dataAsOf), ...accounts.map(a => a.dataAsOf).filter((d): d is string => Boolean(d)), ...goals.map(g => g.updatedAt)].filter(Boolean).sort();
    const dataAsOf = dates[0] ?? null;
    if (dataAsOf && Date.now() - new Date(dataAsOf).valueOf() > 86400000)
        warnings.push('Some source data is older than a day; it may not include the latest activity.');
    const environments = new Set([...rows.map(t => t.sourceEnvironment), ...accounts.map(a => a.environment)]);
    if (environments.has('demo'))
        warnings.push('Includes explicitly seeded demonstration data.');
    if (rows.length)
        warnings.push('Analysis covers available normalized records; provider coverage may be incomplete.');
    let sorted = [...rows].sort((a, b) => a.transactionAt === b.transactionAt ? a.id.localeCompare(b.id) : a.transactionAt.localeCompare(b.transactionAt));
    if (plan.sort.startsWith('amount') || plan.intent === 'largest_transactions')
        sorted.sort((a, b) => parseMinorUnits(a.amount) > parseMinorUnits(b.amount) ? 1 : parseMinorUnits(a.amount) < parseMinorUnits(b.amount) ? -1 : 0);
    if (plan.sort.endsWith('desc') || plan.intent === 'largest_transactions')
        sorted.reverse();
    const merchantTotals = aggregate(rows.filter(t => t.direction === 'debit'), t => normalizeMerchant(t.merchant) || 'Unknown merchant');
    const recurring = merchantTotals.filter(m => {
        const matching = rows.filter(t => normalizeMerchant(t.merchant) === m.label && t.direction === 'debit');
        // Repetition alone is not a subscription: require separate months and similar amounts.
        return new Set(matching.map(t => new Date(new Date(t.transactionAt).valueOf() + 330 * 60000).toISOString().slice(0, 7))).size >= 2 && matching.every(t => { const first = parseMinorUnits(matching[0].amount); const amount = parseMinorUnits(t.amount); return amount * 100n >= first * 90n && amount * 100n <= first * 110n; });
    }).map(m => ({ merchant: m.label, count: m.count, amount: m.amount, transactionIds: rows.filter(t => normalizeMerchant(t.merchant) === m.label && t.direction === 'debit').map(t => t.id) }));
    if (['recurring_payments', 'subscriptions'].includes(plan.intent))
        warnings.push('Recurring candidates are inferred from similar payments in separate months, not confirmed subscriptions.');
    if (plan.intent === 'unusual_transactions') {
        const amounts = rows.map(t => parseMinorUnits(t.amount)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        const median = amounts[Math.floor(amounts.length / 2)];
        sorted = median === undefined ? [] : sorted.filter(t => parseMinorUnits(t.amount) > median * 3n);
        warnings.push('Unusual means above three times the median matching payment; it does not imply fraud.');
    }
    const result: VerifiedFinancialContext = { intent: plan.intent, query: plan, period, dataAsOf, dataEnvironment: environments.size > 1 ? 'mixed' : environments.values().next().value ?? 'unavailable', transactionCount: rows.length, totalDebit: fromMinorUnits(debit), totalCredit: fromMinorUnits(credit), net: fromMinorUnits(credit - debit), categoryTotals: aggregate(rows.filter(t => t.direction === 'debit'), t => t.category), merchantTotals, trend: aggregate(rows.filter(t => t.direction === 'debit'), t => new Date(new Date(t.transactionAt).valueOf() + 330 * 60000).toISOString().slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label)), transactions: sorted.slice(0, plan.limit), accounts, goals: goals.map(g => {
            const target = parseMinorUnits(g.targetAmount), current = parseMinorUnits(g.currentAmount), remaining = target > current ? target - current : 0n;
            const monthly = parseMinorUnits(plan.monthlyContribution ?? g.monthlyContribution ?? '0');
            return { ...g, monthlyContribution: plan.monthlyContribution ?? g.monthlyContribution, remaining: fromMinorUnits(remaining), progress: target ? percentageFromRatio(current, target) : '0.00', ...(plan.intent === 'goal_simulation' ? { monthsToTarget: monthly ? String((remaining + monthly - 1n) / monthly) : null } : {}) };
        }), recurring, warnings, incomplete: truncated || warnings.length > 0, calculation: isSpendingIntent(plan.intent) ? 'Sum of available completed INR debit purchases, excluding own transfers, transfers, investments, deposits and card repayments. Linked card and account records are counted once.' : 'Sum of matching INR records, with status and direction filters applied. Cash flow excludes own transfers and card repayments.' };
    if (comparison) {
        const other = selectTransactions(comparison.rows, plan).filter(t => t.direction === 'debit');
        const prior = other.reduce((s, t) => s + parseMinorUnits(t.amount), 0n);
        result.comparison = { period: comparison.period, amount: fromMinorUnits(prior), count: other.length, difference: fromMinorUnits(debit - prior), percentage: other.length && prior ? percentageFromRatio(debit - prior, prior) : null };
        if (!other.length)
            result.warnings.push('No matching comparison-period records; an increase cannot be established.');
        result.warnings.push('Comparison uses the displayed ranges; a partial current month is not a full-month comparison.');
    }
    return result;
}
export function verifiedSummary(v: VerifiedFinancialContext): string {
    if (v.intent === 'clarification')
        return v.query.clarification ?? 'Please clarify the period or account.';
    if (v.intent === 'education')
        return 'General financial education is temporarily unavailable. Please try again.';
    if (v.goals.length)
        return v.goals.map(g => `${g.title}: ₹${g.currentAmount} allocated toward ₹${g.targetAmount}; ₹${g.remaining} remaining.${g.monthsToTarget !== undefined ? g.monthsToTarget === null ? ' Set a positive monthly contribution to simulate a timeline.' : ` At ₹${g.monthlyContribution} per month, the remaining amount takes ${g.monthsToTarget} months, excluding returns.` : ''}`).join('\n');
    if (['goal_progress', 'goal_simulation'].includes(v.intent))
        return 'No matching saved goal was found.';
    if (['balance_query', 'account_overview', 'account_comparison'].includes(v.intent)) {
        const known = v.accounts.filter(a => a.availableBalance !== null && a.currency === 'INR').sort((a, b) => parseMinorUnits(a.availableBalance!) > parseMinorUnits(b.availableBalance!) ? -1 : 1);
        return known.length ? known.map(a => `${a.name}: ₹${a.availableBalance} available.`).join('\n') : 'No reported account balances are available.';
    }
    if (!v.transactionCount)
        return 'No matching transactions were found for this period. Available data does not establish zero spending.';
    if (v.intent === 'spending_comparison' && v.comparison)
        return v.comparison.count ? `Matching debit spending: ₹${v.totalDebit} for ${v.period.label}, versus ₹${v.comparison.amount} for ${v.comparison.period.label}. Difference: ₹${v.comparison.difference}${v.comparison.percentage !== null ? ` (${v.comparison.percentage}%)` : ''}.` : 'No matching records are available for the comparison period.';
    if (['category_breakdown', 'spending_summary'].includes(v.intent) && v.categoryTotals[0])
        return `${v.categoryTotals[0].label} was the largest matching spending category at ₹${v.categoryTotals[0].amount}. Total matching debit spending was ₹${v.totalDebit} across ${v.transactionCount} records.`;
    if (['merchant_breakdown', 'reduce_spending'].includes(v.intent) && v.merchantTotals[0])
        return `${v.merchantTotals[0].label} accounted for ₹${v.merchantTotals[0].amount} across ${v.merchantTotals[0].count} payments. Matching spending total: ₹${v.totalDebit}.`;
    if (['cash_flow', 'saving_analysis', 'income_analysis'].includes(v.intent))
        return `Matching credits: ₹${v.totalCredit}; debits: ₹${v.totalDebit}; net cash flow: ₹${v.net}. Transfers and repayments are excluded. Credits are not necessarily income.`;
    if (['recurring_payments', 'subscriptions'].includes(v.intent))
        return v.recurring.length ? `${v.recurring.length} possible recurring merchants were found. These are candidates, not confirmed subscriptions.` : 'No recurring payment pattern was established in the selected period.';
    return `${v.transactionCount} matching transactions found for ${v.period.label}. Showing ${v.transactions.length} records.`;
}
// Reject financial numbers not found in verified facts. This is a guard, not a claim of semantic proof.
export function explanationIsGrounded(text: string, verified: VerifiedFinancialContext): boolean {
    const numbers = (s: string) => s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) ?? [];
    const { transactionCount, totalDebit, totalCredit, net, categoryTotals, merchantTotals, trend, period, comparison, recurring } = verified;
    const facts = { transactionCount, totalDebit, totalCredit, net, categoryTotals, merchantTotals, trend, period, comparison, recurring: recurring.map(r => ({ count: r.count, amount: r.amount })), transactions: verified.transactions.map(t => ({ amount: t.amount, date: t.transactionAt })), accounts: verified.accounts.map(a => ({ balance: a.availableBalance, date: a.dataAsOf })), goals: verified.goals.map(g => ({ target: g.targetAmount, current: g.currentAmount, remaining: g.remaining, monthly: g.monthlyContribution, progress: g.progress, months: g.monthsToTarget, date: g.targetDate })) };
    const allowed = new Set(numbers(JSON.stringify(facts)).map(Number));
    return numbers(text).every(n => allowed.has(Number(n))) && !/https?:\/\/|<[^>]+>/.test(text);
}
