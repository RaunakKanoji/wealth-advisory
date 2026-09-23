import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { appColors } from "@/components/theme/tokens";
import type { NotificationItem, NotificationSeverity, NotificationType } from "@/types/notifications";

type NotificationRowProps = {
  item: NotificationItem;
  timestamp: string;
  onPress: () => void;
};

const iconByType: Record<NotificationType, React.ComponentProps<typeof Ionicons>["name"]> = {
  transaction: "swap-horizontal-outline",
  security: "shield-checkmark-outline",
  account: "business-outline",
  card: "card-outline",
  coach: "sparkles-outline",
  service: "document-text-outline",
};

const severityStyles: Record<NotificationSeverity, { backgroundColor: string; iconColor: string }> = {
  info: { backgroundColor: appColors.primarySoft, iconColor: appColors.primary },
  success: { backgroundColor: appColors.successSoft, iconColor: appColors.success },
  attention: { backgroundColor: appColors.warningSoft, iconColor: appColors.warning },
  critical: { backgroundColor: appColors.dangerSoft, iconColor: appColors.danger },
};

export function NotificationRow({ item, timestamp, onPress }: NotificationRowProps) {
  const iconStyle = severityStyles[item.severity ?? "info"];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.message}. ${timestamp}`}
      accessibilityHint="Opens notification details"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !item.read && styles.unreadRow, pressed && styles.pressed]}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconStyle.backgroundColor }]}>
        <Ionicons name={iconByType[item.type]} size={21} color={iconStyle.iconColor} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={styles.message}>
          {item.message}
        </Text>
        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>
      <View style={styles.trailing}>
        {!item.read ? <View style={styles.unreadDot} /> : null}
        <Ionicons name="chevron-forward" size={17} color={appColors.iconMuted} />
      </View>
    </Pressable>
  );
}

export function NotificationSkeleton() {
  return (
    <View style={styles.row} accessibilityLabel="Loading notification">
      <View style={[styles.iconContainer, styles.skeletonIcon]} />
      <View style={styles.copy}>
        <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonMessage]} />
        <View style={[styles.skeletonBlock, styles.skeletonTimestamp]} />
      </View>
      <View style={styles.skeletonChevron} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: appColors.surface,
  },
  unreadRow: {
    backgroundColor: "#F9FCFB",
  },
  pressed: {
    opacity: 0.72,
  },
  iconContainer: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  unreadTitle: {
    fontWeight: "700",
  },
  message: {
    marginTop: 2,
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  timestamp: {
    marginTop: 3,
    color: appColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  trailing: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: appColors.primary,
  },
  skeletonIcon: {
    backgroundColor: appColors.surfaceMuted,
  },
  skeletonBlock: {
    borderRadius: 5,
    backgroundColor: appColors.surfaceMuted,
  },
  skeletonTitle: {
    width: "62%",
    height: 15,
  },
  skeletonMessage: {
    width: "94%",
    height: 12,
    marginTop: 9,
  },
  skeletonTimestamp: {
    width: "28%",
    height: 10,
    marginTop: 8,
  },
  skeletonChevron: {
    width: 9,
    height: 14,
    marginTop: 15,
    borderRadius: 4,
    backgroundColor: appColors.surfaceMuted,
  },
});
