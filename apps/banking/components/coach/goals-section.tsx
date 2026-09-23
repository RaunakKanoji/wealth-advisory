import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import type { FinancialGoal } from "@/types/wealth-coach";

import { CoachSectionCard } from "./coach-section-card";
import { GoalProgressCard } from "./goal-progress-card";
import { coachColors } from "./tokens";

type GoalsSectionProps = {
  goals: FinancialGoal[];
  onViewAll: () => void;
  onGoalPress: (goalId: string) => void;
  onCreateGoal?: () => void;
  balanceVisible?: boolean;
  errorMessage?: string;
  isLoading?: boolean;
  onRetry?: () => void;
};

export function GoalsSection({ goals, onViewAll, onGoalPress, onCreateGoal, balanceVisible = true, errorMessage, isLoading = false, onRetry }: GoalsSectionProps) {
  const hasInitialError = Boolean(errorMessage) && goals.length === 0;

  return (
    <CoachSectionCard
      title="Your goals"
      actionLabel="View all"
      accessibilityLabel="View all financial goals"
      onActionPress={onViewAll}
    >
      {isLoading ? <GoalsSectionSkeleton /> : null}
      {!isLoading && errorMessage ? (
        <View style={styles.statusBanner}>
          <StatusBanner
            actionLabel={onRetry ? "Retry" : undefined}
            actionAccessibilityLabel="Retry loading financial goals"
            iconName="refresh-outline"
            message={goals.length > 0 ? "Showing your last available goal information." : errorMessage}
            onAction={onRetry}
            title={goals.length > 0 ? "Couldn’t refresh" : "Goals unavailable"}
            tone="warning"
          />
        </View>
      ) : null}
      {!isLoading && !hasInitialError ? (
        <View style={styles.cards}>
          {goals.slice(0, 2).map((goal) => (
            <GoalProgressCard key={goal.id} goal={goal} balanceVisible={balanceVisible} onPress={() => onGoalPress(goal.id)} />
          ))}
          {goals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Start your first financial goal</Text>
              <Text style={styles.emptyDescription}>Create a savings target and let Wealth Coach help you stay on track.</Text>
              {onCreateGoal ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Create a financial goal" onPress={onCreateGoal} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
                  <Text style={styles.emptyActionText}>Create goal</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </CoachSectionCard>
  );
}

function GoalsSectionSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View accessibilityLabel="Loading financial goals" accessibilityState={{ busy: true }} style={styles.skeletonCards}>
      <Skeleton opacity={opacity} style={styles.skeletonCard} />
      <Skeleton opacity={opacity} style={styles.skeletonCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    marginTop: 14,
  },
  skeletonCards: {
    marginTop: 14,
    rowGap: 12,
  },
  skeletonCard: {
    width: "100%",
    height: 116,
    borderRadius: 16,
  },
  cards: {
    rowGap: 12,
    marginTop: 14,
  },
  emptyState: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
  },
  emptyTitle: {
    color: coachColors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  emptyDescription: {
    marginTop: 3,
    color: coachColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyAction: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  emptyActionText: {
    color: coachColors.brandGreen,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
