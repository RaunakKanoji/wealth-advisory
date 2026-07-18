import React from "react";
import { StyleSheet, View } from "react-native";

import type { FinancialGoal, WealthInsight } from "@/types/wealth-coach";

import { GoalProgressCard } from "./goal-progress-card";
import { SectionHeader } from "./section-header";
import { SipInsightCard } from "./sip-insight-card";
import { SpendingInsightCard } from "./spending-insight-card";

type InsightsSectionProps = {
  insights: WealthInsight[];
  retirementGoal?: FinancialGoal;
  onViewAll: () => void;
  onInsightPress: (insightId: string) => void;
  onGoalPress: (goalId: string) => void;
};

export function InsightsSection({
  insights,
  retirementGoal,
  onViewAll,
  onInsightPress,
  onGoalPress,
}: InsightsSectionProps) {
  const spendingInsight = insights.find((insight) => insight.type === "spending");
  const sipInsight = insights.find((insight) => insight.type === "investment");

  return (
    <View>
      <SectionHeader
        title="Insights for You"
        actionLabel="View all"
        accessibilityLabel="View all financial insights"
        onActionPress={onViewAll}
      />

      <View style={styles.cards}>
        {spendingInsight ? (
          <SpendingInsightCard
            insight={spendingInsight}
            onPress={() => onInsightPress(spendingInsight.id)}
          />
        ) : null}
        {sipInsight ? (
          <SipInsightCard
            insight={sipInsight}
            onPress={() => onInsightPress(sipInsight.id)}
          />
        ) : null}
        {retirementGoal ? (
          <GoalProgressCard
            goal={retirementGoal}
            onPress={() => onGoalPress(retirementGoal.id)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: {
    rowGap: 14,
    marginTop: 18,
  },
});
