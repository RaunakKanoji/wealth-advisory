import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CoachRecommendation } from "@/types/wealth-coach";

import { coachColors } from "./tokens";

type RecommendationCardProps = {
  recommendation: CoachRecommendation;
  onPress: () => void;
};

export function RecommendationCard({ recommendation, onPress }: RecommendationCardProps) {
  const icon = recommendation.category === "emergency-fund" ? "umbrella-outline" : "trending-up-outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recommendation.title}. ${recommendation.reason}`}
      accessibilityHint="Opens this Wealth Coach recommendation"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.iconContainer}><Ionicons name={icon} size={24} color={coachColors.brandGreen} /></View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.title}>{recommendation.title}</Text>
          <Text numberOfLines={3} style={styles.description}>{recommendation.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={coachColors.iconMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 18, borderRadius: 22, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  row: { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: coachColors.brandGreenSoft },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 13 },
  title: { color: coachColors.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  description: { marginTop: 5, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.78 },
});
