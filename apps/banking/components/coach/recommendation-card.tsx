import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CoachRecommendation } from "@/types/wealth-coach";

import { coachColors } from "./tokens";

type RecommendationCardProps = {
  recommendation: CoachRecommendation;
  onPress: () => void;
};

function RecommendationIcon({ category }: { category: CoachRecommendation["category"] }) {
  if (category === "investment") {
    return <Ionicons name="trending-up-outline" size={25} color={coachColors.brandGreen} />;
  }

  if (category === "insurance") {
    return (
      <MaterialCommunityIcons
        name="shield-outline"
        size={26}
        color={coachColors.brandGreen}
      />
    );
  }

  if (category === "emergency-fund") {
    return (
      <MaterialCommunityIcons name="umbrella-outline" size={26} color={coachColors.brandGreen} />
    );
  }

  if (category === "retirement") {
    return <MaterialCommunityIcons name="target" size={26} color={coachColors.brandGreen} />;
  }

  return <MaterialCommunityIcons name="calculator-variant-outline" size={26} color={coachColors.brandGreen} />;
}

export function RecommendationCard({ recommendation, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        recommendation.category === "insurance"
          ? "Explore Health Insurance"
          : recommendation.category === "emergency-fund"
            ? "Build an Emergency Fund"
            : recommendation.title
      }
      accessibilityHint="Opens this Wealth Coach recommendation"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconContainer}>
        <RecommendationIcon category={recommendation.category} />
      </View>
      <Text style={styles.title} numberOfLines={3}>
        {recommendation.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 154,
    minHeight: 182,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginRight: 14,
    borderRadius: 22,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
    shadowColor: coachColors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#E6F3EF",
  },
  title: {
    flex: 1,
    marginTop: 18,
    color: coachColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
