CREATE TABLE coach_consents (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, granted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE coach_context (conversation_id text PRIMARY KEY REFERENCES coach_conversations(id) ON DELETE CASCADE, context_json jsonb NOT NULL, scope_json jsonb, updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE coach_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, conversation_id text NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE, user_message_id text NOT NULL REFERENCES coach_messages(id) ON DELETE CASCADE, assistant_message_id text REFERENCES coach_messages(id) ON DELETE SET NULL, status text NOT NULL CHECK(status IN ('running','completed','failed','cancelled')), plan_json jsonb, verified_json jsonb, model_metadata_json jsonb, failure_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX coach_runs_active_unique ON coach_runs(conversation_id) WHERE status='running';
--> statement-breakpoint
CREATE INDEX coach_runs_user_created_idx ON coach_runs(user_id,created_at);
--> statement-breakpoint
CREATE TABLE coach_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, message_id text NOT NULL REFERENCES coach_messages(id) ON DELETE CASCADE, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX coach_reports_user_message_unique ON coach_reports(user_id,message_id);
--> statement-breakpoint
CREATE INDEX transactions_merchant_date_idx ON transactions(lower(merchant_name),transaction_at);
--> statement-breakpoint
CREATE INDEX transactions_account_status_date_idx ON transactions(account_id,status,transaction_at);
