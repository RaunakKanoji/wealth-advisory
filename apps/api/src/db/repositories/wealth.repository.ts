import { getTransactions as getNormalizedTransactions } from "../../coach/repository.js";
import { canonicalCategory, coachQueryPlanSchema, resolvePeriod, type Period } from "../../coach/plan.js";
import {calculate} from "../../coach/finance.js";
import { and, desc, eq, gte, isNull, lt, or } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { accounts, financialInsights, monthlyFinancialSnapshots, transactions, wealthGoals } from "../schema/index.js";
import { fromMinorUnits, parseMinorUnits, percentageFromRatio } from "../../lib/money.js";

export async function listGoals(userId: string, executor: DbExecutorLike = db) {
  return executor.select().from(wealthGoals).where(eq(wealthGoals.userId, userId)).orderBy(desc(wealthGoals.updatedAt));
}

export async function getGoal(userId: string, goalId: string, executor: DbExecutorLike = db) {
  const [goal] = await executor.select().from(wealthGoals).where(and(eq(wealthGoals.userId, userId), eq(wealthGoals.id, goalId))).limit(1);
  return goal;
}

export async function listInsights(userId: string, executor: DbExecutorLike = db) {
  return executor.select().from(financialInsights).where(and(eq(financialInsights.userId, userId), or(isNull(financialInsights.expiresAt), gte(financialInsights.expiresAt, new Date())))).orderBy(desc(financialInsights.createdAt));
}

export async function listSnapshots(userId: string, executor: DbExecutorLike = db) {
  return executor.select().from(monthlyFinancialSnapshots).where(eq(monthlyFinancialSnapshots.userId, userId)).orderBy(desc(monthlyFinancialSnapshots.month));
}

/**
 * Builds the current Coach snapshot from the same account-ledger rows exposed
 * by /accounts and /transactions. Persisted snapshots remain available as
 * historical context, but live AA ingestion never needs a second summary
 * store before Coach can use the new data.
 */
export async function getCurrentSnapshotFromTransactions(userId: string, executor: DbExecutorLike = db) {
  const period=resolvePeriod({relative:'current_month'});
  const plan=coachQueryPlanSchema.parse({intent:'cash_flow',period:{relative:'current_month'}});
  const result=await getNormalizedTransactions(userId,plan,period,{},executor);
  if(!result.rows.length) return undefined;
  const verified=calculate(plan,period,result.rows,[],[],undefined,result.truncated);
  const income=parseMinorUnits(verified.totalCredit),expenses=parseMinorUnits(verified.totalDebit),savings=income-expenses;
  return {month:period.from!,periodEnd:period.to,scopeLabel:verified.incomplete?'Available posted records · coverage may be incomplete':'Posted normalized records',income:verified.totalCredit,expenses:verified.totalDebit,savings:fromMinorUnits(savings),savingsRate:percentageFromRatio(savings,income),spendingChangePercent:'0.00',goalProgressPercent:'0.00',dataAsOf:verified.dataAsOf};
}

function monthPeriod(month: string, throughToday = false): Period {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return resolvePeriod({ relative: "current_month" });

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
  const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const to = throughToday && today.slice(0, 7) === `${match[1]}-${match[2]}` ? today : endOfMonth;
  return { from, to, label: `${from} – ${to}` };
}

function previousMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1)).toISOString().slice(0, 7);
}

function sumDebits(rows: Array<{ amount: string }>): bigint {
  return rows.reduce((total, row) => total + parseMinorUnits(row.amount), 0n);
}

/**
 * Returns the category totals used by both the insight copy and the activity
 * drill-down. The query deliberately uses the normalized Coach transaction
 * repository so posted/consented records have one source of truth.
 */
export async function getCategorySpendingComparison(
  userId: string,
  category: string,
  month: string,
  executor: DbExecutorLike = db,
) {
  const normalizedCategory = canonicalCategory(category);
  const currentPeriod = monthPeriod(month, true);
  const priorPeriod = monthPeriod(previousMonth(month));
  const plan = coachQueryPlanSchema.parse({
    intent: "spending_comparison",
    filters: { categories: [normalizedCategory], direction: "debit" },
  });

  const [current, previous] = await Promise.all([
    getNormalizedTransactions(userId, plan, currentPeriod, { scopeMode: "accounts" }, executor),
    getNormalizedTransactions(userId, plan, priorPeriod, { scopeMode: "accounts" }, executor),
  ]);
  const currentAmount = sumDebits(current.rows);
  const previousAmount = sumDebits(previous.rows);
  const differenceAmount = currentAmount - previousAmount;

  return {
    currentAmount: fromMinorUnits(currentAmount),
    previousAmount: fromMinorUnits(previousAmount),
    differenceAmount: fromMinorUnits(differenceAmount),
    percentageChange: percentageFromRatio(differenceAmount, previousAmount),
    period: currentPeriod.from?.slice(0, 7) ?? month,
    comparisonPeriod: priorPeriod.from?.slice(0, 7) ?? previousMonth(month),
  };
}
