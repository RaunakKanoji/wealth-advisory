import { and, asc, desc, eq, gte, ilike, lte, lt, or } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { accounts, transactionCategories, transactions } from "../schema/index.js";

export type TransactionListFilter = {
  accountId?: string;
  status?: 'completed'|'pending'|'failed'|'reversed';
  merchant?: string;
  search?: string;
  minimumAmount?: string;
  maximumAmount?: string;
  sort?: 'date_desc'|'date_asc'|'amount_desc'|'amount_asc';
  page?: number;
  pageSize?: number;
  category?: string;
  direction?: "credit" | "debit";
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: { transactionAt: Date; id: string };
};

export async function listTransactions(userId: string, filter: TransactionListFilter, executor: DbExecutorLike = db) {
  const conditions = [eq(accounts.userId, userId)];
  if (filter.accountId) conditions.push(eq(transactions.accountId, filter.accountId));
  if (filter.status) conditions.push(eq(transactions.status,filter.status));
  if (filter.merchant) conditions.push(ilike(transactions.merchantName,`%${filter.merchant.replace(/[%_\\]/g,'\\$&')}%`));
  if (filter.search) {const pattern=`%${filter.search.replace(/[%_\\]/g,'\\$&')}%`;conditions.push(or(ilike(transactions.description,pattern),ilike(transactions.merchantName,pattern))!);}
  if (filter.minimumAmount) conditions.push(gte(transactions.amount,filter.minimumAmount));
  if (filter.maximumAmount) conditions.push(lte(transactions.amount,filter.maximumAmount));
  if (filter.category) conditions.push(eq(transactionCategories.slug, filter.category));
  if (filter.direction) conditions.push(eq(transactions.direction, filter.direction));
  if (filter.from) conditions.push(gte(transactions.transactionAt, filter.from));
  if (filter.to) conditions.push(lte(transactions.transactionAt, filter.to));
  if (filter.cursor) {
    conditions.push(or(
      lt(transactions.transactionAt, filter.cursor.transactionAt),
      and(eq(transactions.transactionAt, filter.cursor.transactionAt), lt(transactions.id, filter.cursor.id)),
    )!);
  }
  return executor.select({ transaction: transactions, category: transactionCategories })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(transactionCategories, eq(transactionCategories.id, transactions.categoryId))
    .where(and(...conditions))
    .orderBy(filter.sort==='date_asc'?asc(transactions.transactionAt):filter.sort==='amount_desc'?desc(transactions.amount):filter.sort==='amount_asc'?asc(transactions.amount):desc(transactions.transactionAt), desc(transactions.id))
    .limit(filter.limit).offset(filter.page? (filter.page-1)*(filter.pageSize??filter.limit):0);
}

export async function searchTransactions(userId: string, search: string, limit = 20, executor: DbExecutorLike = db) {
  return executor.select({ transaction: transactions, category: transactionCategories })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(transactionCategories, eq(transactionCategories.id, transactions.categoryId))
    .where(and(eq(accounts.userId, userId), ilike(transactions.description, `%${search}%`)))
    .orderBy(desc(transactions.transactionAt))
    .limit(limit);
}

export async function insertTransaction(input: typeof transactions.$inferInsert, executor: DbExecutorLike = db) {
  const [transaction] = await executor.insert(transactions).values(input).returning();
  return transaction;
}

export async function getTransaction(userId:string,transactionId:string,executor:DbExecutorLike=db) {
 const [row]=await executor.select({transaction:transactions,category:transactionCategories}).from(transactions).innerJoin(accounts,eq(accounts.id,transactions.accountId)).leftJoin(transactionCategories,eq(transactionCategories.id,transactions.categoryId)).where(and(eq(accounts.userId,userId),eq(transactions.id,transactionId))).limit(1);
 return row;
}
