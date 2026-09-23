import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NotificationRow } from "@/components/notifications/notification-row";
import { appColors, appRadii, appShadows, appSpacing } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A, DEMO_SCENARIO_DATE } from "@/data/accounts-demo-data";
import { formatDate } from "@/lib/date";
import { isRemoteDataEnabled } from "@/lib/env";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/lib/api/hooks";
import type { ApiNotification } from "@/lib/api/types";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications-service";
import type { NotificationFilter, NotificationItem } from "@/types/notifications";

const filterChoices: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "transactions", label: "Transactions" },
  { value: "security", label: "Security" },
  { value: "coach", label: "Coach" },
  { value: "services", label: "Services" },
];

type LoadState = "loading" | "ready" | "error";

function matchesFilter(item: NotificationItem, filter: NotificationFilter): boolean {
  if (filter === "all") return true;
  if (filter === "transactions") return item.type === "transaction";
  if (filter === "security") return item.type === "security";
  if (filter === "coach") return item.type === "coach";
  return item.type === "account" || item.type === "card" || item.type === "service";
}

function yesterdayKey(): string {
  const yesterday = new Date(`${DEMO_SCENARIO_DATE.slice(0, 10)}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

function formatNotificationTimestamp(createdAt: string): string {
  const dateKey = createdAt.slice(0, 10);
  const todayKey = DEMO_SCENARIO_DATE.slice(0, 10);
  const dateLabel = dateKey === todayKey
    ? "Today"
    : dateKey === yesterdayKey()
      ? "Yesterday"
      : formatDate(dateKey);
  const timeLabel = new Date(createdAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${dateLabel} · ${timeLabel}`;
}

function sectionLabel(createdAt: string): "Today" | "Earlier" {
  return createdAt.slice(0, 10) === DEMO_SCENARIO_DATE.slice(0, 10) ? "Today" : "Earlier";
}

function apiNotificationToItem(item: ApiNotification): NotificationItem {
  return {
    id: item.id,
    type: item.type as NotificationItem["type"],
    title: item.title,
    message: item.message,
    createdAt: item.createdAt,
    read: item.isRead,
    severity: item.severity as NotificationItem["severity"],
    destination: item.destinationRoute
      ? { pathname: item.destinationRoute, params: item.destinationParams ?? undefined }
      : undefined,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const remoteNotifications = useNotifications();
  const { refetch: refetchRemoteNotifications } = remoteNotifications;
  const markNotificationReadRemote = useMarkNotificationRead();
  const markAllNotificationsReadRemote = useMarkAllNotificationsRead();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setLoadState("loading");
    }
    setError(null);

    if (isRemoteDataEnabled) {
      try {
        const result = await refetchRemoteNotifications();
        if (result.error) throw result.error;
        if (result.data) setItems(result.data.items.map(apiNotificationToItem));
        setLoadState("ready");
      } catch {
        setLoadState("error");
        setError("Unable to load notifications");
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    try {
      const nextItems = await getNotifications({ customerId });
      setItems(nextItems);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("Unable to load notifications");
    } finally {
      setIsRefreshing(false);
    }
  }, [customerId, refetchRemoteNotifications]);

  useEffect(() => {
    if (!isRemoteDataEnabled) return;
    if (remoteNotifications.data) {
      setItems(remoteNotifications.data.items.map(apiNotificationToItem));
      setLoadState("ready");
      setError(null);
    } else if (remoteNotifications.error) {
      setLoadState("error");
      setError("Unable to load notifications");
    } else if (remoteNotifications.isLoading) {
      setLoadState("loading");
    }
  }, [remoteNotifications.data, remoteNotifications.error, remoteNotifications.isLoading]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items],
  );
  const unreadCount = items.filter((item) => !item.read).length;
  const activeFilterLabel = filterChoices.find((choice) => choice.value === filter)?.label.toLowerCase() ?? filter;
  const activeFilterTitle = filter === "transactions" ? "transaction" : activeFilterLabel;
  const sections = useMemo(() => {
    const grouped: { label: "Today" | "Earlier"; items: NotificationItem[] }[] = [
      { label: "Today", items: [] },
      { label: "Earlier", items: [] },
    ];
    filteredItems.forEach((item) => {
      grouped[sectionLabel(item.createdAt) === "Today" ? 0 : 1].items.push(item);
    });
    return grouped.filter((section) => section.items.length > 0);
  }, [filteredItems]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)");
    }
  };

  const openNotification = (item: NotificationItem) => {
    if (!item.read) {
      setItems((current) => current.map((candidate) => (
        candidate.id === item.id ? { ...candidate, read: true } : candidate
      )));
      if (isRemoteDataEnabled) {
        void markNotificationReadRemote.mutateAsync(item.id).catch(() => void loadNotifications(true));
      } else {
        void markNotificationRead(item.id, { customerId });
      }
    }

    if (item.destination) {
      router.push({
        pathname: item.destination.pathname as never,
        params: item.destination.params,
      } as never);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      if (isRemoteDataEnabled) await markAllNotificationsReadRemote.mutateAsync(undefined);
      else await markAllNotificationsRead({ customerId });
    } catch {
      void loadNotifications(true);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.headerSide, styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={appColors.primary}
            colors={[appColors.primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {loadState === "loading" ? (
            <View style={[styles.listCard, styles.loadingCard]} accessibilityLabel="Loading notifications">
              <ActivityIndicator color={appColors.primary} />
            </View>
          ) : loadState === "error" ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIcon}>
                <Ionicons name="cloud-offline-outline" size={25} color={appColors.warning} />
              </View>
              <Text accessibilityRole="header" style={styles.stateTitle}>{error ?? "Unable to load notifications"}</Text>
              <Text style={styles.stateDescription}>Please try again.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadNotifications()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={34} color={appColors.textMuted} />
              </View>
              <Text accessibilityRole="header" style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyDescription}>
                We&apos;ll let you know when there are important updates about your accounts, payments, security, or Wealth Coach.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.toolbar}>
                <Text style={styles.inboxSummary}>
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                </Text>
                {unreadCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mark all notifications as read"
                    onPress={() => void markAllRead()}
                    style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.markAllText}>Mark all as read</Text>
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
                style={styles.filterScroll}
              >
                {filterChoices.map((choice) => {
                  const selected = choice.value === filter;
                  return (
                    <Pressable
                      key={choice.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${choice.label.toLowerCase()} notifications`}
                      accessibilityState={{ selected }}
                      onPress={() => setFilter(choice.value)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        selected && styles.filterChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {sections.length === 0 ? (
                <View style={styles.filteredEmpty}>
                  <Ionicons name="filter-outline" size={25} color={appColors.iconMuted} />
                  <Text style={styles.filteredEmptyTitle}>No {activeFilterTitle} notifications</Text>
                  <Text style={styles.filteredEmptyDescription}>
                    We&apos;ll show {filter === "services" ? "service updates" : `${activeFilterLabel} updates`} here when something needs your attention.
                  </Text>
                </View>
              ) : sections.map((section) => (
                <View key={section.label} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                  <View style={styles.listCard}>
                    {section.items.map((item, index) => (
                      <React.Fragment key={item.id}>
                        {index > 0 ? <View style={styles.rowDivider} /> : null}
                        <NotificationRow
                          item={item}
                          timestamp={formatNotificationTimestamp(item.createdAt)}
                          onPress={() => openNotification(item)}
                        />
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: appSpacing.xl,
    backgroundColor: appColors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.divider,
  },
  headerSide: {
    width: 78,
  },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    marginLeft: 1,
    color: appColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  headerTitle: {
    color: appColors.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: appSpacing.xl,
    paddingTop: appSpacing.lg,
    paddingBottom: appSpacing.xxxl,
  },
  content: {
    width: "100%",
    maxWidth: 760,
    flexGrow: 1,
    alignSelf: "center",
  },
  toolbar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: appSpacing.sm,
  },
  inboxSummary: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  markAllButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: appSpacing.xs,
  },
  markAllText: {
    color: appColors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  filterScroll: {
    flexGrow: 0,
    height: 44,
    marginHorizontal: -appSpacing.xs,
    marginBottom: appSpacing.xl,
  },
  filterContent: {
    alignItems: "center",
    columnGap: appSpacing.sm,
    paddingHorizontal: appSpacing.xs,
  },
  filterChip: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    paddingHorizontal: 14,
    borderRadius: appRadii.round,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  filterChipSelected: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  filterChipText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: appColors.surface,
  },
  section: {
    marginBottom: appSpacing.xl,
  },
  sectionTitle: {
    marginBottom: appSpacing.sm,
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  listCard: {
    overflow: "hidden",
    borderRadius: appRadii.card,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
    ...appShadows.surface,
  },
  loadingCard: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70,
    backgroundColor: appColors.divider,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.lg,
    paddingBottom: appSpacing.huge,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: appColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  emptyTitle: {
    marginTop: appSpacing.lg,
    color: appColors.textPrimary,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    maxWidth: 336,
    marginTop: appSpacing.sm,
    color: appColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  filteredEmpty: {
    alignItems: "center",
    paddingHorizontal: appSpacing.xl,
    paddingVertical: appSpacing.display,
    borderRadius: appRadii.card,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  filteredEmptyTitle: {
    marginTop: appSpacing.sm,
    color: appColors.textPrimary,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
  },
  filteredEmptyDescription: {
    maxWidth: 320,
    marginTop: appSpacing.xs,
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  stateCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.xl,
    paddingVertical: appSpacing.display,
    borderRadius: appRadii.card,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: appColors.warningSoft,
  },
  stateTitle: {
    marginTop: appSpacing.md,
    color: appColors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  stateDescription: {
    marginTop: appSpacing.xs,
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: appSpacing.lg,
    paddingHorizontal: appSpacing.xl,
    borderRadius: appRadii.control,
    backgroundColor: appColors.primary,
  },
  retryText: {
    color: appColors.surface,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
