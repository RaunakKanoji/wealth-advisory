import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { env } from "../env.js";
import { db } from "../db/client.js";
import {
  aaConsents,
  aaConsentAccounts,
  aaDataSessions,
  aaSessionAccounts,
  accounts,
  accountBalances,
  financialConnections,
  ingestionBatches,
  recordProvenance,
  transactionCategories,
  transactions,
} from "../db/schema/index.js";
import * as aaRepository from "../db/repositories/aa.repository.js";
import * as accountsRepository from "../db/repositories/accounts.repository.js";
import * as auditRepository from "../db/repositories/audit.repository.js";
import { ApiError } from "../lib/errors.js";
import { id } from "../lib/ids.js";
import { getAAGateway, aaProviderName } from "../aa/gateway.js";
import { normalizeAAData, NORMALIZER_VERSION, sourceRecordHash } from "../aa/normalizer.js";
import { consentRequestSchema, type AANotification, type ConsentRequest, type NormalizedAAData } from "../aa/types.js";

const categoryMeta: Record<string, { name: string; type: string; iconKey: string }> = {
  salary: { name: "Salary", type: "income", iconKey: "cash-outline" },
  food_dining: { name: "Food & Dining", type: "expense", iconKey: "restaurant-outline" },
  shopping: { name: "Shopping", type: "expense", iconKey: "bag-handle-outline" },
  transport: { name: "Transport", type: "expense", iconKey: "car-outline" },
  utilities: { name: "Utilities", type: "expense", iconKey: "flash-outline" },
  transfer: { name: "Transfer", type: "transfer", iconKey: "swap-horizontal-outline" },
  refund: { name: "Refund", type: "income", iconKey: "return-up-back-outline" },
  cash: { name: "Cash", type: "expense", iconKey: "cash-outline" },
  other: { name: "Other", type: "expense", iconKey: "ellipsis-horizontal-circle-outline" },
};

function providerEnvironment(): string {
  if (env.AA_PROVIDER === "mock") return "test";
  return env.AA_API_BASE_URL?.toLowerCase().includes("sandbox") ? "sandbox" : "production";
}

function stableAccountId(userId: string, provider: string, connectionId: string, sourceAccountRef: string): string {
  const digest = createHash("sha256").update(`${userId}:${provider}:${connectionId}:${sourceAccountRef}`).digest("hex").slice(0, 24);
  return `acc_aa_${digest}`;
}

function mapConsentStatus(value: string | undefined): typeof aaConsents.$inferInsert.status {
  const normalized = (value ?? "PENDING").toLowerCase();
  if (normalized.includes("active") || normalized.includes("approved") || normalized.includes("grant")) return "active";
  if (normalized.includes("revoke")) return "revoked";
  if (normalized.includes("expir")) return "expired";
  if (normalized.includes("reject") || normalized.includes("deny")) return "rejected";
  if (normalized.includes("pause")) return "paused";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("request")) return "requested";
  return "pending";
}

function consentDto(consent: typeof aaConsents.$inferSelect) {
  return {
    id: consent.id,
    provider: consent.provider,
    status: consent.status,
    providerStatus: consent.providerStatusOriginal,
    purposeCode: consent.purposeCode,
    purposeText: consent.purposeText,
    fiTypes: consent.fiTypesJson,
    fiSections: consent.fiSectionsJson,
    selectedAccountCount: consent.selectedAccountScopeJson.length,
    consentStart: consent.consentStart?.toISOString() ?? null,
    consentExpiry: consent.consentExpiry?.toISOString() ?? null,
    requestedFrom: consent.requestedFrom.toISOString(),
    requestedTo: consent.requestedTo.toISOString(),
    fetchType: consent.fetchType,
    createdAt: consent.createdAt.toISOString(),
    updatedAt: consent.updatedAt.toISOString(),
  };
}

function sessionDto(session: typeof aaDataSessions.$inferSelect) {
  return {
    id: session.id,
    status: session.status,
    requestedFrom: session.requestedFrom.toISOString(),
    requestedTo: session.requestedTo.toISOString(),
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    failureCode: session.failureCode,
  };
}

function assertDateRange(request: ConsentRequest): { from: Date; to: Date } {
  const now = new Date();
  const from = request.fromDate ? new Date(request.fromDate) : new Date(now.getTime() - 365 * 86400000);
  const to = request.toDate ? new Date(request.toDate) : now;
  if (from >= to || to > new Date(now.getTime() + 5 * 60_000)) {
    throw new ApiError("INVALID_CONSENT_RANGE", "The requested financial-data range is invalid.", 422);
  }
  return { from, to };
}

export async function createConsent(userId: string, externalAuthId: string, rawRequest: unknown) {
  const request = consentRequestSchema.parse(rawRequest);
  const { from, to } = assertDateRange(request);
  for (const accountId of request.accountIds) {
    const account = await accountsRepository.getAccount(userId, accountId);
    if (!account) throw new ApiError("ACCOUNT_NOT_FOUND", "One or more selected accounts could not be found.", 404);
  }

  const consentId = id("consent");
  const connectionId = id("connection");
  const created = await db.transaction(async (tx) => {
    const connection = await aaRepository.createConnection({
      id: connectionId,
      userId,
      provider: aaProviderName(),
      environment: providerEnvironment(),
      state: "pending",
      capabilitiesJson: request.fiSections,
    }, tx);
    const consent = await aaRepository.createConsent({
      id: consentId,
      userId,
      financialConnectionId: connection.id,
      provider: aaProviderName(),
      purposeCode: request.purposeCode,
      purposeText: request.purposeText,
      status: "requested",
      fiTypesJson: request.fiTypes,
      fiSectionsJson: request.fiSections,
      selectedAccountScopeJson: request.accountIds,
      requestedFrom: from,
      requestedTo: to,
      fetchType: request.fetchType,
      fetchFrequency: request.fetchFrequency,
      consentMode: request.consentMode,
      dataLifeDays: request.dataLifeDays,
    }, tx);
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "aa_consent_requested", entityType: "aa_consent", entityId: consent.id, metadataJson: { provider: consent.provider, purposeCode: consent.purposeCode } }, tx);
    return consent;
  });

  try {
    const providerConsent = await getAAGateway().createConsent({ externalAuthId, consentId, request });
    const consent = await aaRepository.updateConsent(consentId, {
      providerConsentHandle: providerConsent.providerConsentHandle,
      providerConsentId: providerConsent.providerConsentId,
      status: mapConsentStatus(providerConsent.status),
      providerStatusOriginal: providerConsent.status,
      consentStart: from,
      consentExpiry: new Date(Date.now() + request.consentDurationDays * 86400000),
    });
    if (!consent) throw new ApiError("AA_CONSENT_NOT_PERSISTED", "The consent could not be saved.", 500);
    return { consent: consentDto(consent), redirectUrl: providerConsent.redirectUrl };
  } catch (error) {
    await aaRepository.updateConsent(consentId, { status: "failed", providerStatusOriginal: "PROVIDER_REQUEST_FAILED" });
    throw error;
  }
}

export async function listConsents(userId: string) {
  return { items: (await aaRepository.listConsents(userId)).map(consentDto) };
}

export async function getConsent(userId: string, consentId: string) {
  const consent = await aaRepository.findConsent(userId, consentId);
  if (!consent) throw new ApiError("AA_CONSENT_NOT_FOUND", "Consent not found.", 404);
  return consentDto(consent);
}

export async function syncConsent(userId: string, consentId: string) {
  const consent = await aaRepository.findConsent(userId, consentId);
  if (!consent) throw new ApiError("AA_CONSENT_NOT_FOUND", "Consent not found.", 404);
  if (!consent.providerConsentHandle) throw new ApiError("AA_CONSENT_NOT_READY", "The Account Aggregator consent has not returned a handle yet.", 409);
  if (["revoked", "expired", "rejected", "failed"].includes(consent.status)) throw new ApiError("AA_CONSENT_NOT_ACTIVE", "This consent cannot be used for a data refresh.", 409);

  const provider = getAAGateway();
  const status = await provider.getConsentStatus({ providerConsentHandle: consent.providerConsentHandle });
  const consentStatus = mapConsentStatus(status.status);
  const updatedConsent = await aaRepository.updateConsent(consent.id, {
    providerConsentId: status.providerConsentId ?? consent.providerConsentId,
    providerStatusOriginal: status.rawStatus ?? status.status,
    status: consentStatus,
  });
  if (!updatedConsent || consentStatus !== "active") return { consent: consentDto(updatedConsent ?? consent), session: null };
  if (!updatedConsent.providerConsentId) throw new ApiError("AA_CONSENT_PROVIDER_ID_MISSING", "The provider did not return an approved consent identifier.", 502);

  const session = await aaRepository.createDataSession({
    id: id("aa_session"),
    userId,
    consentId: consent.id,
    requestedFrom: consent.requestedFrom,
    requestedTo: consent.requestedTo,
    status: "requested",
    attempts: 0,
  });
  try {
    const providerSession = await provider.requestData({ providerConsentId: updatedConsent.providerConsentId, consentId: consent.id, requestedFrom: consent.requestedFrom, requestedTo: consent.requestedTo });
    const updatedSession = await aaRepository.updateDataSession(session.id, { providerSessionId: providerSession.providerSessionId, status: providerSession.status.toLowerCase().includes("ready") ? "ready" : "requested", lastAttemptAt: new Date(), attempts: 1 });
    if (!updatedSession) throw new ApiError("AA_SESSION_NOT_PERSISTED", "The data session could not be saved.", 500);
    const job = providerSession.status.toLowerCase().includes("ready")
      ? await aaRepository.createIngestionJob({ id: id("ingestion_job"), userId, provider: consent.provider, consentId: consent.id, sessionId: updatedSession.id, status: "pending", attempts: 0 })
      : undefined;
    if (job) await processIngestionJob(job.id);
    const finalSession = await aaRepository.findDataSession(userId, updatedSession.id);
    return { consent: consentDto(updatedConsent), session: finalSession ? sessionDto(finalSession) : sessionDto(updatedSession) };
  } catch (error) {
    await aaRepository.updateDataSession(session.id, { status: "failed", failureCode: error instanceof ApiError ? error.code : "AA_PROVIDER_FAILED", failureMessage: error instanceof ApiError ? error.message : "Provider request failed", lastAttemptAt: new Date(), attempts: 1 });
    throw error;
  }
}

function notificationEventType(notification: AANotification): string {
  return (notification.eventType ?? notification.type ?? notification.notificationType ?? notification.event ?? "UNKNOWN").toUpperCase();
}

function notificationStatus(notification: AANotification): string | undefined {
  return notification.status?.toUpperCase();
}

export async function handleWebhook(provider: string, notification: AANotification, payloadHash: string) {
  if (provider !== aaProviderName()) throw new ApiError("AA_PROVIDER_MISMATCH", "The webhook provider is not configured for this API.", 404);
  const eventId = notification.eventId ?? notification.txnid;
  if (!eventId) throw new ApiError("AA_EVENT_ID_MISSING", "The Account Aggregator event identifier is missing.", 422);
  const eventType = notificationEventType(notification);
  const consent = await aaRepository.findConsentByProviderReference(provider, notification.consentId, notification.consentHandle);
  const session = notification.sessionId ? await aaRepository.findDataSessionByProviderId(notification.sessionId) : undefined;
  const resolvedConsent = consent ?? (session ? await aaRepository.findConsentById(session.consentId) : undefined);
  const userId = consent?.userId ?? session?.userId;
  if (!userId || !resolvedConsent) throw new ApiError("AA_EVENT_REFERENCE_NOT_FOUND", "The Account Aggregator event does not match a pending consent.", 404);

  const event = await db.transaction(async (tx) => {
    const inserted = await aaRepository.createWebhookEvent({
      id: id("aa_event"), provider, eventId, eventType, consentId: resolvedConsent.id, sessionId: session?.id, payloadHash, receivedAt: new Date(), verifiedAt: new Date(), processingStatus: "received",
    }, tx);
    if (!inserted) return { duplicate: true, jobId: undefined };
    const mapped = mapConsentStatus(notificationStatus(notification));
    if (notificationStatus(notification)) await aaRepository.updateConsent(resolvedConsent.id, { status: mapped, providerStatusOriginal: notificationStatus(notification) }, tx);
    const isReady = (eventType.includes("DATA") || eventType.includes("FI")) && ["READY", "SUCCESS", "COMPLETED", "DATA_READY"].includes(notificationStatus(notification) ?? "");
    let jobId: string | undefined;
    if (session && isReady) {
      await aaRepository.updateDataSession(session.id, { status: "ready" }, tx);
      const job = await aaRepository.createIngestionJob({ id: id("ingestion_job"), userId, provider, consentId: resolvedConsent.id, sessionId: session.id, webhookEventId: inserted.id, status: "pending", attempts: 0 }, tx);
      jobId = job?.id;
    }
    await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "aa_webhook_verified", entityType: "aa_event", entityId: inserted.id, metadataJson: { provider, eventType } }, tx);
    return { duplicate: false, jobId };
  });
  if (event.jobId) await processIngestionJob(event.jobId);
  return { accepted: true, duplicate: event.duplicate };
}

async function persistNormalizedData(userId: string, consent: typeof aaConsents.$inferSelect, session: typeof aaDataSessions.$inferSelect, normalized: NormalizedAAData) {
  return db.transaction(async (tx) => {
    const connection = consent.financialConnectionId
      ? await aaRepository.findConnection(userId, consent.financialConnectionId, tx)
      : undefined;
    if (!connection) throw new ApiError("AA_CONNECTION_NOT_FOUND", "The financial connection for this consent is missing.", 500);
    const updatedConnection = await tx.update(financialConnections).set({
      providerConnectionId: normalized.connection.providerConnectionId ?? connection.providerConnectionId,
      institutionId: normalized.connection.institutionId ?? connection.institutionId,
      institutionName: normalized.connection.institutionName ?? connection.institutionName,
      state: "connected",
      capabilitiesJson: ["balance", "transactions"],
      lastSyncAttemptAt: new Date(),
      lastSuccessfulSyncAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(financialConnections.id, connection.id), eq(financialConnections.userId, userId))).returning();
    if (!updatedConnection[0]) throw new ApiError("AA_CONNECTION_UPDATE_FAILED", "The financial connection could not be updated.", 500);

    const batch = await aaRepository.createIngestionBatch({
      id: id("ingestion_batch"), userId, provider: consent.provider, environment: connection.environment, financialConnectionId: connection.id, consentId: consent.id, sessionId: session.id, ingestedAt: new Date(), normalizerVersion: NORMALIZER_VERSION, coverageFrom: normalized.coverageFrom, coverageTo: normalized.coverageTo, recordCount: normalized.accounts.length + normalized.transactions.length, status: "received", retentionUntil: new Date(Date.now() + env.AA_DATA_RETENTION_DAYS * 86400000),
    }, tx);
    if (!batch) throw new ApiError("AA_BATCH_NOT_PERSISTED", "The ingestion batch could not be saved.", 500);

    const accountsBySource = new Map<string, typeof accounts.$inferSelect>();
    for (const sourceAccount of normalized.accounts) {
      const accountId = stableAccountId(userId, consent.provider, connection.id, sourceAccount.sourceAccountRef);
      const [account] = await tx.insert(accounts).values({
        id: accountId, userId, financialConnectionId: connection.id, sourceAccountRef: sourceAccount.sourceAccountRef, sourceProvider: consent.provider, sourceEnvironment: connection.environment, verifiedCapabilitiesJson: sourceAccount.capabilities, accountType: sourceAccount.accountType, nickname: sourceAccount.nickname, maskedAccountNumber: sourceAccount.maskedAccountNumber, currency: sourceAccount.currency, isPrimary: false, status: "active", branchName: sourceAccount.branchName, ifsc: sourceAccount.ifsc, updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [accounts.financialConnectionId, accounts.sourceAccountRef],
        set: { nickname: sourceAccount.nickname, maskedAccountNumber: sourceAccount.maskedAccountNumber, currency: sourceAccount.currency, accountType: sourceAccount.accountType, branchName: sourceAccount.branchName, ifsc: sourceAccount.ifsc, sourceProvider: consent.provider, sourceEnvironment: connection.environment, verifiedCapabilitiesJson: sourceAccount.capabilities, updatedAt: new Date() },
      }).returning();
      if (!account) throw new ApiError("AA_ACCOUNT_NOT_PERSISTED", "An aggregated account could not be saved.", 500);
      accountsBySource.set(sourceAccount.sourceAccountRef, account);
      const [consentAccount] = await tx.insert(aaConsentAccounts).values({
        id: id("consent_account"),
        consentId: consent.id,
        accountId: account.id,
        providerLinkRef: sourceAccount.sourceAccountRef,
        selected: true,
      }).onConflictDoUpdate({
        target: [aaConsentAccounts.consentId, aaConsentAccounts.accountId],
        set: { providerLinkRef: sourceAccount.sourceAccountRef, selected: true },
      }).returning();
      await tx.insert(aaSessionAccounts).values({
        id: id("session_account"),
        sessionId: session.id,
        consentAccountId: consentAccount?.id,
        accountId: account.id,
        providerLinkRef: sourceAccount.sourceAccountRef,
        status: "received",
        coverageFrom: normalized.coverageFrom,
        coverageTo: normalized.coverageTo,
      });
      await tx.insert(accountBalances).values({ id: id("balance"), accountId: account.id, ingestionBatchId: batch.id, ledgerBalance: sourceAccount.ledgerBalance, availableBalance: sourceAccount.availableBalance, holds: sourceAccount.holds, currency: sourceAccount.currency, asOf: sourceAccount.sourceReportedAt ?? new Date(), sourceReportedAt: sourceAccount.sourceReportedAt }).returning();
      await tx.insert(recordProvenance).values({ id: id("provenance"), ingestionBatchId: batch.id, recordType: "account", recordId: account.id, providerRecordId: sourceAccount.sourceAccountRef, sourceReportedAt: sourceAccount.sourceReportedAt, sourceHash: sourceRecordHash(sourceAccount) }).onConflictDoNothing({ target: [recordProvenance.ingestionBatchId, recordProvenance.recordType, recordProvenance.recordId] });
    }

    for (const sourceTransaction of normalized.transactions) {
      const account = accountsBySource.get(sourceTransaction.sourceAccountRef);
      if (!account) throw new ApiError("AA_TRANSACTION_ACCOUNT_UNKNOWN", "An aggregated transaction referenced an unknown account.", 422);
      const category = sourceTransaction.categorySlug ?? "other";
      const proposedCategoryId = `category_${category}`;
      const meta = categoryMeta[category === "food" ? "food_dining" : category] ?? {...categoryMeta.other,name:category.charAt(0).toUpperCase()+category.slice(1)};
      const [persistedCategory] = await tx.insert(transactionCategories).values({ id: proposedCategoryId, slug: category, name: meta.name, type: meta.type, iconKey: meta.iconKey }).onConflictDoUpdate({ target: transactionCategories.slug, set: { slug: category } }).returning({id:transactionCategories.id});
      const categoryId = persistedCategory.id;
      const [transaction] = await tx.insert(transactions).values({ id: id("transaction"), accountId: account.id, ingestionBatchId: batch.id, sourceTransactionId: sourceTransaction.sourceTransactionId, type: sourceTransaction.type, direction: sourceTransaction.direction, amount: sourceTransaction.amount, currency: sourceTransaction.currency, description: sourceTransaction.description, merchantName: sourceTransaction.merchantName, categoryId, reference: sourceTransaction.reference, transactionAt: sourceTransaction.transactionAt, status: sourceTransaction.status, metadataJson: { source: "account_aggregator", provider: consent.provider, normalizerVersion: NORMALIZER_VERSION }, updatedAt: new Date() }).onConflictDoUpdate({ target: [transactions.accountId, transactions.sourceTransactionId], set: { amount: sourceTransaction.amount, description: sourceTransaction.description, merchantName: sourceTransaction.merchantName, categoryId, reference: sourceTransaction.reference, transactionAt: sourceTransaction.transactionAt, status: sourceTransaction.status, ingestionBatchId: batch.id, updatedAt: new Date() } }).returning();
      if (!transaction) throw new ApiError("AA_TRANSACTION_NOT_PERSISTED", "An aggregated transaction could not be saved.", 500);
      await tx.insert(recordProvenance).values({ id: id("provenance"), ingestionBatchId: batch.id, recordType: "transaction", recordId: transaction.id, providerRecordId: sourceTransaction.sourceTransactionId, sourceReportedAt: sourceTransaction.sourceReportedAt, sourceHash: sourceRecordHash(sourceTransaction) }).onConflictDoNothing({ target: [recordProvenance.ingestionBatchId, recordProvenance.recordType, recordProvenance.recordId] });
    }

    await tx.update(ingestionBatches).set({ status: "processed" }).where(eq(ingestionBatches.id, batch.id));
    await tx.update(aaDataSessions).set({ status: "completed", completedAt: new Date(), updatedAt: new Date(), failureCode: null, failureMessage: null }).where(eq(aaDataSessions.id, session.id));
    await tx.update(financialConnections).set({ state: "connected", lastSuccessfulSyncAt: new Date(), updatedAt: new Date() }).where(eq(financialConnections.id, connection.id));
    return { batchId: batch.id, accountCount: normalized.accounts.length, transactionCount: normalized.transactions.length };
  });
}

export async function processIngestionJob(jobId: string) {
  const job = await aaRepository.findIngestionJob(jobId);
  if (!job) throw new ApiError("INGESTION_JOB_NOT_FOUND", "Ingestion job not found.", 404);
  if (job.status === "completed") return { status: "completed" as const };
  const actualSession = job.sessionId ? await aaRepository.findDataSessionById(job.sessionId) : undefined;
  if (!actualSession) throw new ApiError("AA_SESSION_NOT_FOUND", "The ingestion session was not found.", 500);
  const consent = await aaRepository.findConsent(job.userId, actualSession.consentId);
  if (!consent) throw new ApiError("AA_CONSENT_NOT_FOUND", "The ingestion consent was not found.", 500);
  if (!actualSession.providerSessionId) throw new ApiError("AA_PROVIDER_SESSION_MISSING", "The provider session identifier is missing.", 409);
  await aaRepository.updateIngestionJob(job.id, { status: "processing", attempts: job.attempts + 1, startedAt: new Date(), failureCode: null, failureMessage: null });
  await aaRepository.updateDataSession(actualSession.id, { status: "processing", lastAttemptAt: new Date(), attempts: actualSession.attempts + 1 });
  try {
    const payload = await getAAGateway().fetchData({ providerSessionId: actualSession.providerSessionId });
    const normalized = normalizeAAData(payload, actualSession.requestedFrom, actualSession.requestedTo);
    const result = await persistNormalizedData(job.userId, consent, actualSession, normalized);
    await aaRepository.updateIngestionJob(job.id, { status: "completed", completedAt: new Date() });
    if (job.webhookEventId) await aaRepository.updateWebhookEvent(job.webhookEventId, { processingStatus: "processed" });
    return { status: "completed" as const, ...result };
  } catch (error) {
    const failureCode = error instanceof ApiError ? error.code : "AA_INGESTION_FAILED";
    const failureMessage = error instanceof ApiError ? error.message : "The financial-data ingestion failed.";
    await aaRepository.updateIngestionJob(job.id, { status: "failed", failureCode, failureMessage, completedAt: new Date() });
    await aaRepository.updateDataSession(actualSession.id, { status: "failed", failureCode, failureMessage });
    if (job.webhookEventId) await aaRepository.updateWebhookEvent(job.webhookEventId, { processingStatus: "failed", failureCode });
    throw error;
  }
}
