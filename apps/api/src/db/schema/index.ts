import { sql } from "drizzle-orm";
import {
  uuid,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "closed"]);
export const accountTypeEnum = pgEnum("account_type", ["savings", "current", "fixed_deposit", "recurring_deposit"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "restricted", "closed"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["salary", "purchase", "bill", "transfer", "refund", "cash", "deposit", "interest", "fee", "other"]);
export const transactionDirectionEnum = pgEnum("transaction_direction", ["credit", "debit"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "reversed"]);
export const beneficiaryTypeEnum = pgEnum("beneficiary_type", ["bank", "upi"]);
export const beneficiaryStatusEnum = pgEnum("beneficiary_status", ["active", "cooling_off", "disabled"]);
export const transferTypeEnum = pgEnum("transfer_type", ["own_account", "bank", "upi", "neft", "imps", "rtgs"]);
export const transferStatusEnum = pgEnum("transfer_status", ["draft", "reviewing", "submitted", "processing", "completed", "failed", "cancelled"]);
export const cardTypeEnum = pgEnum("card_type", ["debit", "credit", "virtual"]);
export const cardNetworkEnum = pgEnum("card_network", ["visa", "mastercard", "rupay"]);
export const cardStatusEnum = pgEnum("card_status", ["active", "temporarily_blocked", "blocked", "expired"]);
export const notificationTypeEnum = pgEnum("notification_type", ["transaction", "security", "account", "card", "coach", "service"]);
export const notificationSeverityEnum = pgEnum("notification_severity", ["info", "success", "attention", "critical"]);
export const wealthGoalTypeEnum = pgEnum("wealth_goal_type", ["emergency_fund", "retirement", "travel", "purchase", "education", "custom"]);
export const wealthGoalStatusEnum = pgEnum("wealth_goal_status", ["active", "completed", "paused"]);
export const insightTypeEnum = pgEnum("insight_type", ["spending", "savings", "cash_flow", "goal", "subscription", "investment", "bill", "general"]);
export const insightSeverityEnum = pgEnum("insight_severity", ["positive", "neutral", "attention"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["active", "archived"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const financialConnectionStateEnum = pgEnum("financial_connection_state", ["pending", "connected", "syncing", "needs_reauth", "revoked", "failed"]);
export const aaConsentStatusEnum = pgEnum("aa_consent_status", ["requested", "pending", "active", "paused", "revoked", "expired", "rejected", "failed"]);
export const aaDataSessionStatusEnum = pgEnum("aa_data_session_status", ["requested", "ready", "processing", "completed", "failed", "expired"]);
export const aaSessionAccountStatusEnum = pgEnum("aa_session_account_status", ["pending", "received", "partial", "failed"]);
export const ingestionBatchStatusEnum = pgEnum("ingestion_batch_status", ["received", "processed", "failed", "rejected"]);
export const ingestionJobStatusEnum = pgEnum("ingestion_job_status", ["pending", "processing", "completed", "failed", "dead_letter"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  externalAuthId: text("external_auth_id").notNull(),
  email: text("email"),
  phone: text("phone"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("users_external_auth_id_unique").on(table.externalAuthId),
]);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  displayName: text("display_name").notNull(),
  preferredCurrency: text("preferred_currency").notNull().default("INR"),
  preferredLanguage: text("preferred_language").notNull().default("en-IN"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("profiles_user_id_unique").on(table.userId),
]);

export const financialConnections = pgTable("financial_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  environment: text("environment").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  providerConnectionId: text("provider_connection_id"),
  state: financialConnectionStateEnum("state").notNull().default("pending"),
  capabilitiesJson: jsonb("capabilities_json").$type<string[]>().notNull().default([]),
  lastSyncAttemptAt: timestamp("last_sync_attempt_at", { withTimezone: true }),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("financial_connections_user_state_idx").on(table.userId, table.state),
  uniqueIndex("financial_connections_provider_connection_unique").on(table.provider, table.providerConnectionId),
]);

export const aaConsents = pgTable("aa_consents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  financialConnectionId: text("financial_connection_id").references(() => financialConnections.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  providerConsentHandle: text("provider_consent_handle"),
  providerConsentId: text("provider_consent_id"),
  purposeCode: text("purpose_code").notNull(),
  purposeText: text("purpose_text").notNull(),
  status: aaConsentStatusEnum("status").notNull().default("requested"),
  providerStatusOriginal: text("provider_status_original"),
  fiTypesJson: jsonb("fi_types_json").$type<string[]>().notNull().default([]),
  fiSectionsJson: jsonb("fi_sections_json").$type<string[]>().notNull().default([]),
  selectedAccountScopeJson: jsonb("selected_account_scope_json").$type<string[]>().notNull().default([]),
  consentStart: timestamp("consent_start", { withTimezone: true }),
  consentExpiry: timestamp("consent_expiry", { withTimezone: true }),
  requestedFrom: timestamp("requested_from", { withTimezone: true }).notNull(),
  requestedTo: timestamp("requested_to", { withTimezone: true }).notNull(),
  fetchType: text("fetch_type").notNull(),
  fetchFrequency: text("fetch_frequency").notNull(),
  consentMode: text("consent_mode").notNull(),
  dataLifeDays: integer("data_life_days").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("aa_consents_user_status_idx").on(table.userId, table.status),
  uniqueIndex("aa_consents_provider_handle_unique").on(table.provider, table.providerConsentHandle),
  uniqueIndex("aa_consents_provider_id_unique").on(table.provider, table.providerConsentId),
]);

export const aaDataSessions = pgTable("aa_data_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentId: text("consent_id").notNull().references(() => aaConsents.id, { onDelete: "cascade" }),
  providerSessionId: text("provider_session_id"),
  requestedFrom: timestamp("requested_from", { withTimezone: true }).notNull(),
  requestedTo: timestamp("requested_to", { withTimezone: true }).notNull(),
  status: aaDataSessionStatusEnum("status").notNull().default("requested"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("aa_data_sessions_user_status_idx").on(table.userId, table.status),
  uniqueIndex("aa_data_sessions_provider_session_unique").on(table.providerSessionId),
]);

export const ingestionBatches = pgTable("ingestion_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  environment: text("environment").notNull(),
  financialConnectionId: text("financial_connection_id").references(() => financialConnections.id, { onDelete: "set null" }),
  consentId: text("consent_id").references(() => aaConsents.id, { onDelete: "set null" }),
  sessionId: text("session_id").references(() => aaDataSessions.id, { onDelete: "set null" }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
  normalizerVersion: text("normalizer_version").notNull(),
  coverageFrom: timestamp("coverage_from", { withTimezone: true }),
  coverageTo: timestamp("coverage_to", { withTimezone: true }),
  recordCount: integer("record_count").notNull().default(0),
  status: ingestionBatchStatusEnum("status").notNull().default("received"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  index("ingestion_batches_user_ingested_at_idx").on(table.userId, table.ingestedAt),
]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  financialConnectionId: text("financial_connection_id").references(() => financialConnections.id, { onDelete: "set null" }),
  sourceAccountRef: text("source_account_ref"),
  sourceProvider: text("source_provider").notNull().default("seed"),
  sourceEnvironment: text("source_environment").notNull().default("demo"),
  verifiedCapabilitiesJson: jsonb("verified_capabilities_json").$type<string[]>().notNull().default([]),
  accountType: accountTypeEnum("account_type").notNull(),
  nickname: text("nickname").notNull(),
  maskedAccountNumber: text("masked_account_number").notNull(),
  currency: text("currency").notNull().default("INR"),
  isPrimary: boolean("is_primary").notNull().default(false),
  status: accountStatusEnum("status").notNull().default("active"),
  branchName: text("branch_name"),
  ifsc: text("ifsc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("accounts_user_id_idx").on(table.userId),
  index("accounts_user_status_idx").on(table.userId, table.status),
  uniqueIndex("accounts_connection_source_ref_unique").on(table.financialConnectionId, table.sourceAccountRef),
]);

export const aaConsentAccounts = pgTable("aa_consent_accounts", {
  id: text("id").primaryKey(),
  consentId: text("consent_id").notNull().references(() => aaConsents.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  providerLinkRef: text("provider_link_ref"),
  selected: boolean("selected").notNull().default(true),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("aa_consent_accounts_consent_account_unique").on(table.consentId, table.accountId),
  index("aa_consent_accounts_account_idx").on(table.accountId),
]);

export const aaSessionAccounts = pgTable("aa_session_accounts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => aaDataSessions.id, { onDelete: "cascade" }),
  consentAccountId: text("consent_account_id").references(() => aaConsentAccounts.id, { onDelete: "set null" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  providerLinkRef: text("provider_link_ref"),
  status: aaSessionAccountStatusEnum("status").notNull().default("pending"),
  coverageFrom: timestamp("coverage_from", { withTimezone: true }),
  coverageTo: timestamp("coverage_to", { withTimezone: true }),
  failureCode: text("failure_code"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("aa_session_accounts_session_status_idx").on(table.sessionId, table.status),
]);

export const accountBalances = pgTable("account_balances", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  ingestionBatchId: text("ingestion_batch_id").references(() => ingestionBatches.id, { onDelete: "set null" }),
  ledgerBalance: numeric("ledger_balance", { precision: 18, scale: 2 }).notNull(),
  availableBalance: numeric("available_balance", { precision: 18, scale: 2 }).notNull(),
  holds: numeric("holds", { precision: 18, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("INR"),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  sourceReportedAt: timestamp("source_reported_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  index("account_balances_account_as_of_idx").on(table.accountId, table.asOf),
]);

export const transactionCategories = pgTable("transaction_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  iconKey: text("icon_key"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("transaction_categories_slug_unique").on(table.slug),
]);

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  ingestionBatchId: text("ingestion_batch_id").references(() => ingestionBatches.id, { onDelete: "set null" }),
  sourceTransactionId: text("source_transaction_id"),
  type: transactionTypeEnum("type").notNull(),
  direction: transactionDirectionEnum("direction").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  description: text("description").notNull(),
  merchantName: text("merchant_name"),
  categoryId: text("category_id").references(() => transactionCategories.id, { onDelete: "set null" }),
  reference: text("reference"),
  transactionAt: timestamp("transaction_at", { withTimezone: true }).notNull(),
  status: transactionStatusEnum("status").notNull().default("completed"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("transactions_account_transaction_at_idx").on(table.accountId, table.transactionAt),
  index("transactions_category_idx").on(table.categoryId),
  index("transactions_status_idx").on(table.status),
  uniqueIndex("transactions_account_source_id_unique").on(table.accountId, table.sourceTransactionId),
]);

export const recordProvenance = pgTable("record_provenance", {
  id: text("id").primaryKey(),
  ingestionBatchId: text("ingestion_batch_id").notNull().references(() => ingestionBatches.id, { onDelete: "cascade" }),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  providerRecordId: text("provider_record_id"),
  sourceReportedAt: timestamp("source_reported_at", { withTimezone: true }),
  sourceHash: text("source_hash").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("record_provenance_record_idx").on(table.recordType, table.recordId),
  uniqueIndex("record_provenance_batch_record_unique").on(table.ingestionBatchId, table.recordType, table.recordId),
]);

export const aaWebhookEvents = pgTable("aa_webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  consentId: text("consent_id").references(() => aaConsents.id, { onDelete: "set null" }),
  sessionId: text("session_id").references(() => aaDataSessions.id, { onDelete: "set null" }),
  payloadHash: text("payload_hash").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  processingStatus: text("processing_status").notNull().default("received"),
  failureCode: text("failure_code"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("aa_webhook_events_provider_event_unique").on(table.provider, table.eventId),
  index("aa_webhook_events_processing_idx").on(table.processingStatus, table.receivedAt),
]);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  consentId: text("consent_id").references(() => aaConsents.id, { onDelete: "set null" }),
  sessionId: text("session_id").references(() => aaDataSessions.id, { onDelete: "set null" }),
  webhookEventId: text("webhook_event_id").references(() => aaWebhookEvents.id, { onDelete: "set null" }),
  status: ingestionJobStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("ingestion_jobs_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
  uniqueIndex("ingestion_jobs_session_unique").on(table.sessionId),
]);

export const beneficiaries = pgTable("beneficiaries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: beneficiaryTypeEnum("type").notNull(),
  name: text("name").notNull(),
  nickname: text("nickname"),
  maskedAccountNumber: text("masked_account_number"),
  ifsc: text("ifsc"),
  upiId: text("upi_id"),
  status: beneficiaryStatusEnum("status").notNull().default("active"),
  coolingOffUntil: timestamp("cooling_off_until", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("beneficiaries_user_status_idx").on(table.userId, table.status),
]);

export const transfers = pgTable("transfers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceAccountId: text("source_account_id").notNull().references(() => accounts.id),
  destinationAccountId: text("destination_account_id").references(() => accounts.id),
  beneficiaryId: text("beneficiary_id").references(() => beneficiaries.id),
  transferType: transferTypeEnum("transfer_type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  note: text("note"),
  status: transferStatusEnum("status").notNull().default("draft"),
  demoTransaction: boolean("demo_transaction").notNull().default(true),
  reference: text("reference"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("transfers_user_created_at_idx").on(table.userId, table.createdAt),
  index("transfers_status_idx").on(table.status),
]);

export const transferEvents = pgTable("transfer_events", {
  id: text("id").primaryKey(),
  transferId: text("transfer_id").notNull().references(() => transfers.id, { onDelete: "cascade" }),
  status: transferStatusEnum("status").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("transfer_events_transfer_created_at_idx").on(table.transferId, table.createdAt),
]);

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  cardType: cardTypeEnum("card_type").notNull(),
  network: cardNetworkEnum("network").notNull(),
  maskedCardNumber: text("masked_card_number").notNull(),
  nickname: text("nickname").notNull(),
  status: cardStatusEnum("status").notNull().default("active"),
  expiryMonth: integer("expiry_month").notNull(),
  expiryYear: integer("expiry_year").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("cards_user_status_idx").on(table.userId, table.status),
]);

export const cardControls = pgTable("card_controls", {
  id: text("id").primaryKey(),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  domesticEnabled: boolean("domestic_enabled").notNull().default(true),
  internationalEnabled: boolean("international_enabled").notNull().default(false),
  onlineEnabled: boolean("online_enabled").notNull().default(true),
  contactlessEnabled: boolean("contactless_enabled").notNull().default(true),
  atmEnabled: boolean("atm_enabled").notNull().default(true),
  dailyPosLimit: numeric("daily_pos_limit", { precision: 18, scale: 2 }).notNull().default("50000.00"),
  dailyOnlineLimit: numeric("daily_online_limit", { precision: 18, scale: 2 }).notNull().default("25000.00"),
  dailyAtmLimit: numeric("daily_atm_limit", { precision: 18, scale: 2 }).notNull().default("20000.00"),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("card_controls_card_id_unique").on(table.cardId),
]);

export const cardTransactions = pgTable("card_transactions", {
  id: text("id").primaryKey(),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  merchantName: text("merchant_name").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  status: transactionStatusEnum("status").notNull().default("completed"),
  transactionAt: timestamp("transaction_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("card_transactions_card_transaction_at_idx").on(table.cardId, table.transactionAt),
]);

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: notificationSeverityEnum("severity").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  destinationRoute: text("destination_route"),
  destinationParamsJson: jsonb("destination_params_json").$type<Record<string, string>>(),
  createdAt: createdAt(),
}, (table) => [
  index("notifications_user_created_at_idx").on(table.userId, table.createdAt),
  index("notifications_user_read_idx").on(table.userId, table.isRead),
]);

export const notificationPreferences = pgTable("notification_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionsEnabled: boolean("transactions_enabled").notNull().default(true),
  securityEnabled: boolean("security_enabled").notNull().default(true),
  coachEnabled: boolean("coach_enabled").notNull().default(true),
  servicesEnabled: boolean("services_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("notification_preferences_user_id_unique").on(table.userId),
]);

export const wealthGoals = pgTable("wealth_goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: wealthGoalTypeEnum("type").notNull(),
  title: text("title").notNull(),
  targetAmount: numeric("target_amount", { precision: 18, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("INR"),
  targetDate: date("target_date"),
  monthlyContribution: numeric("monthly_contribution", { precision: 18, scale: 2 }),
  status: wealthGoalStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("wealth_goals_user_status_idx").on(table.userId, table.status),
]);

export const financialInsights = pgTable("financial_insights", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: insightTypeEnum("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  severity: insightSeverityEnum("severity").notNull().default("neutral"),
  metricValue: numeric("metric_value", { precision: 18, scale: 2 }),
  metricUnit: text("metric_unit"),
  comparisonValue: numeric("comparison_value", { precision: 18, scale: 2 }),
  comparisonPeriod: text("comparison_period"),
  sourceJson: jsonb("source_json").$type<Record<string, unknown>>().notNull().default({}),
  actionRoute: text("action_route"),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  index("financial_insights_user_created_at_idx").on(table.userId, table.createdAt),
]);

export const monthlyFinancialSnapshots = pgTable("monthly_financial_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: date("month").notNull(),
  income: numeric("income", { precision: 18, scale: 2 }).notNull(),
  expenses: numeric("expenses", { precision: 18, scale: 2 }).notNull(),
  savings: numeric("savings", { precision: 18, scale: 2 }).notNull(),
  savingsRate: numeric("savings_rate", { precision: 7, scale: 2 }).notNull(),
  spendingChangePercent: numeric("spending_change_percent", { precision: 7, scale: 2 }).notNull(),
  goalProgressPercent: numeric("goal_progress_percent", { precision: 7, scale: 2 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("monthly_snapshots_user_month_unique").on(table.userId, table.month),
  index("monthly_snapshots_user_month_idx").on(table.userId, table.month),
]);

export const coachConversations = pgTable("coach_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: conversationStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("coach_conversations_user_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const coachMessages = pgTable("coach_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => coachConversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  structuredPayloadJson: jsonb("structured_payload_json").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (table) => [
  index("coach_messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
]);

export const serviceCatalog = pgTable("service_catalog", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  iconKey: text("icon_key").notNull(),
  iconTone: text("icon_tone").notNull().default("green"),
  route: text("route").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  searchTermsJson: jsonb("search_terms_json").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("service_catalog_slug_unique").on(table.slug),
  index("service_catalog_category_order_idx").on(table.category, table.displayOrder),
]);

export const serviceFavorites = pgTable("service_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => serviceCatalog.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("service_favorites_user_service_unique").on(table.userId, table.serviceId),
  index("service_favorites_user_created_at_idx").on(table.userId, table.createdAt),
]);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  index("audit_events_user_created_at_idx").on(table.userId, table.createdAt),
  index("audit_events_entity_idx").on(table.entityType, table.entityId),
]);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type FinancialConnection = typeof financialConnections.$inferSelect;
export type AAConsent = typeof aaConsents.$inferSelect;
export type AADataSession = typeof aaDataSessions.$inferSelect;
export type IngestionBatch = typeof ingestionBatches.$inferSelect;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type WealthGoal = typeof wealthGoals.$inferSelect;
export type FinancialInsight = typeof financialInsights.$inferSelect;

// Existing entity keys are retained for compatibility; new Coach records use UUIDs.
export const coachConsents = pgTable('coach_consents', {
  userId: text('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),
  granted: boolean('granted').notNull().default(false), updatedAt: updatedAt(),
});
export const coachContext = pgTable('coach_context', {
  conversationId: text('conversation_id').primaryKey().references(()=>coachConversations.id,{onDelete:'cascade'}),
  contextJson: jsonb('context_json').$type<import('../../coach/plan.js').CoachContext>().notNull(),
  scopeJson: jsonb('scope_json').$type<import('../../coach/engine.js').InitialScope>(),updatedAt:updatedAt(),
});
export const coachRuns = pgTable('coach_runs', {
  id: uuid('id').primaryKey().defaultRandom(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  conversationId:text('conversation_id').notNull().references(()=>coachConversations.id,{onDelete:'cascade'}),
  userMessageId:text('user_message_id').notNull().references(()=>coachMessages.id,{onDelete:'cascade'}),
  assistantMessageId:text('assistant_message_id').references(()=>coachMessages.id,{onDelete:'set null'}),
  status:text('status').notNull(),planJson:jsonb('plan_json').$type<Record<string,unknown>>(),
  verifiedJson:jsonb('verified_json').$type<Record<string,unknown>>(),modelMetadataJson:jsonb('model_metadata_json').$type<Record<string,unknown>>(),
  sourceRecordsJson:jsonb('source_records_json').$type<import('../../coach/finance.js').FinancialTransaction[]>().notNull().default([]),
  failureCode:text('failure_code'),createdAt:createdAt(),updatedAt:updatedAt(),
}, t=>[index('coach_runs_user_created_idx').on(t.userId,t.createdAt),uniqueIndex('coach_runs_active_unique').on(t.conversationId).where(sql`status = 'running'`)]);
export const coachReports = pgTable('coach_reports', {
  id:uuid('id').primaryKey().defaultRandom(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  messageId:text('message_id').notNull().references(()=>coachMessages.id,{onDelete:'cascade'}),title:text('title').notNull(),createdAt:createdAt(),
},t=>[uniqueIndex('coach_reports_user_message_unique').on(t.userId,t.messageId)]);
