-- Linked card transactions are already represented by their account
-- transaction when transaction_id is populated. Keep card-only records, but
-- do not count the linked record twice in analytics.
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
SELECT base.*, EXISTS (
  SELECT 1 FROM recurring_merchants recurring
  WHERE recurring.user_id = base.user_id
    AND recurring.merchant_key = LOWER(base.merchant)
) AS is_recurring
FROM base;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wealth_analytics_reader') THEN
    EXECUTE 'GRANT SELECT ON analytics.user_transactions TO wealth_analytics_reader';
  END IF;
END $$;
