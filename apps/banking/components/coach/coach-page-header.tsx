import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { coachColors } from "./tokens";

type CoachPageHeaderProps = {
  isLoading?: boolean;
  showSubtitle?: boolean;
  onNewConversation: () => void;
};

export function CoachPageHeader({
  isLoading = false,
  showSubtitle = true,
  onNewConversation,
}: CoachPageHeaderProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {isLoading ? (
          <View style={[styles.titleSkeleton, isSmall && styles.titleSkeletonSmall]} />
        ) : (
          <Text
            accessibilityRole="header"
            style={[styles.title, isSmall && styles.titleSmall]}
          >
            Wealth Coach
          </Text>
        )}

        {isLoading ? (
          <View style={styles.buttonSkeleton} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new Wealth Coach conversation"
            accessibilityHint="Opens a new coach conversation"
            hitSlop={6}
            onPress={onNewConversation}
            style={({ pressed }) => [styles.newConversationButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={29} color="#4B5563" />
          </Pressable>
        )}
      </View>

      {showSubtitle ? (
        isLoading ? (
          <View style={styles.subtitleSkeleton} />
        ) : (
          <Text style={styles.subtitle}>Personalised guidance for your finances</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    color: coachColors.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
  },
  titleSmall: {
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 5,
    color: coachColors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  newConversationButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    borderRadius: 15,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4E7EB",
    shadowColor: coachColors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 3,
  },
  pressed: {
    opacity: 0.72,
  },
  titleSkeleton: {
    width: 190,
    height: 34,
    borderRadius: 8,
    backgroundColor: coachColors.divider,
  },
  titleSkeletonSmall: {
    width: 166,
    height: 30,
  },
  subtitleSkeleton: {
    width: "82%",
    height: 18,
    marginTop: 10,
    borderRadius: 6,
    backgroundColor: coachColors.divider,
  },
  buttonSkeleton: {
    width: 48,
    height: 48,
    marginLeft: 12,
    borderRadius: 15,
    backgroundColor: coachColors.divider,
  },
});
