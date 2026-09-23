import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { IconButton, PageHeader } from "@/components/design-system";
import { appColors, appRadii } from "@/components/theme/tokens";

import { coachColors } from "./tokens";

type CoachPageHeaderProps = {
  onNewConversation?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function CoachPageHeader({
  onNewConversation,
  onRefresh,
  isRefreshing = false,
}: CoachPageHeaderProps) {
  const action = onRefresh ? (
    <IconButton
      accessibilityLabel={isRefreshing ? "Refreshing Wealth Coach" : "Refresh Wealth Coach"}
      busyIconColor={appColors.iconMuted}
      disabled={isRefreshing}
      iconColor={appColors.textSecondary}
      iconName="refresh-outline"
      isBusy={isRefreshing}
      onPress={onRefresh}
      rotateWhenBusy
    />
  ) : onNewConversation ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a new conversation"
      accessibilityHint="Opens a new Wealth Coach conversation"
      onPress={onNewConversation}
      style={({ pressed }) => [styles.newConversationButton, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={17} color={coachColors.brandGreenDark} />
      <Text style={styles.newConversationText}>New chat</Text>
    </Pressable>
  ) : undefined;

  return (
    <PageHeader
      title="Wealth Coach"
      action={action}
    />
  );
}

const styles = StyleSheet.create({
  newConversationButton: {
    minHeight: 44,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: appRadii.control,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.primaryBorder,
  },
  newConversationText: {
    marginLeft: 4,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: appColors.primaryPressed,
  },
  pressed: {
    opacity: 0.72,
  },
});
