import { and, desc, eq, inArray } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { accountBalances, accounts } from "../schema/index.js";

type AccountRow = typeof accounts.$inferSelect;
type BalanceRow = typeof accountBalances.$inferSelect;
export type AccountWithLatestBalance = { account: AccountRow; balance: BalanceRow | null };

async function withLatestBalances(accountRows: AccountRow[], executor: DbExecutorLike): Promise<AccountWithLatestBalance[]> {
  if (accountRows.length === 0) return [];
  const balanceRows = await executor.select().from(accountBalances)
    .where(inArray(accountBalances.accountId, accountRows.map((account) => account.id)))
    .orderBy(desc(accountBalances.asOf), desc(accountBalances.createdAt));
  const latestByAccount = new Map<string, BalanceRow>();
  for (const balance of balanceRows) {
    if (!latestByAccount.has(balance.accountId)) latestByAccount.set(balance.accountId, balance);
  }
  return accountRows.map((account) => ({ account, balance: latestByAccount.get(account.id) ?? null }));
}

export async function listAccounts(userId: string, executor: DbExecutorLike = db) {
  const accountRows = await executor.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.status, "active")))
    .orderBy(desc(accounts.isPrimary), accounts.createdAt);
  return withLatestBalances(accountRows, executor);
}

export async function getAccount(userId: string, accountId: string, executor: DbExecutorLike = db) {
  const [account] = await executor.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);
  return (await withLatestBalances(account ? [account] : [], executor))[0];
}

export async function listAccountBalances(userId: string, executor: DbExecutorLike = db) {
  return executor.select({ accountId: accounts.id, balance: accountBalances })
    .from(accounts)
    .innerJoin(accountBalances, eq(accountBalances.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .orderBy(desc(accountBalances.asOf));
}

export async function insertAccountBalance(input: typeof accountBalances.$inferInsert, executor: DbExecutorLike = db) {
  const [balance] = await executor.insert(accountBalances).values(input).returning();
  return balance;
}
