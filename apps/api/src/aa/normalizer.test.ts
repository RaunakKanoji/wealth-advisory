import { describe, expect, it } from "vitest";

import { ApiError } from "../lib/errors.js";
import { NORMALIZER_VERSION, normalizeAAData, sourceRecordHash } from "./normalizer.js";

const requestedFrom = new Date("2026-01-01T00:00:00.000Z");
const requestedTo = new Date("2026-01-31T23:59:59.999Z");

describe("Account Aggregator normalizer", () => {
  it("normalizes ReBIT-shaped records without retaining an account number", () => {
    const normalized = normalizeAAData({
      data: {
        accounts: [{
          accountId: "link-001",
          accountNumber: "123456789012",
          accountType: "SAVINGS",
          accountName: "Primary savings",
          balance: "125000.50",
          availableBalance: 124500.5,
          holds: "500.00",
          balanceDate: "2026-01-31T12:00:00+05:30",
          fipId: "IDBI-FIP",
          fipName: "IDBI Bank",
        }],
        transactions: [{
          transactionId: "txn-001",
          accountId: "link-001",
          type: "CREDIT",
          amount: "25000.00",
          narration: "January salary",
          transactionDate: "2026-01-30T09:00:00+05:30",
          postedDate: "2026-01-30T09:01:00+05:30",
          category: "salary",
        }],
      },
    }, requestedFrom, requestedTo);

    expect(NORMALIZER_VERSION).toBe("aa-rebit-v2.0.0-1");
    expect(normalized.accounts[0]).toMatchObject({
      sourceAccountRef: "link-001",
      maskedAccountNumber: "•••• 9012",
      ledgerBalance: "125000.50",
      availableBalance: "124500.50",
      holds: "500.00",
      institutionId: "IDBI-FIP",
    });
    expect(normalized.transactions[0]).toMatchObject({
      sourceTransactionId: "txn-001",
      sourceAccountRef: "link-001",
      direction: "credit",
      type: "salary",
      amount: "25000.00",
      categorySlug: "salary",
    });
    expect(JSON.stringify(normalized)).not.toContain("123456789012");
    expect(normalized.coverageFrom?.toISOString()).toBe("2026-01-30T03:30:00.000Z");
  });

  it("accepts zero balances but rejects zero transaction amounts and malformed records", () => {
    const payload = {
      accounts: [{ accountId: "link-001", accountNumber: "00001111", accountType: "SAVINGS", balance: "0", availableBalance: "0" }],
      transactions: [{ transactionId: "txn-001", accountId: "link-001", amount: "0", description: "Invalid zero transaction", transactionDate: "2026-01-02T00:00:00Z" }],
    };

    expect(() => normalizeAAData(payload, requestedFrom, requestedTo)).toThrowError(ApiError);
    expect(() => normalizeAAData({ accounts: [{ accountId: "link-001" }] }, requestedFrom, requestedTo)).toThrowError(/masked account identifier/);
  });

  it("produces a stable provenance hash for the same normalized record", () => {
    expect(sourceRecordHash({ id: "txn-001", amount: "10.00" })).toBe(sourceRecordHash({ id: "txn-001", amount: "10.00" }));
    expect(sourceRecordHash({ id: "txn-001", amount: "10.00" })).not.toBe(sourceRecordHash({ id: "txn-001", amount: "11.00" }));
  });
});
