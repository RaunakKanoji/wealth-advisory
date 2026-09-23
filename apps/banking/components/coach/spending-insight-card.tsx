import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatINR } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { WealthInsight } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type SpendingInsightCardProps = {
  insight: WealthInsight;
  onPress: () => void;
  onAskCoach?: () => void;
  balanceVisible?: boolean;
};

export function SpendingInsightCard({ insight, onPress, balanceVisible = true }: SpendingInsightCardProps) {
  const difference = finiteNumber(insight.differenceAmount);
  const comparison = finiteNumber(insight.comparison) ?? finiteNumber(insight.percentage);
  const isDecrease = (difference ?? comparison ?? 0) < 0;
  const isIncrease = (difference ?? comparison ?? 0) > 0;
  const accent = isDecrease ? coachColors.brandGreen : coachColors.brandOrange;
  const title = balanceVisible ? insight.title : privacySafeFinancialText(insight.title, "Spending insight");
  const fallbackDescription = insight.summary?.trim() || insight.description;
  const description = balanceVisible
    ? difference === undefined
      ? fallbackDescription
      : comparison === undefined
        ? "Compared with the previous month"
        : `${formatPercentage(Math.abs(comparison))} ${isIncrease ? "higher" : isDecrease ? "lower" : "unchanged"} than ${insight.comparisonPeriod ?? "last month"}.`
    : "This spending insight is based on your latest posted transactions.";
  const category = balanceVisible ? insight.category ?? "this category" : "this category";

  return (
    <InsightCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${title} spending insight`}
        accessibilityHint="Opens spending details and the Coach evidence"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.row}>
          <View style={[styles.iconContainer, isDecrease && styles.iconContainerPositive]}>
            <Ionicons name="restaurant-outline" size={27} color={accent} />
          </View>
          <View style={styles.copy}>
            {balanceVisible && difference !== undefined ? (
              <Text style={styles.title}>
                You spent <Text style={{ color: accent }}>{formatINR(Math.abs(difference))} {isIncrease ? "more" : isDecrease ? "less" : "the same"}</Text>
                {" on "}{category}
              </Text>
            ) : (
              <Text style={styles.title}>{title}</Text>
            )}
            <Text style={styles.description}>{description}</Text>
          </View>
          {balanceVisible && comparison !== undefined ? <ComparisonRing accent={accent} percentage={Math.abs(comparison)} /> : null}
        </View>
      </Pressable>
    </InsightCard>
  );
}

function ComparisonRing({ accent, percentage }: { accent: string; percentage: number }) {
  const clamped = Math.min(Math.max(Math.round(percentage), 0), 100);
  const rotation = `${Math.min(clamped, 75) * 4.8 - 180}deg`;
  return (
    <View accessibilityLabel={`${clamped}% change`} style={styles.ring}>
      <View style={styles.ringTrack} />
      <View style={[styles.ringAccent, { borderTopColor: accent, borderRightColor: accent, transform: [{ rotate: rotation }] }]} />
      <Text style={styles.ringText}>{clamped}%</Text>
    </View>
  );
}

function finiteNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

const styles = StyleSheet.create({
  main: { borderRadius: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  iconContainer: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: coachColors.brandOrangeSoft,
  },
  iconContainerPositive: { backgroundColor: coachColors.brandGreenSoft },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  title: { color: coachColors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  description: { marginTop: 7, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  ring: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 32,
    borderColor: coachColors.progressTrack,
    borderStyle: "dashed",
  },
  ringAccent: {
    position: "absolute",
    width: 56,
    height: 56,
    borderWidth: 3,
    borderRadius: 28,
    borderColor: "transparent",
  },
  ringText: { color: coachColors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  pressed: { opacity: 0.78 },
});
