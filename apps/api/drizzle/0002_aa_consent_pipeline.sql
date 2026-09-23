CREATE TYPE "public"."aa_consent_status" AS ENUM('requested', 'pending', 'active', 'paused', 'revoked', 'expired', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."aa_data_session_status" AS ENUM('requested', 'ready', 'processing', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."aa_session_account_status" AS ENUM('pending', 'received', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."financial_connection_state" AS ENUM('pending', 'connected', 'syncing', 'needs_reauth', 'revoked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_batch_status" AS ENUM('received', 'processed', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'dead_letter');--> statement-breakpoint

CREATE TABLE "financial_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"environment" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"provider_connection_id" text,
	"state" "financial_connection_state" DEFAULT 'pending' NOT NULL,
	"capabilities_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sync_attempt_at" timestamp with time zone,
	"last_successful_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aa_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"financial_connection_id" text,
	"provider" text NOT NULL,
	"provider_consent_handle" text,
	"provider_consent_id" text,
	"purpose_code" text NOT NULL,
	"purpose_text" text NOT NULL,
	"status" "aa_consent_status" DEFAULT 'requested' NOT NULL,
	"provider_status_original" text,
	"fi_types_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fi_sections_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_account_scope_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consent_start" timestamp with time zone,
	"consent_expiry" timestamp with time zone,
	"requested_from" timestamp with time zone NOT NULL,
	"requested_to" timestamp with time zone NOT NULL,
	"fetch_type" text NOT NULL,
	"fetch_frequency" text NOT NULL,
	"consent_mode" text NOT NULL,
	"data_life_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aa_data_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"consent_id" text NOT NULL,
	"provider_session_id" text,
	"requested_from" timestamp with time zone NOT NULL,
	"requested_to" timestamp with time zone NOT NULL,
	"status" "aa_data_session_status" DEFAULT 'requested' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"environment" text NOT NULL,
	"financial_connection_id" text,
	"consent_id" text,
	"session_id" text,
	"ingested_at" timestamp with time zone NOT NULL,
	"normalizer_version" text NOT NULL,
	"coverage_from" timestamp with time zone,
	"coverage_to" timestamp with time zone,
	"record_count" integer DEFAULT 0 NOT NULL,
	"status" "ingestion_batch_status" DEFAULT 'received' NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "financial_connection_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "source_account_ref" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "source_provider" text DEFAULT 'seed' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "source_environment" text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "verified_capabilities_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "account_balances" ADD COLUMN "ingestion_batch_id" text;--> statement-breakpoint
ALTER TABLE "account_balances" ADD COLUMN "source_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ingestion_batch_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "source_transaction_id" text;--> statement-breakpoint

CREATE TABLE "aa_consent_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"consent_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_link_ref" text,
	"selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aa_session_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"consent_account_id" text,
	"account_id" text,
	"provider_link_ref" text,
	"status" "aa_session_account_status" DEFAULT 'pending' NOT NULL,
	"coverage_from" timestamp with time zone,
	"coverage_to" timestamp with time zone,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_provenance" (
	"id" text PRIMARY KEY NOT NULL,
	"ingestion_batch_id" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"provider_record_id" text,
	"source_reported_at" timestamp with time zone,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aa_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"consent_id" text,
	"session_id" text,
	"payload_hash" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"consent_id" text,
	"session_id" text,
	"webhook_event_id" text,
	"status" "ingestion_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "financial_connections" ADD CONSTRAINT "financial_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_consents" ADD CONSTRAINT "aa_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_consents" ADD CONSTRAINT "aa_consents_financial_connection_id_financial_connections_id_fk" FOREIGN KEY ("financial_connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_sessions" ADD CONSTRAINT "aa_data_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_sessions" ADD CONSTRAINT "aa_data_sessions_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_financial_connection_id_financial_connections_id_fk" FOREIGN KEY ("financial_connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_session_id_aa_data_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."aa_data_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_financial_connection_id_financial_connections_id_fk" FOREIGN KEY ("financial_connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_ingestion_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("ingestion_batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ingestion_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("ingestion_batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_consent_accounts" ADD CONSTRAINT "aa_consent_accounts_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_consent_accounts" ADD CONSTRAINT "aa_consent_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_session_accounts" ADD CONSTRAINT "aa_session_accounts_session_id_aa_data_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."aa_data_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_session_accounts" ADD CONSTRAINT "aa_session_accounts_consent_account_id_aa_consent_accounts_id_fk" FOREIGN KEY ("consent_account_id") REFERENCES "public"."aa_consent_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_session_accounts" ADD CONSTRAINT "aa_session_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_provenance" ADD CONSTRAINT "record_provenance_ingestion_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("ingestion_batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_webhook_events" ADD CONSTRAINT "aa_webhook_events_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_webhook_events" ADD CONSTRAINT "aa_webhook_events_session_id_aa_data_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."aa_data_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_session_id_aa_data_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."aa_data_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_webhook_event_id_aa_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."aa_webhook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "financial_connections_user_state_idx" ON "financial_connections" USING btree ("user_id", "state");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_connections_provider_connection_unique" ON "financial_connections" USING btree ("provider", "provider_connection_id");--> statement-breakpoint
CREATE INDEX "aa_consents_user_status_idx" ON "aa_consents" USING btree ("user_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "aa_consents_provider_handle_unique" ON "aa_consents" USING btree ("provider", "provider_consent_handle");--> statement-breakpoint
CREATE UNIQUE INDEX "aa_consents_provider_id_unique" ON "aa_consents" USING btree ("provider", "provider_consent_id");--> statement-breakpoint
CREATE INDEX "aa_data_sessions_user_status_idx" ON "aa_data_sessions" USING btree ("user_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "aa_data_sessions_provider_session_unique" ON "aa_data_sessions" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "ingestion_batches_user_ingested_at_idx" ON "ingestion_batches" USING btree ("user_id", "ingested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_connection_source_ref_unique" ON "accounts" USING btree ("financial_connection_id", "source_account_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "aa_consent_accounts_consent_account_unique" ON "aa_consent_accounts" USING btree ("consent_id", "account_id");--> statement-breakpoint
CREATE INDEX "aa_consent_accounts_account_idx" ON "aa_consent_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "aa_session_accounts_session_status_idx" ON "aa_session_accounts" USING btree ("session_id", "status");--> statement-breakpoint
CREATE INDEX "record_provenance_record_idx" ON "record_provenance" USING btree ("record_type", "record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "record_provenance_batch_record_unique" ON "record_provenance" USING btree ("ingestion_batch_id", "record_type", "record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aa_webhook_events_provider_event_unique" ON "aa_webhook_events" USING btree ("provider", "event_id");--> statement-breakpoint
CREATE INDEX "aa_webhook_events_processing_idx" ON "aa_webhook_events" USING btree ("processing_status", "received_at");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_status_next_attempt_idx" ON "ingestion_jobs" USING btree ("status", "next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_jobs_session_unique" ON "ingestion_jobs" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_account_source_id_unique" ON "transactions" USING btree ("account_id", "source_transaction_id");--> statement-breakpoint
