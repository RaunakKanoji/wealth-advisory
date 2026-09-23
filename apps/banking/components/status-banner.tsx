import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";

type StatusBannerTone = "info" | "warning" | "danger";

type StatusBannerProps = {
  message: string;
  title?: string;
  size?: "default" | "prominent";
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  tone?: StatusBannerTone;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionAccessibilityLabel?: string;
  onSecondaryAction?: () => void;
};

const toneStyles = {
  info: {
    backgroundColor: appColors.primarySoft,
    borderColor: appColors.primaryBorder,
    iconBackgroundColor: appColors.surface,
    iconColor: appColors.primaryPressed,
    actionColor: appColors.primaryPressed,
  },
  warning: {
    backgroundColor: appColors.warningSoft,
    borderColor: "#F1D9AD",
    iconBackgroundColor: appColors.surface,
    iconColor: appColors.orangeText,
    actionColor: appColors.orangeText,
  },
  danger: {
    backgroundColor: appColors.dangerSoft,
    borderColor: "#F0C8CB",
    iconBackgroundColor: appColors.surface,
    iconColor: appColors.danger,
    actionColor: appColors.danger,
  },
} as const;

export function StatusBanner({
  message,
  title,
  size = "default",
  iconName = "information-circle-outline",
  tone = "info",
  actionLabel,
  actionAccessibilityLabel,
  onAction,
  secondaryActionLabel,
  secondaryActionAccessibilityLabel,
  onSecondaryAction,
}: StatusBannerProps) {
  const colors = toneStyles[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        size === "prominent" && styles.prominentContainer,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}
    >
      <View style={[styles.icon, size === "prominent" && styles.prominentIcon, { backgroundColor: colors.iconBackgroundColor }]}>
        <Ionicons name={iconName} size={size === "prominent" ? 22 : 18} color={colors.iconColor} />
      </View>

      <View style={[styles.copy, size === "prominent" && styles.prominentCopy]}>
        {title ? <Text style={[styles.title, size === "prominent" && styles.prominentTitle]}>{title}</Text> : null}
        <Text style={[styles.message, size === "prominent" && styles.prominentMessage]}>{message}</Text>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.action, size === "prominent" && styles.prominentAction, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, size === "prominent" && styles.prominentActionText, { color: colors.actionColor }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryActionAccessibilityLabel ?? secondaryActionLabel}
          onPress={onSecondaryAction}
          style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: appSpacing.md,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: appRadii.medium,
  },
  prominentContainer: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
  },
  prominentIcon: {
    width: 48,
    height: 48,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: appSpacing.sm,
  },
  prominentCopy: {
    marginHorizontal: 12,
  },
  title: {
    color: appColors.textPrimary,
    ...appTypography.supporting,
    fontWeight: "700",
  },
  prominentTitle: {
    ...appTypography.body,
  },
  message: {
    color: appColors.textBody,
    ...appTypography.supporting,
  },
  prominentMessage: {
    ...appTypography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  prominentAction: {
    minWidth: 56,
    paddingHorizontal: 8,
  },
  actionText: {
    color: appColors.primaryPressed,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  prominentActionText: {
    fontSize: 16,
    lineHeight: 22,
  },
  secondaryAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: appSpacing.sm,
    paddingHorizontal: 4,
  },
  secondaryActionText: {
    color: appColors.textSecondary,
    ...appTypography.metadata,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.68,
  },
});
