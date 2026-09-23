import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { CoachRecommendation, FinancialGoal, WealthInsight, WealthInsightType } from "@/types/wealth-coach";

import { CoachSectionCard } from "./coach-section-card";
import { GoalProgressCard } from "./goal-progress-card";
import { InsightCard } from "./insight-card";
import { RecommendationInsightCard } from "./recommendation-insight-card";
import { SipInsightCard } from "./sip-insight-card";
import { SpendingInsightCard } from "./spending-insight-card";
import { coachColors } from "./tokens";

type InsightsSectionProps = {
  insights: WealthInsight[];
  goals?: FinancialGoal[];
  recommendations?: CoachRecommendation[];
  onViewAll: () => void;
  onInsightPress: (insightId: string) => void;
  onRecommendationPress?: (recommendationId: string) => void;
  onGoalPress?: (goalId: string) => void;
  onAskCoach: (question: string) => void;
  balanceVisible?: boolean;
  errorMessage?: string;
  isLoading?: boolean;
  onRetry?: () => void;
};

const priority: Record<WealthInsightType, number> = {
  "cash-flow": 0, spending: 1, savings: 2, goal: 3, investment: 4,
  "emergency-fund": 4, bills: 5, subscriptions: 6, debt: 7, protection: 8,
};

export function InsightsSection({
  insights,
  goals = [],
  recommendations = [],
  onViewAll,
  onInsightPress,
  onRecommendationPress,
  onGoalPress,
  errorMessage,
  isLoading = false,
  onRetry,
  balanceVisible = true,
}: InsightsSectionProps) {
  const hasInitialError = Boolean(errorMessage) && insights.length === 0;
  const orderedInsights = [...insights].sort((left, right) => {
    const severityOrder = { attention: 0, neutral: 1, positive: 2 } as const;
    return (severityOrder[left.severity] - severityOrder[right.severity]) || (priority[left.type] - priority[right.type]);
  });
  const recommendation = recommendations.find((item) => item.isEligible);
  const goalInsight = orderedInsights.find((item) => item.type === "goal" || item.type === "emergency-fund");
  const goalId = typeof goalInsight?.source?.goalId === "string" ? goalInsight.source.goalId : undefined;
  const goal = goals.find((item) => item.id === goalId) ?? goals[0];
  const usedInsightIds = new Set<string>();
  const cards: React.ReactNode[] = [];

  const spending = orderedInsights.find((item) => item.type === "spending");
  if (spending) {
    usedInsightIds.add(spending.id);
    cards.push(<SpendingInsightCard key={spending.id} insight={spending} balanceVisible={balanceVisible} onPress={() => onInsightPress(spending.id)} />);
  }

  if (recommendation) {
    cards.push(
      <RecommendationInsightCard
        key={`recommendation-${recommendation.id}`}
        balanceVisible={balanceVisible}
        onPress={() => {
          if (onRecommendationPress) onRecommendationPress(recommendation.id);
          else onInsightPress(recommendation.id);
        }}
        recommendation={recommendation}
      />,
    );
  } else {
    const investment = orderedInsights.find((item) => item.type === "investment");
    if (investment) {
      usedInsightIds.add(investment.id);
      cards.push(<SipInsightCard key={investment.id} insight={investment} balanceVisible={balanceVisible} onPress={() => onInsightPress(investment.id)} />);
    }
  }

  if (goal) {
    if (goalInsight) usedInsightIds.add(goalInsight.id);
    cards.push(
      <GoalProgressCard
        key={`goal-${goal.id}`}
        balanceVisible={balanceVisible}
        goal={goal}
        onPress={() => {
          if (onGoalPress) onGoalPress(goal.id);
          else onInsightPress(goalInsight?.id ?? goal.id);
        }}
      />,
    );
  } else if (goalInsight) {
    usedInsightIds.add(goalInsight.id);
    cards.push(<CompactInsightFallback key={goalInsight.id} insight={goalInsight} balanceVisible={balanceVisible} onPress={() => onInsightPress(goalInsight.id)} />);
  }

  for (const insight of orderedInsights) {
    if (cards.length >= 3 || usedInsightIds.has(insight.id)) continue;
    cards.push(<CompactInsightFallback key={insight.id} insight={insight} balanceVisible={balanceVisible} onPress={() => onInsightPress(insight.id)} />);
    usedInsightIds.add(insight.id);
  }

  return (
    <CoachSectionCard title="Insights for you" titleStyle={styles.sectionTitle} actionLabel="View all" accessibilityLabel="View all financial insights" onActionPress={onViewAll}>
      {isLoading ? <InsightsSectionSkeleton /> : null}
      {!isLoading && errorMessage ? (
        <View style={styles.statusBanner}>
          <StatusBanner
            actionLabel={onRetry ? "Retry" : undefined}
            actionAccessibilityLabel="Retry loading financial insights"
            iconName="refresh-outline"
            message={insights.length > 0 ? "Showing your last available insights." : errorMessage}
            onAction={onRetry}
            title={insights.length > 0 ? "Couldn’t refresh" : "Insights unavailable"}
            tone="warning"
          />
        </View>
      ) : null}
      {!isLoading && !hasInitialError ? (
        <View style={styles.cards}>
          {cards}
          {cards.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Ionicons name="sparkles-outline" size={21} color={coachColors.brandGreen} /></View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>Your insights are being prepared</Text>
                <Text style={styles.emptyDescription}>As more activity becomes available, we’ll identify patterns and opportunities for you.</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </CoachSectionCard>
  );
}

function InsightsSectionSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View accessibilityLabel="Loading financial insights" accessibilityState={{ busy: true }} style={styles.skeletonCards}>
      {["one", "two", "three"].map((key) => (
        <View key={key} style={styles.skeletonShell}>
          <Skeleton opacity={opacity} style={styles.skeletonIcon} />
          <View style={styles.skeletonCopy}><Skeleton opacity={opacity} style={styles.skeletonTitle} /><Skeleton opacity={opacity} style={styles.skeletonLine} /></View>
          <Skeleton opacity={opacity} style={styles.skeletonMetric} />
        </View>
      ))}
    </View>
  );
}

function CompactInsightFallback({ insight, onPress, balanceVisible }: { insight: WealthInsight; onPress: () => void; balanceVisible: boolean }) {
  const title = balanceVisible ? insight.title : privacySafeFinancialText(insight.title, "Financial insight");
  const description = balanceVisible
    ? insight.summary?.trim() || insight.description
    : insight.type === "spending"
      ? "This spending insight is based on your latest posted transactions."
      : insight.type === "investment"
        ? "This investment insight is based on the financial context currently available."
        : "This insight is based on your latest available account activity.";
  const icon = insight.type === "goal" || insight.type === "emergency-fund" ? "flag-outline" : "analytics-outline";

  return (
    <InsightCard>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${title} insight`} onPress={onPress} style={({ pressed }) => [styles.fallbackRow, pressed && styles.pressed]}>
        <View style={styles.fallbackIcon}><Ionicons name={icon} size={25} color={coachColors.brandGreen} /></View>
        <View style={styles.fallbackCopy}><Text style={styles.fallbackTitle}>{title}</Text><Text style={styles.fallbackDescription}>{description}</Text></View>
        <Ionicons name="chevron-forward" size={21} color={coachColors.iconMuted} />
      </Pressable>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
  statusBanner: { marginTop: 10 },
  cards: { rowGap: 14, marginTop: 18 },
  skeletonCards: { rowGap: 12, marginTop: 14 },
  skeletonShell: { minHeight: 124, flexDirection: "row", alignItems: "center", padding: 20, borderRadius: 24, backgroundColor: coachColors.surface },
  skeletonIcon: { width: 60, height: 60, borderRadius: 30 },
  skeletonCopy: { flex: 1, marginHorizontal: 14 },
  skeletonTitle: { width: "90%", height: 20, borderRadius: 6 },
  skeletonLine: { width: "65%", height: 14, marginTop: 10, borderRadius: 6 },
  skeletonMetric: { width: 56, height: 56, borderRadius: 28 },
  fallbackRow: { flexDirection: "row", alignItems: "center" },
  fallbackIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, backgroundColor: coachColors.brandGreenSoft },
  fallbackCopy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  fallbackTitle: { color: coachColors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  fallbackDescription: { marginTop: 6, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.78 },
  emptyCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  emptyIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: coachColors.brandGreenSoft },
  emptyCopy: { flex: 1, marginLeft: 12 },
  emptyTitle: { color: coachColors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  emptyDescription: { marginTop: 3, color: coachColors.textSecondary, fontSize: 13, lineHeight: 18 },
});
