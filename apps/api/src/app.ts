import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

import { env, isDemoMode } from "./env.js";
import { db } from "./db/client.js";
import { requireAuth, type AuthVariables } from "./api/auth.js";
import { v1 } from "./api/routes/v1.js";
import { ApiError, errorResponse } from "./lib/errors.js";
import * as usersRepository from "./db/repositories/users.repository.js";
import { seedDemoData } from "./db/seed.js";
import * as accountsService from "./services/accounts.service.js";
import * as transactionsService from "./services/transactions.service.js";
import * as wealthService from "./services/wealth.service.js";
import { isAAEnabled } from "./env.js";
import { aaNotificationSchema } from "./aa/types.js";
import { verifyAAWebhookSignature } from "./aa/gateway.js";
import * as aaService from "./services/aa.service.js";
import { checkGeminiHealth } from "./coach/model.js";
import { checkWealthAnalyticsHealth, consentRequiredAnalytics, queryWealthAnalytics } from "./services/wealth-analytics.service.js";
import { coachConsents } from "./db/schema/index.js";

export const app = new Hono<{ Variables: AuthVariables }>();

const requiredTables = [
  "users",
  "profiles",
  "financial_connections",
  "aa_consents",
  "aa_data_sessions",
  "aa_consent_accounts",
  "aa_session_accounts",
  "ingestion_batches",
  "record_provenance",
  "aa_webhook_events",
  "ingestion_jobs",
  "accounts",
  "account_balances",
  "transaction_categories",
  "transactions",
  "beneficiaries",
  "transfers",
  "transfer_events",
  "cards",
  "card_controls",
  "card_transactions",
  "notifications",
  "notification_preferences",
  "wealth_goals",
  "financial_insights",
  "monthly_financial_snapshots",
  "coach_conversations",
  "coach_messages",
  "coach_runs",
  "coach_context",
  "coach_consents",
  "coach_reports",
  "service_catalog",
  "service_favorites",
  "audit_events",
] as const;

app.use("/api/*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "x-demo-auth-id", "x-request-id"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], exposeHeaders:["x-request-id"] }));
app.use("/api/*", async (c, next) => {
  const startedAt = Date.now();
  const suppliedId = c.req.header("x-request-id")?.trim();
  const requestId = suppliedId && /^[a-zA-Z0-9_-]{1,100}$/.test(suppliedId) ? suppliedId : `req_${crypto.randomUUID()}`;
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  try {
    await next();
  } finally {
    console.info(JSON.stringify({ event: "api_request", requestId, userId:c.get("userId"), method: c.req.method, path: c.req.path, status: c.res.status, durationMs: Date.now() - startedAt }));
  }
});

function apiHealth(c: Context<{ Variables: AuthVariables }>) {
  return c.json({
    status: "ok",
    service: "idbi-api",
    timestamp: new Date().toISOString(),
    requestId: c.get("requestId"),
  });
}

async function databaseHealth(c: Context<{ Variables: AuthVariables }>) {
  const startedAt = Date.now();
  try {
    const result = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    if (Number(result.rows[0]?.ok) !== 1) throw new Error("Database health query returned an unexpected result.");
    return c.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      requestId: c.get("requestId"),
    });
  } catch (error) {
    console.error("[DB] health check failed", { requestId: c.get("requestId"), message: error instanceof Error ? error.message : "unknown error" });
    return c.json({ status: "error", database: "unavailable", timestamp: new Date().toISOString(), latencyMs: Date.now() - startedAt, error: { code: "DATABASE_UNAVAILABLE", message: "The banking data service is temporarily unavailable.", retryable: true, requestId: c.get("requestId") } }, 503);
  }
}

async function dataHealth(c: Context<{ Variables: AuthVariables }>) {
  const userId = c.get("userId");
  try {
    const [accounts, transactions, goals] = await Promise.all([
      accountsService.listAccounts(userId),
      transactionsService.listTransactions(userId, { limit: 1, sort: "date_desc" }),
      wealthService.listGoals(userId),
    ]);
    return c.json({
      status: "ok",
      accounts: true,
      transactions: true,
      goals: true,
      counts: { accounts: accounts.accounts.length, transactions: transactions.items.length, goals: goals.items.length },
      userResolved: true,
      requestId: c.get("requestId"),
    });
  } catch (error) {
    console.error("[DATA] health check failed", { requestId: c.get("requestId"), userId, stage: "representative_queries", message: error instanceof Error ? error.message : "unknown error" });
    return c.json({
      status: "error",
      accounts: false,
      transactions: false,
      goals: false,
      userResolved: Boolean(userId),
      error: { code: "FINANCIAL_DATA_UNAVAILABLE", message: "Financial data is temporarily unavailable.", retryable: true, requestId: c.get("requestId") },
    }, 503);
  }
}

app.get("/api/health", apiHealth);
app.get("/api/health/database", databaseHealth);
app.get("/api/health/data", requireAuth, dataHealth);
if (process.env.NODE_ENV !== "production") {
  app.get("/api/health/demo-data", requireAuth, async (c) => {
    const userId = c.get("userId");
    try {
      const [user, profile, accounts, transactions, goals, insights, conversations] = await Promise.all([
        usersRepository.findUserById(userId),
        usersRepository.getProfile(userId),
        db.execute<{ count: number }>(sql`select count(*)::int as count from accounts where user_id = ${userId}`),
        db.execute<{ count: number }>(sql`select count(*)::int as count from transactions where account_id in (select id from accounts where user_id = ${userId})`),
        db.execute<{ count: number }>(sql`select count(*)::int as count from wealth_goals where user_id = ${userId}`),
        db.execute<{ count: number }>(sql`select count(*)::int as count from financial_insights where user_id = ${userId}`),
        db.execute<{ count: number }>(sql`select count(*)::int as count from coach_conversations where user_id = ${userId}`),
      ]);
      const counts = {
        accounts: Number(accounts.rows[0]?.count ?? 0),
        transactions: Number(transactions.rows[0]?.count ?? 0),
        goals: Number(goals.rows[0]?.count ?? 0),
        insights: Number(insights.rows[0]?.count ?? 0),
        conversations: Number(conversations.rows[0]?.count ?? 0),
      };
      return c.json({
        status: "ok",
        demoIdentity: c.get("externalAuthId") === env.DEMO_AUTH_ID,
        userResolved: Boolean(user),
        profileResolved: Boolean(profile),
        counts,
        hasRequiredData: Boolean(user && profile && counts.accounts > 0 && counts.transactions > 0 && counts.goals > 0),
        requestId: c.get("requestId"),
      });
    } catch (error) {
      console.error("[DATA] demo data health check failed", { requestId: c.get("requestId"), userId, message: error instanceof Error ? error.message : "unknown error" });
      return c.json({
        status: "error",
        error: { code: "FINANCIAL_DATA_UNAVAILABLE", message: "Demo financial data is temporarily unavailable.", retryable: true, requestId: c.get("requestId") },
      }, 503);
    }
  });
}
app.get("/api/health/ai", async (c) => {
  const health = await checkGeminiHealth(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  return c.json(health, health.status === "ok" ? 200 : 503);
});

app.get("/api/health/wealth-analytics", async (c) => {
  const health = await checkWealthAnalyticsHealth();
  return c.json({ ...health, requestId: c.get("requestId") }, health.reachable || !health.configured ? 200 : 503);
});

const wealthQuerySchema = z.object({
  question: z.string().trim().min(1).max(1000),
  conversationId: z.string().trim().max(160).optional(),
  requestId: z.string().trim().max(160).optional(),
  previous: z.record(z.string(), z.unknown()).optional(),
}).strict();

// Public mobile callers reach analytics through the authenticated Node gateway.
// The internal user id is always taken from requireAuth; it is never accepted
// from the request body.
app.post("/api/wealth/query", requireAuth, async (c) => {
  const input = wealthQuerySchema.parse(await c.req.json());
  const requestId = c.get("requestId");
  const consent = await (async () => {
    const row = await db.select({ granted: coachConsents.granted }).from(coachConsents).where(eq(coachConsents.userId, c.get("userId"))).limit(1);
    return row[0]?.granted === true;
  })();
  if (!consent) return c.json(consentRequiredAnalytics(requestId, input.conversationId));
  return c.json(await queryWealthAnalytics({ userId: c.get("userId"), question: input.question, conversationId: input.conversationId, requestId, previous: input.previous }));
});

app.post("/api/auth/demo", requireAuth, async (c) => {
  if (!isDemoMode || c.get("externalAuthId") !== env.DEMO_AUTH_ID) {
    throw new ApiError("DEMO_AUTH_DISABLED", "Demo login is not enabled for this deployment.", 404);
  }
  const profile = await usersRepository.getProfile(c.get("userId"));
  if (!profile) throw new ApiError("USER_PROFILE_UNAVAILABLE", "The demo profile is not available.", 503);
  const startedAt = new Date().toISOString();
  return c.json({
    session: { type: "demo" as const, userId: c.get("userId"), externalAuthId: c.get("externalAuthId"), startedAt },
    user: { id: c.get("userId"), displayName: profile.displayName, email: "demo.a@example.test" },
  });
});

app.post("/api/demo/reset", async (c) => {
  if (!isDemoMode || c.req.header("x-demo-auth-id")?.trim() !== env.DEMO_AUTH_ID) {
    throw new ApiError("DEMO_RESET_DISABLED", "Demo reset is not enabled for this deployment.", 404);
  }
  await seedDemoData();
  return c.json({ status: "ok", reset: true, userId: env.DEMO_USER_ID });
});

app.post("/api/webhooks/aa/:provider", async (c) => {
  if (!isAAEnabled) return c.json({ error: { code: "AA_NOT_CONFIGURED", message: "Account Aggregator integration is disabled." } }, 503);
  const rawBody = await c.req.text();
  if (!verifyAAWebhookSignature(rawBody, { jwsSignature: c.req.header("x-jws-signature"), hmacSignature: c.req.header("x-aa-signature") })) {
    return c.json({ error: { code: "AA_WEBHOOK_UNAUTHORIZED", message: "The Account Aggregator webhook signature could not be verified." } }, 401);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: { code: "AA_WEBHOOK_INVALID", message: "The Account Aggregator webhook payload is not valid JSON." } }, 422);
  }
  return c.json(await aaService.handleWebhook(c.req.param("provider"), aaNotificationSchema.parse(payload), createHash("sha256").update(rawBody).digest("hex")), 202);
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api/dev/database-status", requireAuth, async (c) => {
    const tableRows = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (${sql.join(requiredTables.map((table) => sql`${table}`), sql`, `)})
    `);
    const tableNames = new Set(tableRows.rows.map((row) => row.table_name));
    const [usersCount, accountsCount, balancesCount] = await Promise.all([
      db.execute<{ count: number }>(sql`select count(*)::int as count from users`),
      db.execute<{ count: number }>(sql`select count(*)::int as count from accounts`),
      db.execute<{ count: number }>(sql`select count(*)::int as count from account_balances`),
    ]);
    const currentUserAccounts = await accountsService.listAccounts(c.get("userId"));
    return c.json({
      databaseConnected: true,
      migrationsApplied: requiredTables.every((table) => tableNames.has(table)),
      users: Number(usersCount.rows[0]?.count ?? 0),
      accounts: Number(accountsCount.rows[0]?.count ?? 0),
      balances: Number(balancesCount.rows[0]?.count ?? 0),
      currentUserResolved: Boolean(c.get("userId")),
      currentUserAccountCount: currentUserAccounts.accounts.length,
    });
  });
}

app.route("/api/v1", v1);

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "The request was not valid.", retryable: false, requestId: c.get("requestId"), details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } }, 422);
  }
  const response = errorResponse(error, c.get("requestId"));
  return c.json(response.body, response.status as 400 | 401 | 403 | 404 | 409 | 422 | 500);
});

export default app;
