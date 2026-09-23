import { app } from "../src/app.js";

const demoAuthId = process.env.AA_TEST_AUTH_ID ?? "demo-customer-a";

if (process.env.AA_ENABLED !== "true" || process.env.AA_PROVIDER !== "mock") {
  throw new Error("Refusing to run AA acceptance: set AA_ENABLED=true and AA_PROVIDER=mock explicitly.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run AA acceptance in production.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await app.fetch(new Request(`http://aa-acceptance.test${path}`, {
    ...init,
    headers: {
      "x-demo-auth-id": demoAuthId,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  }));
  const payload = await response.json() as T & { error?: { code?: string; message?: string } };
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${payload.error?.code ?? "unknown"}`);
  return payload;
}

const body = {
  purposeCode: "101",
  purposeText: "AA Neon acceptance test",
  fiTypes: ["DEPOSIT"],
  fiSections: ["PROFILE", "SUMMARY", "TRANSACTIONS"],
  accountIds: [],
  fetchType: "ONETIME",
  fetchFrequency: "1",
  consentMode: "STORE",
  consentDurationDays: 7,
  dataLifeDays: 1,
};

const created = await request<{ consent: { id: string }; redirectUrl: string }>("/api/v1/aa/consents", {
  method: "POST",
  body: JSON.stringify(body),
});
if (!created.redirectUrl.startsWith("https://aa.example.test/consent/")) throw new Error("Mock redirect URL was not returned.");

const firstSync = await request<{ session: { status: string } | null }>(`/api/v1/aa/consents/${created.consent.id}/sync`, { method: "POST" });
if (firstSync.session?.status !== "completed") throw new Error(`Expected completed first AA session, got ${firstSync.session?.status ?? "none"}.`);

const firstTransactions = await request<{ items: unknown[] }>("/api/v1/transactions?limit=50");
const secondSync = await request<{ session: { status: string } | null }>(`/api/v1/aa/consents/${created.consent.id}/sync`, { method: "POST" });
if (secondSync.session?.status !== "completed") throw new Error(`Expected completed second AA session, got ${secondSync.session?.status ?? "none"}.`);
const secondTransactions = await request<{ items: unknown[] }>("/api/v1/transactions?limit=50");
if (secondTransactions.items.length !== firstTransactions.items.length) throw new Error("AA transaction upsert was not idempotent.");

console.info("[AA] explicit mock acceptance passed", {
  consentId: created.consent.id,
  transactionCount: secondTransactions.items.length,
  redirectUrl: created.redirectUrl,
});
