import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { getDemoNotifications } from "@/data/notifications-demo-data";
import type { NotificationItem } from "@/types/notifications";

const NOTIFICATION_STATE_KEY_PREFIX = "idbi-notification-state";

type StoredNotificationState = {
  readById: Record<string, boolean>;
};

const inMemoryState = new Map<string, StoredNotificationState>();

function customerScope(customerId?: string | null): string {
  return customerId?.trim() || DEMO_CUSTOMER_A;
}

function storageKey(customerId: string): string {
  return `${NOTIFICATION_STATE_KEY_PREFIX}.${customerId.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

function emptyState(): StoredNotificationState {
  return { readById: {} };
}

function parseState(value: string | null): StoredNotificationState {
  if (!value) return emptyState();

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return emptyState();
    const readById = (parsed as { readById?: unknown }).readById;
    if (!readById || typeof readById !== "object") return emptyState();

    return {
      readById: Object.fromEntries(
        Object.entries(readById).filter(([, read]) => typeof read === "boolean"),
      ),
    };
  } catch {
    return emptyState();
  }
}

async function loadState(customerId: string): Promise<StoredNotificationState> {
  const scope = customerScope(customerId);
  const cached = inMemoryState.get(scope);
  if (cached) return cached;

  try {
    let stored = await SecureStore.getItemAsync(storageKey(scope));
    if (!stored && Platform.OS === "web" && typeof localStorage !== "undefined") {
      stored = localStorage.getItem(storageKey(scope));
    }
    const state = parseState(stored);
    inMemoryState.set(scope, state);
    return state;
  } catch {
    const state = Platform.OS === "web" && typeof localStorage !== "undefined"
      ? parseState(localStorage.getItem(storageKey(scope)))
      : emptyState();
    inMemoryState.set(scope, state);
    return state;
  }
}

async function saveState(customerId: string, state: StoredNotificationState): Promise<void> {
  const scope = customerScope(customerId);
  inMemoryState.set(scope, state);
  const serialized = JSON.stringify(state);

  try {
    await SecureStore.setItemAsync(storageKey(scope), serialized);
  } catch {
    // The in-memory state keeps this demo usable when secure storage is unavailable.
  }

  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey(scope), serialized);
    } catch {
      // Browser storage may be disabled; the in-memory value still works.
    }
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The notification request was cancelled", "AbortError");
  }
}

export async function getNotifications(options?: {
  customerId?: string | null;
  signal?: AbortSignal;
}): Promise<NotificationItem[]> {
  assertNotAborted(options?.signal);
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const notifications = getDemoNotifications(customerId)
    .map((item) => ({
      ...item,
      read: state.readById[item.id] ?? item.read,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  assertNotAborted(options?.signal);
  return notifications;
}

export async function markNotificationRead(
  notificationId: string,
  options?: { customerId?: string | null },
): Promise<void> {
  if (!notificationId.trim()) return;
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  await saveState(customerId, {
    ...state,
    readById: { ...state.readById, [notificationId]: true },
  });
}

export async function markAllNotificationsRead(options?: {
  customerId?: string | null;
}): Promise<void> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const readById = getDemoNotifications(customerId).reduce<Record<string, boolean>>(
    (result, item) => ({ ...result, [item.id]: true }),
    { ...state.readById },
  );
  await saveState(customerId, { ...state, readById });
}

export async function clearNotificationState(customerId?: string | null): Promise<void> {
  const scope = customerScope(customerId);
  inMemoryState.delete(scope);
  try {
    await SecureStore.deleteItemAsync(storageKey(scope));
  } catch {
    // Secure storage may be unavailable in tests or web builds.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(storageKey(scope));
    } catch {
      // Browser storage may be disabled.
    }
  }
}
