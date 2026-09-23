import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";

import { Surface } from "./surface";

export type StateCardProps = {
  actionAccessibilityLabel?: string;
  actionLabel?: string;
  compact?: boolean;
  description: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
};

export function StateCard({
  actionAccessibilityLabel,
  actionLabel,
  compact = false,
  description,
  iconName,
  onAction,
  style,
  title,
}: StateCardProps) {
  return (
    <Surface style={[styles.card, compact && styles.compactCard, style]}>
      {iconName ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.icon}
        >
          <Ionicons name={iconName} size={22} color={appColors.primaryPressed} />
        </View>
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    padding: appSpacing.xxl,
    borderRadius: appRadii.hero,
  },
  compactCard: {
    paddingVertical: appSpacing.xl,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: appSpacing.md,
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  title: {
    color: appColors.textPrimary,
    ...appTypography.cardTitle,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    maxWidth: 330,
    marginTop: appSpacing.sm,
    color: appColors.textSecondary,
    ...appTypography.supporting,
    textAlign: "center",
  },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: appSpacing.lg,
    paddingHorizontal: appSpacing.xl,
    borderRadius: appRadii.control,
    backgroundColor: appColors.primaryPressed,
  },
  actionLabel: {
    color: appColors.surface,
    ...appTypography.button,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
