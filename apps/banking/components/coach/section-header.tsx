import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { coachColors } from "./tokens";

type SectionHeaderProps = {
  title: string;
  actionLabel: string;
  accessibilityLabel: string;
  onActionPress: () => void;
};

export function SectionHeader({
  title,
  actionLabel,
  accessibilityLabel,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onActionPress}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
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
    color: coachColors.textPrimary,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "700",
  },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 16,
  },
  actionText: {
    color: coachColors.brandGreen,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.65,
  },
});
