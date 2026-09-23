import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "../env.js";
import * as schema from "./schema/index.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  query_timeout: env.DB_QUERY_TIMEOUT_MS,
});

// Neon serverless uses a WebSocket-backed pool. An idle connection can be
// closed by the provider while a long-running Coach request is using another
// connection. Without a pool error listener Node treats that provider event
// as an uncaught exception and takes down the API process.
pool.on("error", (error: unknown) => {
  console.error("[DB] idle pool connection closed", {
    message: error instanceof Error ? error.message : "unknown connection error",
  });
});

export const db = drizzle({ client: pool, schema });

if (process.env.NODE_ENV !== "production") {
  let host = "unknown";
  try {
    host = new URL(env.DATABASE_URL).hostname;
  } catch {
    // Keep diagnostics safe if a malformed value is supplied.
  }
  console.info("[DB] Neon connection configured", { configured: Boolean(env.DATABASE_URL), host, branch: env.NEON_BRANCH ?? "unspecified" });
}

export type DbExecutor = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutorLike = DbExecutor | DbTransaction;

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
