CREATE TYPE "public"."account_status" AS ENUM('active', 'restricted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('savings', 'current', 'fixed_deposit', 'recurring_deposit');--> statement-breakpoint
CREATE TYPE "public"."beneficiary_status" AS ENUM('active', 'cooling_off', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."beneficiary_type" AS ENUM('bank', 'upi');--> statement-breakpoint
CREATE TYPE "public"."card_network" AS ENUM('visa', 'mastercard', 'rupay');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('active', 'temporarily_blocked', 'blocked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('debit', 'credit', 'virtual');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."insight_severity" AS ENUM('positive', 'neutral', 'attention');--> statement-breakpoint
CREATE TYPE "public"."insight_type" AS ENUM('spending', 'savings', 'cash_flow', 'goal', 'subscription', 'investment', 'bill', 'general');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'attention', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('transaction', 'security', 'account', 'card', 'coach', 'service');--> statement-breakpoint
CREATE TYPE "public"."transaction_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('salary', 'purchase', 'bill', 'transfer', 'refund', 'cash', 'deposit', 'interest', 'fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('draft', 'reviewing', 'submitted', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transfer_type" AS ENUM('own_account', 'bank', 'upi', 'neft', 'imps', 'rtgs');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."wealth_goal_status" AS ENUM('active', 'completed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."wealth_goal_type" AS ENUM('emergency_fund', 'retirement', 'travel', 'purchase', 'education', 'custom');--> statement-breakpoint
CREATE TABLE "account_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"ledger_balance" numeric(18, 2) NOT NULL,
	"available_balance" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"nickname" text NOT NULL,
	"masked_account_number" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"branch_name" text,
	"ifsc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beneficiaries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "beneficiary_type" NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"masked_account_number" text,
	"ifsc" text,
	"upi_id" text,
	"status" "beneficiary_status" DEFAULT 'active' NOT NULL,
	"cooling_off_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_controls" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"domestic_enabled" boolean DEFAULT true NOT NULL,
	"international_enabled" boolean DEFAULT false NOT NULL,
	"online_enabled" boolean DEFAULT true NOT NULL,
	"contactless_enabled" boolean DEFAULT true NOT NULL,
	"atm_enabled" boolean DEFAULT true NOT NULL,
	"daily_pos_limit" numeric(18, 2) DEFAULT '50000.00' NOT NULL,
	"daily_online_limit" numeric(18, 2) DEFAULT '25000.00' NOT NULL,
	"daily_atm_limit" numeric(18, 2) DEFAULT '20000.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"transaction_id" text,
	"merchant_name" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "transaction_status" DEFAULT 'completed' NOT NULL,
	"transaction_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"card_type" "card_type" NOT NULL,
	"network" "card_network" NOT NULL,
	"masked_card_number" text NOT NULL,
	"nickname" text NOT NULL,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"structured_payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "insight_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"severity" "insight_severity" DEFAULT 'neutral' NOT NULL,
	"metric_value" numeric(18, 2),
	"metric_unit" text,
	"comparison_value" numeric(18, 2),
	"comparison_period" text,
	"source_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_route" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monthly_financial_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" date NOT NULL,
	"income" numeric(18, 2) NOT NULL,
	"expenses" numeric(18, 2) NOT NULL,
	"savings" numeric(18, 2) NOT NULL,
	"savings_rate" numeric(7, 2) NOT NULL,
	"spending_change_percent" numeric(7, 2) NOT NULL,
	"goal_progress_percent" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transactions_enabled" boolean DEFAULT true NOT NULL,
	"security_enabled" boolean DEFAULT true NOT NULL,
	"coach_enabled" boolean DEFAULT true NOT NULL,
	"services_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"destination_route" text,
	"destination_params_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"preferred_currency" text DEFAULT 'INR' NOT NULL,
	"preferred_language" text DEFAULT 'en-IN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"icon_key" text NOT NULL,
	"icon_tone" text DEFAULT 'green' NOT NULL,
	"route" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"search_terms_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"direction" "transaction_direction" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"description" text NOT NULL,
	"merchant_name" text,
	"category_id" text,
	"reference" text,
	"transaction_at" timestamp with time zone NOT NULL,
	"status" "transaction_status" DEFAULT 'completed' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_events" (
	"id" text PRIMARY KEY NOT NULL,
	"transfer_id" text NOT NULL,
	"status" "transfer_status" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_account_id" text NOT NULL,
	"destination_account_id" text,
	"beneficiary_id" text,
	"transfer_type" "transfer_type" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"note" text,
	"status" "transfer_status" DEFAULT 'draft' NOT NULL,
	"demo_transaction" boolean DEFAULT true NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"external_auth_id" text NOT NULL,
	"email" text,
	"phone" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wealth_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "wealth_goal_type" NOT NULL,
	"title" text NOT NULL,
	"target_amount" numeric(18, 2) NOT NULL,
	"current_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"target_date" date,
	"monthly_contribution" numeric(18, 2),
	"status" "wealth_goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_controls" ADD CONSTRAINT "card_controls_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversation_id_coach_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_insights" ADD CONSTRAINT "financial_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_financial_snapshots" ADD CONSTRAINT "monthly_financial_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_favorites" ADD CONSTRAINT "service_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_favorites" ADD CONSTRAINT "service_favorites_service_id_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_beneficiary_id_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."beneficiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wealth_goals" ADD CONSTRAINT "wealth_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_balances_account_as_of_idx" ON "account_balances" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_user_status_idx" ON "accounts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_user_created_at_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "beneficiaries_user_status_idx" ON "beneficiaries" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "card_controls_card_id_unique" ON "card_controls" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_transactions_card_transaction_at_idx" ON "card_transactions" USING btree ("card_id","transaction_at");--> statement-breakpoint
CREATE INDEX "cards_user_status_idx" ON "cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "coach_conversations_user_updated_at_idx" ON "coach_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "coach_messages_conversation_created_at_idx" ON "coach_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "financial_insights_user_created_at_idx" ON "financial_insights" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshots_user_month_unique" ON "monthly_financial_snapshots" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "monthly_snapshots_user_month_idx" ON "monthly_financial_snapshots" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_id_unique" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_unique" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_slug_unique" ON "service_catalog" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_catalog_category_order_idx" ON "service_catalog" USING btree ("category","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "service_favorites_user_service_unique" ON "service_favorites" USING btree ("user_id","service_id");--> statement-breakpoint
CREATE INDEX "service_favorites_user_created_at_idx" ON "service_favorites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_slug_unique" ON "transaction_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "transactions_account_transaction_at_idx" ON "transactions" USING btree ("account_id","transaction_at");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_created_at_idx" ON "transfer_events" USING btree ("transfer_id","created_at");--> statement-breakpoint
CREATE INDEX "transfers_user_created_at_idx" ON "transfers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "transfers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_auth_id_unique" ON "users" USING btree ("external_auth_id");--> statement-breakpoint
CREATE INDEX "wealth_goals_user_status_idx" ON "wealth_goals" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_non_negative_check" CHECK ("ledger_balance" >= 0 AND "available_balance" >= 0);--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_available_not_above_ledger_check" CHECK ("available_balance" <= "ledger_balance");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_positive_amount_check" CHECK ("amount" > 0);--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_positive_amount_check" CHECK ("amount" > 0);--> statement-breakpoint
ALTER TABLE "wealth_goals" ADD CONSTRAINT "wealth_goals_positive_target_check" CHECK ("target_amount" > 0 AND "current_amount" >= 0 AND "current_amount" <= "target_amount");--> statement-breakpoint
ALTER TABLE "monthly_financial_snapshots" ADD CONSTRAINT "monthly_snapshots_non_negative_money_check" CHECK ("income" >= 0 AND "expenses" >= 0 AND "savings" >= 0);--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_positive_amount_check" CHECK ("amount" > 0);--> statement-breakpoint
ALTER TABLE "card_controls" ADD CONSTRAINT "card_controls_non_negative_limits_check" CHECK ("daily_pos_limit" >= 0 AND "daily_online_limit" >= 0 AND "daily_atm_limit" >= 0);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_valid_expiry_month_check" CHECK ("expiry_month" BETWEEN 1 AND 12);--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_primary_per_user" ON "accounts" USING btree ("user_id") WHERE "is_primary" = true;
