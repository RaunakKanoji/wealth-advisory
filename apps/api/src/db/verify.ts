import { sql } from "drizzle-orm";

import { closeDatabase, db } from "./client.js";

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

async function checkDatabase() {
  const health = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  if (Number(health.rows[0]?.ok) !== 1) throw new Error("SELECT 1 AS ok did not return 1.");
  console.log("[DB] connection OK");
  console.log("[DB] DATABASE_URL configured: true");

  const tableRows = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (${sql.join(requiredTables.map((table) => sql`${table}`), sql`, `)})
  `);
  const tables = new Set(tableRows.rows.map((row) => row.table_name));
  for (const table of requiredTables) console.log(`${table} table: ${tables.has(table) ? "OK" : "MISSING"}`);
  if (requiredTables.some((table) => !tables.has(table))) throw new Error("One or more required tables are missing.");

  const counts = await Promise.all(requiredTables.map(async (table) => {
    const result = await db.execute<{ count: number }>(sql.raw(`select count(*)::int as count from "${table}"`));
    return [table, Number(result.rows[0]?.count ?? 0)] as const;
  }));
  const countByTable = new Map(counts);
  const demoUser = await db.execute<{ id: string }>(sql`
    select id
    from users
    where external_auth_id = 'demo-customer-a'
    limit 1
  `);
  const demoAccountsCount = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from accounts
    where user_id = 'usr_demo_a'
  `);

  console.log(`[DB] branch: ${process.env.NEON_BRANCH ?? "unspecified"}`);
  for (const table of requiredTables) console.log(`[DB] ${table}: ${countByTable.get(table) ?? 0}`);
  console.log(`[AUTH] internal user resolved: ${Boolean(demoUser.rows[0]?.id)}`);
  console.log(`[DB] demo user accounts: ${Number(demoAccountsCount.rows[0]?.count ?? 0)}`);

  if (!demoUser.rows[0]?.id || Number(demoAccountsCount.rows[0]?.count ?? 0) < 4) {
    throw new Error("Seeded demo user or account ownership is incomplete.");
  }
}

try {
  await checkDatabase();
} catch (error) {
  console.error("[DB] check failed", { message: error instanceof Error ? error.message : "unknown error" });
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
