import { and, desc, eq } from "drizzle-orm";

import { db, type DbExecutorLike } from "../client.js";
import { notificationPreferences, notifications } from "../schema/index.js";

export async function insertNotification(input: typeof notifications.$inferInsert, executor: DbExecutorLike = db) {
  const [notification] = await executor.insert(notifications).values(input).returning();
  return notification;
}

export async function listNotifications(userId: string, limit = 50, executor: DbExecutorLike = db) {
  return executor.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationCount(userId: string, executor: DbExecutorLike = db) {
  const rows = await executor.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

export async function markNotificationRead(userId: string, notificationId: string, executor: DbExecutorLike = db) {
  const [notification] = await executor.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId))).returning();
  return notification;
}

export async function markAllNotificationsRead(userId: string, executor: DbExecutorLike = db) {
  return executor.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId)).returning({ id: notifications.id });
}

export async function getNotificationPreferences(userId: string, executor: DbExecutorLike = db) {
  const [preferences] = await executor.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId)).limit(1);
  return preferences;
}

export async function upsertNotificationPreferences(userId: string, input: Omit<typeof notificationPreferences.$inferInsert, "id" | "userId">, executor: DbExecutorLike = db) {
  const [preferences] = await executor.insert(notificationPreferences).values({ id: `prefs_${userId}`, userId, ...input })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...input, updatedAt: new Date() } }).returning();
  return preferences;
}
