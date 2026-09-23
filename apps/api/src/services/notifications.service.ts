import * as notificationsRepository from "../db/repositories/notifications.repository.js";
import * as auditRepository from "../db/repositories/audit.repository.js";
import { ApiError } from "../lib/errors.js";
import { id } from "../lib/ids.js";

type NotificationPreferences = {
  transactionsEnabled: boolean;
  securityEnabled: boolean;
  coachEnabled: boolean;
  servicesEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

const defaultPreferences: NotificationPreferences = {
  transactionsEnabled: true,
  securityEnabled: true,
  coachEnabled: true,
  servicesEnabled: true,
  pushEnabled: true,
  emailEnabled: false,
};

function preferencesDto(preferences: NotificationPreferences) {
  return {
    transactionsEnabled: preferences.transactionsEnabled,
    securityEnabled: preferences.securityEnabled,
    coachEnabled: preferences.coachEnabled,
    servicesEnabled: preferences.servicesEnabled,
    pushEnabled: preferences.pushEnabled,
    emailEnabled: preferences.emailEnabled,
  };
}

export async function listNotifications(userId: string, options?: { type?: string; limit?: number }) {
  const items = await notificationsRepository.listNotifications(userId, Math.min(50, Math.max(1, options?.limit ?? 30)));
  const filtered = options?.type && options.type !== "all" ? items.filter((item) => item.type === options.type) : items;
  return {
    items: filtered.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      severity: item.severity,
      isRead: item.isRead,
      destinationRoute: item.destinationRoute,
      destinationParams: item.destinationParamsJson ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    unreadCount: items.filter((item) => !item.isRead).length,
  };
}

export async function markRead(userId: string, notificationId: string) {
  const notification = await notificationsRepository.markNotificationRead(userId, notificationId);
  if (!notification) throw new ApiError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
  return { id: notification.id, isRead: notification.isRead };
}

export async function markAllRead(userId: string) {
  const updated = await notificationsRepository.markAllNotificationsRead(userId);
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "notifications_marked_read", entityType: "notification", metadataJson: { count: updated.length } });
  return { updatedCount: updated.length };
}

export async function getPreferences(userId: string) {
  const preferences = await notificationsRepository.getNotificationPreferences(userId);
  return preferences ? preferencesDto(preferences) : defaultPreferences;
}

export async function updatePreferences(userId: string, input: unknown) {
  const patch = preferencesSchema.parse(input);
  const preferences = await notificationsRepository.upsertNotificationPreferences(userId, patch);
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "notification_preference_updated", entityType: "notification_preferences", entityId: preferences.id, metadataJson: { changedFields: Object.keys(patch) } });
  return preferencesDto(preferences);
}

export const preferencesSchema = {
  parse(input: unknown) {
    if (!input || typeof input !== "object") throw new ApiError("INVALID_PREFERENCES", "Notification preferences are invalid.", 422);
    const record = input as Record<string, unknown>;
    const keys = ["transactionsEnabled", "securityEnabled", "coachEnabled", "servicesEnabled", "pushEnabled", "emailEnabled"] as const;
    const result: Partial<Record<(typeof keys)[number], boolean>> = {};
    for (const key of keys) if (key in record) {
      if (typeof record[key] !== "boolean") throw new ApiError("INVALID_PREFERENCES", "Notification preferences must be boolean values.", 422);
      result[key] = record[key];
    }
    return result;
  },
};
