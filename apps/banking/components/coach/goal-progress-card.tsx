import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/design-system";
import { formatCompactIndianCurrency } from "@/lib/currency";
import { clampPercentage } from "@/lib/percentage";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { FinancialGoal } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type GoalProgressCardProps = {
  goal: FinancialGoal;
  onPress: () => void;
  balanceVisible?: boolean;
};

export function GoalProgressCard({ goal, onPress, balanceVisible = true }: GoalProgressCardProps) {
  const progress = clampPercentage(Number.isFinite(goal.progressPercentage) ? Math.round(goal.progressPercentage) : 0);
  const goalName = balanceVisible ? goal.name : privacySafeFinancialText(goal.name, "Financial goal");
  const remainingAmount = Math.max(Number.isFinite(goal.gapAmount) ? goal.gapAmount : goal.targetAmount - goal.currentAmount, 0);

  return (
    <InsightCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={balanceVisible ? `${goalName} progress, ${progress}%` : `${goalName}, financial values hidden`}
        accessibilityHint="Opens this financial goal"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.headingRow}>
          <View style={styles.iconContainer}><Ionicons name="flag-outline" size={27} color={coachColors.brandGreen} /></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{goalName}</Text>
            <Text style={styles.description}>
              {balanceVisible
                ? remainingAmount > 0 ? `${formatCompactIndianCurrency(remainingAmount)} remaining` : "Goal reached"
                : "Open your goal to review your progress."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={coachColors.iconMuted} />
        </View>

        {balanceVisible ? (
          <View style={styles.progressRow}>
            <ProgressBar
              accessibilityLabel={`${goalName} progress`}
              accessibilityValueText={`${progress}% complete`}
              value={progress}
              style={styles.progressTrack}
            />
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
        ) : null}
      </Pressable>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  main: { borderRadius: 16 },
  headingRow: { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, backgroundColor: coachColors.brandGreenSoft },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  title: { color: coachColors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "700" },
  description: { marginTop: 6, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  progressTrack: { flex: 1, height: 9, backgroundColor: coachColors.progressTrack },
  progressValue: { width: 48, marginLeft: 12, color: coachColors.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: "700", textAlign: "right" },
  pressed: { opacity: 0.78 },
});
