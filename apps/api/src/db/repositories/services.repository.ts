import { and, desc, eq } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { serviceCatalog, serviceFavorites } from "../schema/index.js";

export async function listServices(category?: string, executor: DbExecutorLike = db) {
  const condition = category ? and(eq(serviceCatalog.isActive, true), eq(serviceCatalog.category, category)) : eq(serviceCatalog.isActive, true);
  return executor.select().from(serviceCatalog).where(condition).orderBy(serviceCatalog.displayOrder);
}

export async function listFavorites(userId: string, executor: DbExecutorLike = db) {
  return executor.select({ favorite: serviceFavorites, service: serviceCatalog })
    .from(serviceFavorites).innerJoin(serviceCatalog, eq(serviceCatalog.id, serviceFavorites.serviceId))
    .where(and(eq(serviceFavorites.userId, userId), eq(serviceCatalog.isActive, true)))
    .orderBy(desc(serviceFavorites.createdAt));
}

export async function getService(serviceId: string, executor: DbExecutorLike = db) {
  const [service] = await executor.select().from(serviceCatalog).where(and(eq(serviceCatalog.id, serviceId), eq(serviceCatalog.isActive, true))).limit(1);
  return service;
}

export async function addFavorite(input: typeof serviceFavorites.$inferInsert, executor: DbExecutorLike = db) {
  const [favorite] = await executor.insert(serviceFavorites).values(input).onConflictDoNothing({ target: [serviceFavorites.userId, serviceFavorites.serviceId] }).returning();
  return favorite;
}

export async function removeFavorite(userId: string, serviceId: string, executor: DbExecutorLike = db) {
  return executor.delete(serviceFavorites).where(and(eq(serviceFavorites.userId, userId), eq(serviceFavorites.serviceId, serviceId))).returning({ id: serviceFavorites.id });
}
