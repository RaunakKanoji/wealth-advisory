import { sql } from "drizzle-orm";

function safeHost(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

let closeDatabase: (() => Promise<void>) | undefined;

try {
  const database = await import("../src/db/client.js");
  closeDatabase = database.closeDatabase;
  const result = await database.db.execute<{ ok: number }>(sql`select 1 as ok`);
  if (Number(result.rows[0]?.ok) !== 1) throw new Error("SELECT 1 AS ok did not return 1.");
  console.log(JSON.stringify({ databaseUrlConfigured: true, ok: 1 }));
} catch (error) {
  console.error("[DB] test failed", {
    stage: "select_1",
    code: error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN",
    errorClass: error instanceof Error ? error.constructor.name : "UnknownError",
    host: safeHost(process.env.DATABASE_URL),
    message: error instanceof Error ? error.message : "unknown error",
  });
  process.exitCode = 1;
} finally {
  await closeDatabase?.();
}
