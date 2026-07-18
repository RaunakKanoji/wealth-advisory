import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { FinancialMetric } from "@/types/wealth-coach";

import { AskCoachButton } from "./ask-coach-button";
import { FinancialMetricCard } from "./financial-metric-card";
import { coachColors } from "./tokens";

type FinancialSnapshotCardProps = {
  metrics: FinancialMetric[];
  onAskCoach: () => void;
};

export function FinancialSnapshotCard({
  metrics,
  onAskCoach,
}: FinancialSnapshotCardProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;
  const isWide = width >= 600;

  return (
    <View style={[styles.card, isSmall && styles.cardSmall, isWide && styles.cardWide]}>
      <View
        style={[
          styles.metricsRow,
          isSmall && styles.metricsRowSmall,
          isWide && styles.metricsRowWide,
        ]}
      >
        {metrics.map((metric) => (
          <FinancialMetricCard key={metric.id} metric={metric} />
        ))}
      </View>

      <View style={[styles.actionContainer, isWide && styles.actionContainerWide]}>
        <AskCoachButton onPress={onAskCoach} large={isWide} />
        <Text style={[styles.actionCaption, isWide && styles.actionCaptionWide]}>
          Get personalised insights and tips
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderRadius: 26,
    backgroundColor: "#F0F8F6",
    borderWidth: 1,
    borderColor: coachColors.brandGreenBorder,
  },
  cardSmall: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  cardWide: {
    paddingHorizontal: 42,
    paddingTop: 42,
    paddingBottom: 42,
    borderRadius: 32,
    borderColor: "#D3E9E2",
  },
  metricsRow: {
    flexDirection: "row",
    columnGap: 10,
  },
  metricsRowSmall: {
    columnGap: 7,
  },
  metricsRowWide: {
    columnGap: 18,
  },
  actionContainer: {
    marginTop: 24,
  },
  actionContainerWide: {
    marginTop: 42,
  },
  actionCaption: {
    marginTop: 14,
    color: "#768091",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  actionCaptionWide: {
    marginTop: 28,
    fontSize: 21,
    lineHeight: 27,
  },
});
