import { ApiError } from "../lib/errors.js";
import { fromMinorUnits, parseMinorUnits } from "../lib/money.js";
import * as accountsRepository from "../db/repositories/accounts.repository.js";

export type AccountDto = {
  id: string;
  type: string;
  name: string;
  nickname: string;
  maskedAccountNumber: string;
  currency: string;
  isPrimary: boolean;
  status: string;
  branchName: string | null;
  ifsc: string | null;
  ledgerBalance: string;
  availableBalance: string | null;
  holds: string | null;
  asOf: string | null;
  updatedAt: string | null;
  sourceProvider: string;
  sourceEnvironment: string;
};

function accountDto(row: Awaited<ReturnType<typeof accountsRepository.listAccounts>>[number]): AccountDto {
  const ledgerBalance = row.balance?.ledgerBalance ?? "0.00";
  const isDeposit = row.account.accountType === "fixed_deposit" || row.account.accountType === "recurring_deposit";
  const availableBalance = isDeposit ? null : row.balance?.availableBalance ?? null;
  return {
    id: row.account.id,
    type: row.account.accountType,
    name: row.account.nickname,
    nickname: row.account.nickname,
    maskedAccountNumber: row.account.maskedAccountNumber,
    currency: row.account.currency,
    isPrimary: row.account.isPrimary,
    status: row.account.status,
    branchName: row.account.branchName,
    ifsc: row.account.ifsc,
    ledgerBalance,
    availableBalance,
    holds: row.balance?.holds ?? (availableBalance === null
      ? null
      : fromMinorUnits(parseMinorUnits(ledgerBalance) - parseMinorUnits(availableBalance))),
    asOf: row.balance?.asOf?.toISOString() ?? null,
    updatedAt: row.balance?.asOf?.toISOString() ?? row.account.updatedAt.toISOString(),
    sourceProvider: row.account.sourceProvider,
    sourceEnvironment: row.account.sourceEnvironment,
  };
}

function latestRows(rows: Awaited<ReturnType<typeof accountsRepository.listAccounts>>) {
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.account.id)) latest.set(row.account.id, row);
  }
  return [...latest.values()];
}

export async function listAccounts(userId: string) {
  const rows = latestRows(await accountsRepository.listAccounts(userId));
  const accounts = rows.map(accountDto);
  if (process.env.NODE_ENV !== "production") {
    console.info("[DB] accounts loaded", { accountCount: accounts.length, hasData: accounts.length > 0 });
  }
  const availableToSpend = accounts
    .filter((account) => account.type === "savings" || account.type === "current")
    .reduce((sum, account) => sum + parseMinorUnits(account.availableBalance ?? "0.00"), 0n);
  const deposits = accounts
    .filter((account) => account.type === "fixed_deposit" || account.type === "recurring_deposit")
    .reduce((sum, account) => sum + parseMinorUnits(account.ledgerBalance), 0n);
  const totalBalance = availableToSpend + deposits;
  const asOf = accounts.map((account) => account.asOf).filter(Boolean).sort().at(-1) ?? null;
  return {
    accounts,
    summary: {
      totalBalance: fromMinorUnits(totalBalance),
      availableToSpend: fromMinorUnits(availableToSpend),
      deposits: fromMinorUnits(deposits),
      currency: "INR",
      updatedAt: asOf,
    },
  };
}

/** Canonical owner-scoped account source consumed by Home, Accounts and Coach. */
export async function getAccountsOverview(userId: string) {
  const result = await listAccounts(userId);
  const source = result.accounts.some((account) => account.sourceProvider !== "seed")
    ? "account_aggregator"
    : "demo";
  return {
    ...result,
    meta: {
      source,
      lastUpdated: result.summary.updatedAt,
      stale: false,
      accountCount: result.accounts.length,
    },
  };
}

export async function getAccount(userId: string, accountId: string) {
  const row = await accountsRepository.getAccount(userId, accountId);
  if (!row) throw new ApiError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
  return accountDto(row);
}

export async function requireOwnedAccount(userId: string, accountId: string) {
  const row = await accountsRepository.getAccount(userId, accountId);
  if (!row || row.account.status !== "active") throw new ApiError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
  return row;
}
