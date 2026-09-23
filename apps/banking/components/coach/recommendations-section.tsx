import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CoachRecommendation } from "@/types/wealth-coach";

import { CoachSectionCard } from "./coach-section-card";
import { RecommendationCard } from "./recommendation-card";
import { coachColors } from "./tokens";

type RecommendationsSectionProps = {
  recommendations: CoachRecommendation[];
  onViewAll: () => void;
  onRecommendationPress: (recommendationId: string) => void;
};

export function RecommendationsSection({
  recommendations,
  onViewAll,
  onRecommendationPress,
}: RecommendationsSectionProps) {
  const eligibleRecommendations = useMemo(
    () => recommendations
      .filter((recommendation) => recommendation.isEligible)
      .sort((left, right) => left.priority - right.priority),
    [recommendations],
  );

  return (
    <CoachSectionCard
        title="Recommended for you"
        titleStyle={styles.sectionTitle}
        actionLabel="See all"
        accessibilityLabel="View all recommendations"
        onActionPress={onViewAll}
    >
      {eligibleRecommendations.length > 0 ? eligibleRecommendations.slice(0, 1).map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          onPress={() => onRecommendationPress(recommendation.id)}
        />
      )) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No recommendations right now</Text>
          <Text style={styles.emptyDescription}>Your Coach will surface a next step when your financial context supports it.</Text>
        </View>
      )}
    </CoachSectionCard>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: coachColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700",
  },
  emptyTitle: {
    color: coachColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyDescription: {
    marginTop: 4,
    color: coachColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
