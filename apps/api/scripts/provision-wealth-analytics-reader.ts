import { Pool } from "@neondatabase/serverless";

import { env } from "../src/env.js";

const roleName = "wealth_analytics_reader";
const password = process.env.WEALTH_ANALYTICS_READER_PASSWORD?.trim();

if (!password || password.length < 24) {
  throw new Error("Set WEALTH_ANALYTICS_READER_PASSWORD to a random value of at least 24 characters before provisioning.");
}

const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL });

try {
  const literalResult = await pool.query<{ literal: string }>("select quote_literal($1) as literal", [password]);
  const passwordLiteral = literalResult.rows[0]?.literal;
  if (!passwordLiteral) throw new Error("Could not safely prepare the reader password.");

  const roleExists = await pool.query<{ exists: boolean }>("select exists(select 1 from pg_roles where rolname = $1) as exists", [roleName]);
  if (roleExists.rows[0]?.exists) {
    await pool.query(`alter role ${roleName} login password ${passwordLiteral}`);
  } else {
    await pool.query(`create role ${roleName} login password ${passwordLiteral}`);
  }

  // Neon does not allow a non-superuser owner to explicitly toggle the
  // SUPERUSER attribute. Newly created roles default to NOSUPERUSER; the
  // remaining capability restrictions can be applied explicitly.
  await pool.query(`alter role ${roleName} nocreatedb nocreaterole noreplication nobypassrls`);
  await pool.query(`revoke all on all tables in schema public from ${roleName}`);
  await pool.query(`revoke all on all sequences in schema public from ${roleName}`);
  await pool.query(`grant usage on schema analytics to ${roleName}`);
  await pool.query(`grant select on all tables in schema analytics to ${roleName}`);
  await pool.query(`alter default privileges in schema analytics grant select on tables to ${roleName}`);
  await pool.query(`revoke create on schema analytics from ${roleName}`);
  console.log(`[DB] Provisioned ${roleName} with SELECT access to analytics views.`);
  console.log("[DB] Store the generated password only in the analytics service's server-side VANNA_DATABASE_URL.");
} finally {
  await pool.end();
}
