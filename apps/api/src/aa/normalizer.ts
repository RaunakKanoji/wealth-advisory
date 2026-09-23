import { canonicalCategory, normalizeMerchant } from "../coach/plan.js";
import { createHash } from "node:crypto";

import { ApiError } from "../lib/errors.js";
import { assertMoney } from "../lib/money.js";
import type { NormalizedAAAccount, NormalizedAAData, NormalizedAATransaction } from "./types.js";

export const NORMALIZER_VERSION = "aa-rebit-v2.0.0-1";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayAt(root: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) if (Array.isArray(root[key])) return root[key];
  return [];
}

function valueAt(root: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (root[key] !== undefined && root[key] !== null) return root[key];
  return undefined;
}

function requiredString(root: Record<string, unknown>, keys: string[], label: string): string {
  const value = valueAt(root, keys);
  if (typeof value !== "string" || !value.trim()) throw new ApiError("AA_PAYLOAD_INVALID", `Account Aggregator data is missing ${label}.`, 422);
  return value.trim();
}

function optionalString(root: Record<string, unknown>, keys: string[]): string | undefined {
  const value = valueAt(root, keys);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function money(root: Record<string, unknown>, keys: string[], label: string, allowZero = true): string {
  const raw = valueAt(root, keys);
  const text = typeof raw === "number" ? raw.toFixed(2) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || (!allowZero && /^0+(?:\.0{1,2})?$/.test(text))) {
    throw new ApiError("AA_PAYLOAD_INVALID", `Account Aggregator data has an invalid ${label}.`, 422);
  }
  if (/^0+(?:\.0{1,2})?$/.test(text)) return "0.00";
  try {
    return assertMoney(text);
  } catch {
    throw new ApiError("AA_PAYLOAD_INVALID", `Account Aggregator data has an invalid ${label}.`, 422);
  }
}

function dateValue(root: Record<string, unknown>, keys: string[], label: string, optional = false): Date | undefined {
  const raw = valueAt(root, keys);
  if (raw === undefined || raw === null || raw === "") {
    if (optional) return undefined;
    throw new ApiError("AA_PAYLOAD_INVALID", `Account Aggregator data is missing ${label}.`, 422);
  }
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.valueOf())) throw new ApiError("AA_PAYLOAD_INVALID", `Account Aggregator data has an invalid ${label}.`, 422);
  return parsed;
}

function maskedAccountNumber(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  if (/[•*]/.test(cleaned)) return value;
  return `•••• ${cleaned.slice(-4)}`;
}

function accountType(value: string): NormalizedAAAccount["accountType"] {
  const normalized = value.toLowerCase().replace(/[ -]/g, "_");
  if (normalized.includes("current")) return "current";
  if (normalized.includes("recurring")) return "recurring_deposit";
  if (normalized.includes("term") || normalized.includes("fixed")) return "fixed_deposit";
  return "savings";
}

function transactionType(value: string | undefined, description: string): NormalizedAATransaction["type"] {
  const normalized = `${value ?? ""} ${description}`.toLowerCase();
  if (normalized.includes("salary") || normalized.includes("payroll")) return "salary";
  if (normalized.includes("bill") || normalized.includes("utility") || normalized.includes("electricity")) return "bill";
  if (normalized.includes("transfer") || normalized.includes("neft") || normalized.includes("imps") || normalized.includes("upi")) return "transfer";
  if (normalized.includes("refund")) return "refund";
  if (normalized.includes("interest")) return "interest";
  if (normalized.includes("cash") || normalized.includes("atm")) return "cash";
  if (normalized.includes("deposit")) return "deposit";
  if (normalized.includes("fee") || normalized.includes("charge")) return "fee";
  return "purchase";
}

function direction(root: Record<string, unknown>, type: string | undefined): NormalizedAATransaction["direction"] {
  const explicit = optionalString(root, ["direction", "Direction"])?.toLowerCase();
  if (explicit === "credit" || explicit === "cr") return "credit";
  if (explicit === "debit" || explicit === "dr") return "debit";
  const normalized = (type ?? "").toLowerCase();
  return normalized.includes("credit") || normalized === "cr" ? "credit" : "debit";
}

function status(value: string | undefined): NormalizedAATransaction["status"] {
  const normalized = (value ?? "posted").toLowerCase();
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("reverse")) return "reversed";
  return "completed";
}

function categorySlug(value: string | undefined): string { return canonicalCategory(value); }

function hashRecord(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function sourceRecordHash(value: unknown): string {
  return hashRecord(value);
}

export function normalizeAAData(payload: unknown, requestedFrom: Date, requestedTo: Date): NormalizedAAData {
  const root = record(payload);
  const nested = record(root.data ?? root.Data ?? root.fiData ?? root.FIData ?? payload);
  const source = Object.keys(nested).length > 0 ? nested : root;
  const rawAccounts = arrayAt(source, ["accounts", "Accounts", "account", "Account"]);
  const rawTransactions = arrayAt(source, ["transactions", "Transactions", "transaction", "Transaction"]);
  if (rawAccounts.length === 0) throw new ApiError("AA_PAYLOAD_INVALID", "The Account Aggregator payload contained no accounts.", 422);

  const accounts = rawAccounts.map((raw) => {
    const item = record(raw);
    const sourceAccountRef = requiredString(item, ["accountId", "accountID", "AccountId", "linkRefNumber", "accountRef"], "account identifier");
    const accountNumber = requiredString(item, ["maskedAccountNumber", "maskedAccountNo", "accountNumber", "AccountNumber"], "masked account identifier");
    const ledgerBalance = money(item, ["balance", "ledgerBalance", "currentBalance", "Balance"], "account balance");
    const availableBalance = money(item, ["availableBalance", "available", "AvailableBalance"], "available balance");
    const holdsValue = valueAt(item, ["holds", "holdAmount"]);
    const holds = holdsValue === undefined ? "0.00" : money(item, ["holds", "holdAmount"], "holds");
    return {
      sourceAccountRef,
      accountType: accountType(requiredString(item, ["accountType", "type", "AccountType"], "account type")),
      nickname: optionalString(item, ["accountName", "name", "nickname", "AccountName"]) ?? "Linked account",
      maskedAccountNumber: maskedAccountNumber(accountNumber),
      currency: optionalString(item, ["currency", "Currency"]) ?? "INR",
      institutionId: optionalString(item, ["institutionId", "fipId", "FIPId"]),
      institutionName: optionalString(item, ["institutionName", "fipName", "FIPName"]),
      branchName: optionalString(item, ["branchName", "branch"]),
      ifsc: optionalString(item, ["ifsc", "IFSC"]),
      ledgerBalance,
      availableBalance,
      holds,
      sourceReportedAt: dateValue(item, ["balanceDate", "asOf", "BalanceDate"], "balance timestamp", true),
      capabilities: ["balance", "transactions"],
    } satisfies NormalizedAAAccount;
  });

  const transactions = rawTransactions.map((raw) => {
    const item = record(raw);
    const description = requiredString(item, ["description", "narration", "remarks", "Description"], "transaction description");
    const rawType = optionalString(item, ["type", "transactionType", "creditDebitIndicator"]);
    return {
      sourceTransactionId: requiredString(item, ["transactionId", "txnId", "id", "TransactionId"], "transaction identifier"),
      sourceAccountRef: requiredString(item, ["accountId", "accountID", "AccountId", "linkRefNumber", "accountRef"], "transaction account identifier"),
      type: transactionType(rawType, description),
      direction: direction(item, rawType),
      amount: money(item, ["amount", "transactionAmount", "Amount"], "transaction amount", false),
      currency: optionalString(item, ["currency", "Currency"]) ?? "INR",
      description,
      merchantName: normalizeMerchant(optionalString(item, ["merchantName", "merchant", "payee", "MerchantName"]) ?? ""),
      reference: optionalString(item, ["reference", "transactionReference", "refNum", "Reference"]),
      transactionAt: dateValue(item, ["transactionDate", "valueDate", "transactionAt", "TransactionDate"], "transaction timestamp")!,
      status: status(optionalString(item, ["status", "transactionStatus", "Status"])),
      categorySlug: categorySlug(optionalString(item, ["category", "categorySlug", "Category"])),
      sourceReportedAt: dateValue(item, ["postedDate", "sourceReportedAt"], "posted timestamp", true),
    } satisfies NormalizedAATransaction;
  });

  const coverageDates = transactions.map((item) => item.transactionAt).sort((left, right) => left.valueOf() - right.valueOf());
  return {
    connection: {
      providerConnectionId: optionalString(source, ["providerConnectionId", "connectionId", "fipConnectionId"]),
      institutionId: optionalString(source, ["institutionId", "fipId", "FIPId"]),
      institutionName: optionalString(source, ["institutionName", "fipName", "FIPName"]),
    },
    accounts,
    transactions,
    coverageFrom: coverageDates[0] ?? requestedFrom,
    coverageTo: coverageDates.at(-1) ?? requestedTo,
  };
}
