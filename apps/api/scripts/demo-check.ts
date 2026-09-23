import { sql } from "drizzle-orm";

import { closeDatabase, db } from "../src/db/client.js";

const externalAuthId = process.env.DEMO_AUTH_ID ?? "demo-customer-a";

async function run() {
  const userResult = await db.execute<{ id: string; external_auth_id: string }>(sql`
    select id, external_auth_id
    from users
    where external_auth_id = ${externalAuthId}
    limit 1
  `);
  const user = userResult.rows[0];
  if (!user) throw new Error(`Demo user not found for external auth id ${externalAuthId}.`);

  const [accounts, transactions, goals] = await Promise.all([
    db.execute<{ count: number }>(sql`select count(*)::int as count from accounts where user_id = ${user.id}`),
    db.execute<{ count: number }>(sql`select count(*)::int as count from transactions where account_id in (select id from accounts where user_id = ${user.id})`),
    db.execute<{ count: number }>(sql`select count(*)::int as count from wealth_goals where user_id = ${user.id}`),
  ]);
  const counts = {
    accounts: Number(accounts.rows[0]?.count ?? 0),
    transactions: Number(transactions.rows[0]?.count ?? 0),
    goals: Number(goals.rows[0]?.count ?? 0),
  };

  for (const [name, count] of Object.entries(counts)) {
    if (count < 1) throw new Error(`Demo ${name} are empty for ${user.id}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    externalAuthId,
    userId: user.id,
    counts,
  }));
}

try {
  await run();
} catch (error) {
  console.error("[DEMO] check failed", { message: error instanceof Error ? error.message : "unknown error" });
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
