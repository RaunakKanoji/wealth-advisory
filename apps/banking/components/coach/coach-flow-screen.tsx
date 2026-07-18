import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

import { coachColors } from "./tokens";

type CoachFlowScreenProps = {
  title: string;
  description: string;
};

export function CoachFlowScreen({ title, description }: CoachFlowScreenProps) {
  const router = useRouter();

  return (
    <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Wealth Coach"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={coachColors.brandGreen} />
          <Text style={styles.backText}>Back to Coach</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="sparkles-outline" size={28} color={coachColors.brandGreen} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: {
    marginLeft: 2,
    color: coachColors.brandGreen,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    alignItems: "center",
    marginTop: 28,
    padding: 28,
    borderRadius: 26,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
    shadowColor: coachColors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  iconContainer: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: coachColors.brandGreenSoft,
  },
  title: {
    marginTop: 20,
    color: coachColors.textPrimary,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    marginTop: 10,
    color: coachColors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
