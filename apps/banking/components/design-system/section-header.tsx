import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { appColors, appSpacing, appTypography } from "@/components/theme/tokens";

export type SectionHeaderProps = {
  accessibilityLabel?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
};

export function SectionHeader({
  accessibilityLabel,
  action,
  actionLabel,
  onActionPress,
  style,
  title,
  titleStyle,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text accessibilityRole="header" style={[styles.title, titleStyle]}>
        {title}
      </Text>

      {action ??
        (actionLabel && onActionPress ? (
          <Pressable
            accessibilityLabel={accessibilityLabel ?? actionLabel}
            accessibilityRole="button"
            onPress={onActionPress}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    color: appColors.textPrimary,
    ...appTypography.sectionTitle,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: appSpacing.lg,
  },
  actionText: {
    color: appColors.primary,
    ...appTypography.supporting,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.65,
  },
});
