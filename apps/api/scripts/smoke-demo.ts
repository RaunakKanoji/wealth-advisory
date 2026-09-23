const baseUrl = (process.env.DEMO_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? process.env.API_PORT ?? "8080"}`).replace(/\/$/, "");
const demoAuthId = process.env.DEMO_AUTH_ID ?? "demo-customer-a";
const headers = { Accept: "application/json", "Content-Type": "application/json", "x-demo-auth-id": demoAuthId };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => null) as T | { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    throw new Error(`${path} failed (${response.status}): ${error?.code ?? "API_ERROR"} ${error?.message ?? "unknown error"}`);
  }
  return payload as T;
}

const apiHealth = await request<{ status: string; service: string }>("/api/health");
if (apiHealth.status !== "ok" || apiHealth.service !== "idbi-api") throw new Error("API health check failed.");

const databaseHealth = await request<{ status: string; database: string }>("/api/health/database");
if (databaseHealth.status !== "ok" || databaseHealth.database !== "connected") throw new Error("Database health check failed.");

const login = await request<{ session: { userId: string } }>("/api/auth/demo", { method: "POST" });
const demoData = await request<{ status: string; hasRequiredData: boolean; counts: { accounts: number; transactions: number; goals: number } }>("/api/health/demo-data");
if (demoData.status !== "ok" || !demoData.hasRequiredData || demoData.counts.accounts < 1 || demoData.counts.transactions < 1 || demoData.counts.goals < 1) {
  throw new Error("Demo data health check found incomplete user-owned data.");
}
const accounts = await request<{ accounts: unknown[] }>("/api/v1/accounts/overview");
const transactions = await request<{ items: unknown[] }>("/api/v1/transactions?limit=50");
const insights = await request<{ items: unknown[] }>("/api/v1/wealth/insights");
const goals = await request<{ items: unknown[] }>("/api/v1/wealth/goals");

if (!login.session.userId || accounts.accounts.length === 0 || transactions.items.length === 0 || insights.items.length === 0 || goals.items.length === 0) {
  throw new Error("Demo smoke check found an empty required response.");
}

await request("/api/v1/coach/consent", { method: "POST", body: JSON.stringify({ granted: true }) });
const coach = await request<{ message?: { content?: string } }>("/api/v1/coach/conversations", {
  method: "POST",
  body: JSON.stringify({ firstMessage: "Where did I spend the most this month?" }),
});
if (!coach.message?.content?.trim()) throw new Error("Coach smoke question returned no answer.");

console.log(JSON.stringify({
  ok: true,
  userId: login.session.userId,
  accounts: accounts.accounts.length,
  transactions: transactions.items.length,
  insights: insights.items.length,
  goals: goals.items.length,
  demoData: demoData.counts,
  coachAnswer: true,
}));
