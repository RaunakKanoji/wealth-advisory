import { eq } from "drizzle-orm";

import { db } from "../client.js";
import { profiles, users } from "../schema/index.js";

export async function findUserByExternalAuthId(externalAuthId: string) {
  const [user] = await db.select().from(users).where(eq(users.externalAuthId, externalAuthId)).limit(1);
  return user;
}

export async function findUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

export async function upsertUser(input: { id: string; externalAuthId: string; email?: string | null; phone?: string | null }) {
  const [user] = await db.insert(users).values(input).onConflictDoUpdate({
    target: users.externalAuthId,
    set: { email: input.email ?? null, phone: input.phone ?? null, updatedAt: new Date() },
  }).returning();
  return user;
}

export async function getProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile;
}
