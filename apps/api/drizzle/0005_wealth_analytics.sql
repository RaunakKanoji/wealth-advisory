CREATE SCHEMA IF NOT EXISTS analytics;
--> statement-breakpoint

-- The analytics service sets this transaction-local value before every query.
-- Empty/unset context returns no financial rows, even if a model omits a user predicate.
CREATE OR REPLACE VIEW analytics.user_accounts WITH (security_barrier = true) AS
SELECT
  a.user_id,
  a.id AS account_id,
  a.account_type,
  a.nickname AS account_name,
  a.masked_account_number,
  a.currency,
  a.source_environment,
  a.status,
  COALESCE(b.ledger_balance, 0.00)::numeric(18, 2) AS ledger_balance,
  b.available_balance,
  b.as_of
FROM accounts a
LEFT JOIN LATERAL (
  SELECT ab.ledger_balance, ab.available_balance, ab.as_of
  FROM account_balances ab
  WHERE ab.account_id = a.id
  ORDER BY ab.as_of DESC, ab.created_at DESC
  LIMIT 1
) b ON true
WHERE a.status = 'active'
  AND a.user_id = NULLIF(current_setting('app.user_id', true), '');
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.user_transactions WITH (security_barrier = true) AS
WITH base AS (
  SELECT
    t.account_id,
    t.id AS transaction_id,
    a.user_id,
    t.transaction_at::date AS transaction_date,
    COALESCE(t.merchant_name, NULLIF(t.description, ''), 'Unknown merchant') AS merchant,
    t.description,
    COALESCE(tc.slug, 'other') AS category,
    COALESCE(tc.name, 'Other') AS category_name,
    t.amount::numeric(18, 2) AS amount,
    t.direction::text AS direction,
    t.type::text AS transaction_type,
    t.status::text AS status,
    t.currency,
    t.reference,
    COALESCE(t.metadata_json ->> 'channel', 'unknown') AS channel,
    (COALESCE(tc.slug, '') = 'transfer' OR t.type::text = 'transfer') AS is_internal_transfer,
    (t.type::text = 'refund' OR COALESCE(tc.slug, '') = 'refund') AS is_refund,
    'account'::text AS source_kind
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN transaction_categories tc ON tc.id = t.category_id
  WHERE a.status = 'active'
    AND a.user_id = NULLIF(current_setting('app.user_id', true), '')

  UNION ALL

  SELECT
    c.account_id,
    ct.id AS transaction_id,
    c.user_id,
    ct.transaction_at::date AS transaction_date,
    COALESCE(ct.merchant_name, 'Unknown merchant') AS merchant,
    ct.merchant_name AS description,
    'other'::text AS category,
    'Other'::text AS category_name,
    ct.amount::numeric(18, 2) AS amount,
    'debit'::text AS direction,
    'card_purchase'::text AS transaction_type,
    ct.status::text AS status,
    ct.currency,
    NULL::text AS reference,
    'card'::text AS channel,
    false AS is_internal_transfer,
    false AS is_refund,
    'card'::text AS source_kind
  FROM card_transactions ct
  JOIN cards c ON c.id = ct.card_id
  WHERE c.user_id = NULLIF(current_setting('app.user_id', true), '')
    AND ct.transaction_id IS NULL
), recurring_merchants AS (
  SELECT user_id, LOWER(merchant) AS merchant_key
  FROM base
  GROUP BY user_id, LOWER(merchant)
  HAVING COUNT(*) >= 3
     AND COUNT(DISTINCT DATE_TRUNC('month', transaction_date)) >= 2
)
SELECT
  base.*,
  EXISTS (
    SELECT 1 FROM recurring_merchants recurring
    WHERE recurring.user_id = base.user_id
      AND recurring.merchant_key = LOWER(base.merchant)
  ) AS is_recurring
FROM base;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.monthly_cashflow WITH (security_barrier = true) AS
WITH grouped AS (
  SELECT
    user_id,
    DATE_TRUNC('month', transaction_date)::date AS month,
    SUM(CASE WHEN direction = 'credit' AND status = 'completed' AND NOT is_refund AND NOT is_internal_transfer THEN amount ELSE 0 END)::numeric(18, 2) AS income,
    SUM(CASE WHEN direction = 'debit' AND status = 'completed' AND NOT is_refund AND NOT is_internal_transfer THEN amount ELSE 0 END)::numeric(18, 2) AS expenses
  FROM analytics.user_transactions
  WHERE currency = 'INR'
  GROUP BY user_id, DATE_TRUNC('month', transaction_date)::date
)
SELECT
  user_id,
  month,
  income,
  expenses,
  (income - expenses)::numeric(18, 2) AS savings,
  CASE WHEN income = 0 THEN 0.00 ELSE ROUND(((income - expenses) / income) * 100, 2) END::numeric(7, 2) AS savings_rate
FROM grouped;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.category_spending WITH (security_barrier = true) AS
WITH grouped AS (
  SELECT
    user_id,
    DATE_TRUNC('month', transaction_date)::date AS month,
    category,
    category_name,
    SUM(amount)::numeric(18, 2) AS total_spent,
    COUNT(*)::int AS transaction_count
  FROM analytics.user_transactions
  WHERE currency = 'INR'
    AND direction = 'debit'
    AND status = 'completed'
    AND NOT is_internal_transfer
    AND NOT is_refund
  GROUP BY user_id, DATE_TRUNC('month', transaction_date)::date, category, category_name
)
SELECT
  user_id,
  month,
  category,
  category_name,
  total_spent,
  transaction_count,
  LAG(total_spent) OVER (PARTITION BY user_id, category ORDER BY month) AS previous_period_spend,
  (total_spent - COALESCE(LAG(total_spent) OVER (PARTITION BY user_id, category ORDER BY month), 0))::numeric(18, 2) AS difference,
  CASE
    WHEN COALESCE(LAG(total_spent) OVER (PARTITION BY user_id, category ORDER BY month), 0) = 0 THEN NULL
    ELSE ROUND(((total_spent - LAG(total_spent) OVER (PARTITION BY user_id, category ORDER BY month)) / LAG(total_spent) OVER (PARTITION BY user_id, category ORDER BY month)) * 100, 2)
  END::numeric(9, 2) AS percentage_change
FROM grouped;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.merchant_spending WITH (security_barrier = true) AS
SELECT
  user_id,
  LOWER(merchant) AS merchant_key,
  merchant,
  SUM(amount)::numeric(18, 2) AS total_spent,
  COUNT(*)::int AS transaction_count,
  ROUND(SUM(amount) / NULLIF(COUNT(*), 0), 2)::numeric(18, 2) AS average_purchase,
  MIN(transaction_date) AS first_transaction_date,
  MAX(transaction_date) AS last_transaction_date
FROM analytics.user_transactions
WHERE currency = 'INR'
  AND direction = 'debit'
  AND status = 'completed'
  AND NOT is_internal_transfer
  AND NOT is_refund
GROUP BY user_id, LOWER(merchant), merchant;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.recurring_payments WITH (security_barrier = true) AS
SELECT
  user_id,
  LOWER(merchant) AS merchant_key,
  merchant,
  SUM(amount)::numeric(18, 2) / GREATEST(COUNT(DISTINCT DATE_TRUNC('month', transaction_date)), 1)::numeric(18, 2) AS estimated_monthly_amount,
  (SUM(amount)::numeric(18, 2) / GREATEST(COUNT(DISTINCT DATE_TRUNC('month', transaction_date)), 1) * 12)::numeric(18, 2) AS estimated_annual_amount,
  COUNT(*)::int AS transaction_count,
  MIN(transaction_date) AS first_transaction_date,
  MAX(transaction_date) AS last_transaction_date
FROM analytics.user_transactions
WHERE currency = 'INR'
  AND direction = 'debit'
  AND status = 'completed'
  AND NOT is_internal_transfer
  AND NOT is_refund
  AND is_recurring
GROUP BY user_id, LOWER(merchant), merchant;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.goal_progress WITH (security_barrier = true) AS
SELECT
  user_id,
  id AS goal_id,
  title AS goal_name,
  target_amount,
  current_amount,
  GREATEST(target_amount - current_amount, 0)::numeric(18, 2) AS remaining_amount,
  CASE WHEN target_amount = 0 THEN 0.00 ELSE ROUND((current_amount / target_amount) * 100, 2) END::numeric(9, 2) AS progress_percentage,
  target_date,
  monthly_contribution,
  status
FROM wealth_goals
WHERE user_id = NULLIF(current_setting('app.user_id', true), '');
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.income_summary WITH (security_barrier = true) AS
SELECT
  user_id,
  DATE_TRUNC('month', transaction_date)::date AS month,
  category,
  category_name,
  SUM(amount)::numeric(18, 2) AS total_income,
  COUNT(*)::int AS transaction_count
FROM analytics.user_transactions
WHERE currency = 'INR'
  AND direction = 'credit'
  AND status = 'completed'
  AND NOT is_refund
  AND NOT is_internal_transfer
GROUP BY user_id, DATE_TRUNC('month', transaction_date)::date, category, category_name;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.expense_summary WITH (security_barrier = true) AS
SELECT
  user_id,
  DATE_TRUNC('month', transaction_date)::date AS month,
  category,
  category_name,
  SUM(amount)::numeric(18, 2) AS total_expenses,
  COUNT(*)::int AS transaction_count
FROM analytics.user_transactions
WHERE currency = 'INR'
  AND direction = 'debit'
  AND status = 'completed'
  AND NOT is_refund
  AND NOT is_internal_transfer
GROUP BY user_id, DATE_TRUNC('month', transaction_date)::date, category, category_name;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.savings_summary AS
SELECT * FROM analytics.monthly_cashflow;
--> statement-breakpoint

CREATE OR REPLACE VIEW analytics.net_worth_summary WITH (security_barrier = true) AS
SELECT
  user_id,
  SUM(CASE WHEN account_type IN ('savings', 'current') THEN ledger_balance ELSE 0 END)::numeric(18, 2) AS cash_savings,
  SUM(CASE WHEN account_type IN ('fixed_deposit', 'recurring_deposit') THEN ledger_balance ELSE 0 END)::numeric(18, 2) AS deposits,
  0.00::numeric(18, 2) AS investments,
  0.00::numeric(18, 2) AS other_assets,
  0.00::numeric(18, 2) AS total_liabilities,
  SUM(ledger_balance)::numeric(18, 2) AS total_assets,
  SUM(ledger_balance)::numeric(18, 2) AS net_worth
FROM analytics.user_accounts
GROUP BY user_id;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wealth_analytics_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA analytics TO wealth_analytics_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO wealth_analytics_reader';
  END IF;
END $$;
