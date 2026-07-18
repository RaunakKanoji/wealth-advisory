import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { accountColors } from "./tokens";

type OpenAccountCardProps = {
  onPress: () => void;
};

export function OpenAccountCard({ onPress }: OpenAccountCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Open a new account</Text>
      <Text style={styles.description}>
        Explore a wide range of{`\n`}accounts that suit your goals.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explore new accounts"
        accessibilityHint="Opens the account product catalogue"
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Explore Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    backgroundColor: "#E5F2EF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D2E7E1",
  },
  title: {
    color: accountColors.brandGreenDark,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
  },
  description: {
    maxWidth: 260,
    marginTop: 12,
    color: accountColors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "400",
  },
  button: {
    height: 48,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: accountColors.brandGreenDark,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
