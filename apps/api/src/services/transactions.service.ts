import { ApiError } from "../lib/errors.js";
import * as transactionsRepository from "../db/repositories/transactions.repository.js";

export type TransactionFilters = {
  accountId?: string;
  status?: 'completed'|'pending'|'failed'|'reversed';merchant?:string;minimumAmount?:string;maximumAmount?:string;
  sort?: 'date_desc'|'date_asc'|'amount_desc'|'amount_asc';page?:number;
  category?: string;
  direction?: "credit" | "debit";
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
  search?: string;
};

export function encodeCursor(transactionAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ transactionAt: transactionAt.toISOString(), id }), "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { transactionAt?: unknown; id?: unknown };
    if (typeof decoded.transactionAt !== "string" || typeof decoded.id !== "string") return undefined;
    const transactionAt = new Date(decoded.transactionAt);
    return Number.isNaN(transactionAt.valueOf()) ? undefined : { transactionAt, id: decoded.id };
  } catch {
    return undefined;
  }
}

function transactionDto(row: Awaited<ReturnType<typeof transactionsRepository.listTransactions>>[number]) {
  return {
    id: row.transaction.id,
    accountId: row.transaction.accountId,
    type: row.transaction.type,
    direction: row.transaction.direction,
    amount: row.transaction.amount,
    currency: row.transaction.currency,
    description: row.transaction.description,
    merchantName: row.transaction.merchantName,
    category: row.category?.slug ?? null,
    categoryName: row.category?.name ?? null,
    reference: row.transaction.reference,
    transactionAt: row.transaction.transactionAt.toISOString(),
    status: row.transaction.status,
    metadata: row.transaction.metadataJson,
  };
}

export async function listTransactions(userId: string, filters: TransactionFilters) {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 25));
  if(filters.cursor && !decodeCursor(filters.cursor)) throw new ApiError('INVALID_CURSOR','Invalid transaction cursor.',422);
  if(filters.cursor && filters.sort && filters.sort!=='date_desc') throw new ApiError('INVALID_CURSOR','Use page pagination for this sort order.',422);
  const allRows = await transactionsRepository.listTransactions(userId, { ...filters, limit:limit+1, pageSize:limit, cursor:decodeCursor(filters.cursor) });
  const hasMore=allRows.length>limit;
  const rows=allRows.slice(0,limit);
  const items = rows.map(transactionDto);
  const last = rows.at(-1)?.transaction;
  return {
    items,
    nextCursor: last && hasMore ? encodeCursor(last.transactionAt, last.id) : null,
  };
}

export function toTransactionDto(transaction: Awaited<ReturnType<typeof transactionsRepository.insertTransaction>>) {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    type: transaction.type,
    direction: transaction.direction,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    merchantName: transaction.merchantName,
    reference: transaction.reference,
    transactionAt: transaction.transactionAt.toISOString(),
    status: transaction.status,
    metadata: transaction.metadataJson,
  };
}

export async function getTransaction(userId:string,transactionId:string) {
 const row=await transactionsRepository.getTransaction(userId,transactionId);
 if(!row) throw new ApiError('TRANSACTION_NOT_FOUND','Transaction not found.',404);
 return {transaction:transactionDto(row)};
}
