import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

import { moreCardShadow, moreColors } from "./tokens";

type MoreDestinationScreenProps = {
  title: string;
  description: string;
};

export function MoreDestinationScreen({
  title,
  description,
}: MoreDestinationScreenProps) {
  const router = useRouter();

  return (
    <ScreenContainer scroll edges={["top", "bottom"]} backgroundColor={moreColors.background}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={moreColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.status}>This secure banking service is ready for your next step.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to More Actions"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>Back to More Actions</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  backText: {
    marginLeft: 4,
    color: moreColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    marginTop: 24,
    padding: 24,
    borderRadius: 24,
    backgroundColor: moreColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: moreColors.border,
    ...moreCardShadow,
  },
  title: {
    color: moreColors.textPrimary,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
  },
  description: {
    marginTop: 10,
    color: moreColors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  status: {
    marginTop: 18,
    color: moreColors.brandGreenDark,
    fontSize: 14,
    lineHeight: 21,
  },
  actionButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: moreColors.brandGreen,
  },
  actionText: {
    color: moreColors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
