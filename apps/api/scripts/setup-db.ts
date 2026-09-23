import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

console.log("DATABASE_URL configured: true");

const tsx = resolve(process.cwd(), "node_modules/.bin/tsx");

// 1. Run migrations
execFileSync(tsx, ["src/db/migrate.ts"], { cwd: process.cwd(), stdio: "pipe" });

// 2. Run seed
execFileSync(tsx, ["src/db/seed.ts"], { cwd: process.cwd(), stdio: "pipe" });

// 3. Verify connection and row counts
const database = await import("../src/db/client.js");
try {
  const check = await database.db.execute<{ ok: number }>(sql`select 1 as ok`);
  if (Number(check.rows[0]?.ok) !== 1) {
    throw new Error("Database health check failed");
  }
  console.log("Database connected ✓");
  console.log("Migrations applied ✓");

  const [usersCount, accountsCount, balancesCount, txnCount] = await Promise.all([
    database.db.execute<{ count: number }>(sql`select count(*)::int as count from users`),
    database.db.execute<{ count: number }>(sql`select count(*)::int as count from accounts`),
    database.db.execute<{ count: number }>(sql`select count(*)::int as count from account_balances`),
    database.db.execute<{ count: number }>(sql`select count(*)::int as count from transactions`),
  ]);

  const users = Number(usersCount.rows[0]?.count ?? 0);
  const accounts = Number(accountsCount.rows[0]?.count ?? 0);
  const balances = Number(balancesCount.rows[0]?.count ?? 0);
  const transactions = Number(txnCount.rows[0]?.count ?? 0);

  console.log(`Users: ${users}`);
  console.log(`Accounts: ${accounts}`);
  console.log(`Balances: ${balances}`);
  console.log(`Transactions: ${transactions >= 30 ? "30+" : transactions}`);
  console.log("Database ready ✓");
} finally {
  await database.closeDatabase();
}
