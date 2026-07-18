import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import type { CoachRecommendation } from "@/types/wealth-coach";

import { RecommendationCard } from "./recommendation-card";
import { SectionHeader } from "./section-header";

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
  const renderRecommendation = useCallback(
    ({ item }: { item: CoachRecommendation }) => (
      <RecommendationCard
        recommendation={item}
        onPress={() => onRecommendationPress(item.id)}
      />
    ),
    [onRecommendationPress],
  );

  return (
    <View>
      <SectionHeader
        title="Recommended for You"
        actionLabel="See all"
        accessibilityLabel="View all recommendations"
        onActionPress={onViewAll}
      />
      <FlatList
        horizontal
        data={recommendations.filter((recommendation) => recommendation.isEligible)}
        keyExtractor={(item) => item.id}
        renderItem={renderRecommendation}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 18,
    paddingRight: 6,
    paddingBottom: 6,
  },
});
