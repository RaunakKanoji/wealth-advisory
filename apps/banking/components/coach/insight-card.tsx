import React, { type PropsWithChildren } from "react";
import { Pressable, StyleSheet } from "react-native";

import { coachColors } from "./tokens";

type InsightCardProps = PropsWithChildren<{
  accessibilityLabel: string;
  onPress: () => void;
}>;

export function InsightCard({ children, accessibilityLabel, onPress }: InsightCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens this Wealth Coach insight"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 22,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
    shadowColor: coachColors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
