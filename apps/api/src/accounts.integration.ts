import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app.js";
import { closeDatabase } from "./db/client.js";
import * as accountsService from "./services/accounts.service.js";

describe("Neon-backed accounts flow", () => {
  it("reports API liveness without requiring a database query", async () => {
    const response = await app.fetch(new Request("http://test.local/api/health", {
      headers: { "x-request-id": "integration-health-001" },
    }));
    const payload = await response.json() as { status: string; api: string; requestId: string };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.api).toBe("ok");
    expect(payload.requestId).toBe("integration-health-001");
    expect(response.headers.get("x-request-id")).toBe("integration-health-001");
  });

  it("reports Neon database health separately", async () => {
    const response = await app.fetch(new Request("http://test.local/api/health/database"));
    const payload = await response.json() as { status: string; database: string };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: "ok", database: "connected" });
  });

  it("reports representative authenticated data queries", async () => {
    const response = await app.fetch(new Request("http://test.local/api/health/data", {
      headers: { "x-demo-auth-id": "demo-customer-a" },
    }));
    const payload = await response.json() as { status: string; accounts: boolean; transactions: boolean; goals: boolean };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: "ok", accounts: true, transactions: true, goals: true });
  });

  it("loads the seeded demo accounts and derives the summary in the service", async () => {
    const result = await accountsService.listAccounts("usr_demo_a");

    expect(result.accounts).toHaveLength(4);
    expect(result.accounts[0]).toMatchObject({
      id: "acc_demo_savings",
      name: "Savings Account",
      availableBalance: "100000.00",
      holds: "1250.00",
    });
    expect(result.summary).toMatchObject({
      totalBalance: "345678.00",
      availableToSpend: "225000.00",
      deposits: "120678.00",
    });
  });

  it("returns the serialized account DTO from GET /api/v1/accounts", async () => {
    const response = await app.fetch(new Request("http://test.local/api/v1/accounts", {
      headers: { "x-demo-auth-id": "demo-customer-a" },
    }));
    const payload = await response.json() as { accounts: Array<{ id: string }>; summary: { totalBalance: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(payload.accounts).toHaveLength(4);
    expect(payload.accounts.map((account) => account.id)).toContain("acc_demo_savings");
    expect(payload.summary.totalBalance).toBe("345678.00");
  });

  it("returns the canonical owner-scoped accounts overview", async () => {
    const response = await app.fetch(new Request("http://test.local/api/v1/accounts/overview", {
      headers: { "x-demo-auth-id": "demo-customer-a" },
    }));
    const payload = await response.json() as { accounts: Array<{ id: string }>; meta: { source: string; accountCount: number; stale: boolean } };

    expect(response.status).toBe(200);
    expect(payload.accounts).toHaveLength(4);
    expect(payload.meta).toMatchObject({ source: "demo", accountCount: 4, stale: false });
  });

  it("returns an empty success response for a valid user with no accounts", async () => {
    const response = await app.fetch(new Request("http://test.local/api/v1/accounts", {
      headers: { "x-demo-auth-id": "demo-customer-b" },
    }));
    const payload = await response.json() as { accounts: unknown[]; summary: { totalBalance: string } };

    expect(response.status).toBe(200);
    expect(payload.accounts).toHaveLength(0);
    expect(payload.summary.totalBalance).toBe("0.00");
  });
});

afterAll(async () => {
  await closeDatabase();
});
