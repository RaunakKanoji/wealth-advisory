import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatIndianCurrencyShort } from "@/lib/currency";
import { clampPercentage } from "@/lib/percentage";
import type { FinancialGoal } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type GoalProgressCardProps = {
  goal: FinancialGoal;
  onPress: () => void;
};

export function GoalProgressCard({ goal, onPress }: GoalProgressCardProps) {
  const progress = clampPercentage(goal.progressPercentage);

  return (
    <InsightCard
      accessibilityLabel={`${goal.name} progress, ${progress}%`}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="target" size={26} color={coachColors.brandGreen} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{goal.name}</Text>
          <Text style={styles.description}>
            You&apos;re {formatIndianCurrencyShort(goal.gapAmount)} away from your goal.
          </Text>
        </View>

      </View>

      <View style={styles.progressRow}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${goal.name} progress`}
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressValue}>{progress}%</Text>
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E6F3EF",
  },
  copy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  title: {
    color: coachColors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  description: {
    marginTop: 4,
    color: "#747E8E",
    fontSize: 14,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    marginTop: 22,
  },
  progressTrack: {
    flex: 1,
    height: 9,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: coachColors.progressTrack,
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: coachColors.brandGreen,
  },
  progressValue: {
    minWidth: 36,
    color: coachColors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "right",
  },
});
