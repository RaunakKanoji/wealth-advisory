import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatINR } from "@/lib/currency";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { CoachRecommendation } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type RecommendationInsightCardProps = {
  recommendation: CoachRecommendation;
  onPress: () => void;
  balanceVisible?: boolean;
};

export function RecommendationInsightCard({ recommendation, onPress, balanceVisible = true }: RecommendationInsightCardProps) {
  const title = balanceVisible ? recommendation.title : privacySafeFinancialText(recommendation.title, "A recommendation for your goals");
  const description = balanceVisible
    ? recommendation.description
    : "Your Wealth Coach has a next step based on your available financial context.";
  const icon = recommendation.category === "emergency-fund" ? "umbrella-outline" : "trending-up-outline";

  return (
    <InsightCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        accessibilityHint="Opens this Wealth Coach recommendation"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={27} color={coachColors.brandGreen} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {balanceVisible && recommendation.amount !== undefined && !title.includes(formatINR(recommendation.amount)) ? <Text style={styles.amount}>{formatINR(recommendation.amount)}</Text> : null}
          <Text style={styles.description}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={21} color={coachColors.iconMuted} />
      </Pressable>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: 16 },
  iconContainer: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: coachColors.brandGreenSoft,
  },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  title: { color: coachColors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "700" },
  amount: { marginTop: 2, color: coachColors.brandGreen, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  description: { marginTop: 6, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.78 },
});
