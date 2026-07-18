import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { coachColors } from "./tokens";

type AskCoachButtonProps = {
  onPress: () => void;
  compact?: boolean;
  large?: boolean;
};

export function AskCoachButton({ onPress, compact = false, large = false }: AskCoachButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask Wealth Coach"
      accessibilityHint="Opens a conversation with Wealth Coach"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        large && styles.buttonLarge,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="sparkles" size={large ? 35 : 25} color={coachColors.surface} />
      <Text style={[styles.text, compact && styles.textCompact, large && styles.textLarge]}>
        Ask Coach
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 10,
    borderRadius: 16,
    backgroundColor: coachColors.brandGreenDark,
  },
  buttonCompact: {
    paddingHorizontal: 24,
  },
  buttonLarge: {
    minHeight: 104,
    borderRadius: 18,
    columnGap: 13,
  },
  text: {
    color: coachColors.surface,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
  },
  textCompact: {
    fontSize: 17,
  },
  textLarge: {
    fontSize: 30,
    lineHeight: 38,
  },
  pressed: {
    opacity: 0.82,
  },
});
