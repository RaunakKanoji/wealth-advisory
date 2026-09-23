import {createGoal,updateGoal} from "../../services/goals.service.js";
import { searchActivity } from "../../services/activity.service.js";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { requireAuth, type AuthVariables } from "../auth.js";
import { ApiError } from "../../lib/errors.js";
import * as accountsService from "../../services/accounts.service.js";
import * as transactionsService from "../../services/transactions.service.js";
import * as beneficiariesService from "../../services/beneficiaries.service.js";
import * as transfersService from "../../services/transfers.service.js";
import * as cardsService from "../../services/cards.service.js";
import * as notificationsService from "../../services/notifications.service.js";
import * as wealthService from "../../services/wealth.service.js";
import * as coachService from "../../services/coach.service.js";
import * as servicesService from "../../services/services.service.js";
import * as aaService from "../../services/aa.service.js";

export const v1 = new Hono<{ Variables: AuthVariables }>();
v1.use("*", requireAuth);

const querySchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  status: z.enum(['completed','pending','failed','reversed']).optional(),merchant:z.string().trim().max(100).optional(),
  minimumAmount:z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).optional(),maximumAmount:z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).optional(),
  sort:z.enum(['date_desc','date_asc','amount_desc','amount_asc']).optional(),page:z.coerce.number().int().min(1).max(10000).optional(),
  category: z.string().trim().min(1).optional(),
  direction: z.enum(["credit", "debit"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
  search: z.string().trim().max(80).optional(),
});

const beneficiarySchema = z.object({
  type: z.enum(["bank", "upi"]),
  name: z.string().trim().min(1).max(80),
  nickname: z.string().trim().max(40).optional(),
  accountNumber: z.string().regex(/^\d{6,24}$/).optional(),
  maskedAccountNumber: z.string().max(24).optional(),
  ifsc: z.string().max(11).optional(),
  upiId: z.string().max(120).optional(),
}).strict();

const transferSchema = z.object({
  sourceAccountId: z.string().trim().min(1),
  beneficiaryId: z.string().trim().min(1).optional(),
  destinationAccountId: z.string().trim().min(1).optional(),
  transferType: z.enum(["own_account", "bank", "upi", "neft", "imps", "rtgs"]),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  note: z.string().trim().max(240).optional(),
}).strict();

function userId(context: Context<{ Variables: AuthVariables }>) {
  return context.get("userId");
}

async function accountOverview(c: Context<{ Variables: AuthVariables }>) {
  const requestId = c.get("requestId");
  if (process.env.NODE_ENV !== "production") {
    console.info("[BACKEND] account query started", { requestId, userResolved: Boolean(userId(c)) });
  }
  try {
    const response = await accountsService.getAccountsOverview(userId(c));
    if (process.env.NODE_ENV !== "production") {
      console.info("[DB] account query succeeded", { requestId, accountCount: response.accounts.length, hasData: response.accounts.length > 0 });
    }
    return c.json(response);
  } catch (error) {
    console.error("[accounts] failed", {
      requestId,
      route: c.req.path,
      stage: "fetch_accounts",
      code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "unknown error",
      ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { stack: error.stack } : {}),
    });
    throw error;
  }
}
v1.get("/accounts/overview", accountOverview);
// Keep the original route as a backwards-compatible alias for older clients.
v1.get("/accounts", accountOverview);
v1.get("/accounts/:id", async (c) => c.json(await accountsService.getAccount(userId(c), c.req.param("id"))));
v1.get("/accounts/:id/transactions", async (c) => c.json(await transactionsService.listTransactions(userId(c), { ...querySchema.parse(c.req.query()), accountId: c.req.param("id") })));
v1.post("/activity/search",async c=>c.json(await searchActivity(userId(c),await c.req.json())));
v1.get("/transactions/:id",async c=>c.json(await transactionsService.getTransaction(userId(c),c.req.param("id"))));
v1.get("/transactions", async (c) => c.json(await transactionsService.listTransactions(userId(c), querySchema.parse(c.req.query()))));

v1.post("/aa/consents", async (c) => c.json(await aaService.createConsent(userId(c), c.get("externalAuthId"), await c.req.json()), 201));
v1.get("/aa/consents", async (c) => c.json(await aaService.listConsents(userId(c))));
v1.get("/aa/consents/:id", async (c) => c.json(await aaService.getConsent(userId(c), c.req.param("id"))));
v1.post("/aa/consents/:id/sync", async (c) => c.json(await aaService.syncConsent(userId(c), c.req.param("id"))));

v1.get("/beneficiaries", async (c) => c.json({ items: await beneficiariesService.listBeneficiaries(userId(c)) }));
v1.post("/beneficiaries", async (c) => c.json({ beneficiary: await beneficiariesService.createBeneficiary(userId(c), beneficiarySchema.parse(await c.req.json())) }, 201));
v1.get("/beneficiaries/:id", async (c) => c.json(await beneficiariesService.getBeneficiary(userId(c), c.req.param("id"))));

v1.post("/transfers/draft", async (c) => c.json(await transfersService.createDraft(userId(c), transferSchema.parse(await c.req.json())), 201));
v1.post("/transfers/:id/review", async (c) => c.json(await transfersService.reviewTransfer(userId(c), c.req.param("id"))));
v1.post("/transfers/:id/submit", async (c) => c.json(await transfersService.submitTransfer(userId(c), c.req.param("id"))));
v1.get("/transfers", async (c) => c.json(await transfersService.listTransfers(userId(c))));
v1.get("/transfers/:id", async (c) => c.json(await transfersService.getTransfer(userId(c), c.req.param("id"))));

v1.get("/cards", async (c) => c.json(await cardsService.listCards(userId(c), c.req.query("accountId"))));
v1.get("/cards/:id", async (c) => c.json(await cardsService.getCard(userId(c), c.req.param("id"))));
v1.patch("/cards/:id/controls", async (c) => c.json(await cardsService.updateControls(userId(c), c.req.param("id"), await c.req.json())));
v1.patch("/cards/:id/status", async (c) => c.json(await cardsService.updateStatus(userId(c), c.req.param("id"), await c.req.json())));
v1.patch("/cards/:id/nickname", async (c) => c.json(await cardsService.updateNickname(userId(c), c.req.param("id"), await c.req.json())));
v1.post("/cards/:id/block", async (c) => c.json(await cardsService.blockCard(userId(c), c.req.param("id"))));
v1.get("/cards/:id/transactions/:transactionId",async c=>c.json(await cardsService.getCardTransaction(userId(c),c.req.param("id"),c.req.param("transactionId"))));
v1.get("/cards/:id/transactions", async (c) => c.json(await cardsService.listCardTransactions(userId(c), c.req.param("id"))));

v1.get("/notifications", async (c) => c.json(await notificationsService.listNotifications(userId(c), { type: c.req.query("type"), limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined })));
v1.patch("/notifications/:id/read", async (c) => c.json(await notificationsService.markRead(userId(c), c.req.param("id"))));
v1.post("/notifications/read-all", async (c) => c.json(await notificationsService.markAllRead(userId(c))));
v1.get("/notification-preferences", async (c) => c.json(await notificationsService.getPreferences(userId(c))));
v1.patch("/notification-preferences", async (c) => c.json(await notificationsService.updatePreferences(userId(c), await c.req.json())));

v1.get("/wealth/summary", async (c) => c.json(await wealthService.getSummary(userId(c))));
v1.get("/wealth/insights", async (c) => c.json(await wealthService.listInsights(userId(c))));
v1.post("/wealth/goals",async c=>c.json(await createGoal(userId(c),await c.req.json()),201));
v1.patch("/wealth/goals/:id",async c=>c.json(await updateGoal(userId(c),c.req.param("id"),await c.req.json())));
v1.get("/wealth/goals", async (c) => c.json(await wealthService.listGoals(userId(c))));
v1.get("/wealth/goals/:id", async (c) => c.json(await wealthService.getGoal(userId(c), c.req.param("id"))));

const coachScopeSchema = z.object({accountId:z.string().max(200).optional(),cardId:z.string().max(200).optional(),goalId:z.string().max(200).optional(),transactionId:z.string().max(200).optional(),category:z.string().max(80).optional(),from:z.string().date().optional(),to:z.string().date().optional(),period:z.string().max(30).optional()}).strict();
v1.get('/coach/consent',async c=>c.json(await coachService.getConsent(userId(c))));
v1.post('/coach/consent',async c=>c.json(await coachService.setConsent(userId(c),z.object({granted:z.boolean()}).strict().parse(await c.req.json()).granted)));
v1.post('/coach/runs/:id/cancel',async c=>c.json(await coachService.cancelRun(userId(c),z.string().uuid().parse(c.req.param('id')))));
v1.get('/coach/conversations',async c=>c.json(await coachService.listConversations(userId(c))));
v1.post('/coach/conversations',async c=>{
 const input=z.object({title:z.string().trim().max(80).optional(),firstMessage:z.string().trim().min(1).max(1000),requestId:z.string().uuid().optional(),scope:coachScopeSchema.optional()}).strict().parse(await c.req.json());
 return c.json(await coachService.sendMessage(userId(c),{...input,message:input.firstMessage}),201);
});
v1.get('/coach/conversations/:id/messages',async c=>c.json(await coachService.getMessages(userId(c),c.req.param('id'))));
v1.post('/coach/conversations/:id/messages',async c=>{
 const input=z.object({message:z.string().trim().min(1).max(1000),requestId:z.string().uuid().optional()}).strict().parse(await c.req.json());
 return c.json(await coachService.sendMessage(userId(c),{...input,conversationId:c.req.param('id')}));
});
v1.patch('/coach/conversations/:id',async c=>c.json(await coachService.updateConversation(userId(c),c.req.param('id'),z.object({title:z.string().trim().min(1).max(80)}).strict().parse(await c.req.json()).title)));
v1.delete('/coach/conversations/:id',async c=>c.json(await coachService.deleteConversation(userId(c),c.req.param('id'))));
v1.get('/coach/messages/:id/sources',async c=>{const q=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20)}).parse(c.req.query());return c.json(await coachService.getAnswerSources(userId(c),c.req.param('id'),q.page,q.pageSize));});
v1.get('/coach/reports',async c=>c.json(await coachService.listReports(userId(c))));
v1.post('/coach/reports',async c=>{const input=z.object({messageId:z.string().max(200),title:z.string().trim().min(1).max(80)}).strict().parse(await c.req.json());return c.json(await coachService.saveReport(userId(c),input.messageId,input.title),201);});

v1.get("/services", async (c) => c.json(await servicesService.listServices(userId(c), c.req.query("category"))));
v1.get("/services/favorites", async (c) => c.json(await servicesService.listFavorites(userId(c))));
v1.post("/services/:id/favorite", async (c) => c.json(await servicesService.addFavorite(userId(c), c.req.param("id"))));
v1.delete("/services/:id/favorite", async (c) => c.json(await servicesService.removeFavorite(userId(c), c.req.param("id"))));

export function assertPathParam(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new ApiError("INVALID_PARAMETER", `${label} is required.`, 422);
  return value;
}
