import React from "react";
import { StyleSheet, View } from "react-native";

import { coachColors } from "./tokens";

export function CoachSkeletons() {
  return (
    <View accessible accessibilityLabel="Loading Wealth Coach insights">
      <View style={styles.snapshot}>
        <View style={styles.metricsRow}>
          <View style={styles.metric} />
          <View style={styles.metric} />
          <View style={styles.metric} />
        </View>
        <View style={styles.action} />
      </View>

      <View style={styles.sectionTitle} />
      <View style={styles.insightCard} />
      <View style={styles.insightCard} />
      <View style={styles.insightCard} />

      <View style={[styles.sectionTitle, styles.recommendationTitle]} />
      <View style={styles.recommendationsRow}>
        <View style={styles.recommendationCard} />
        <View style={styles.recommendationCard} />
        <View style={styles.recommendationCard} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  snapshot: {
    padding: 20,
    borderRadius: 26,
    backgroundColor: coachColors.brandGreenSoft,
    borderWidth: 1,
    borderColor: coachColors.brandGreenBorder,
  },
  metricsRow: {
    flexDirection: "row",
    columnGap: 10,
  },
  metric: {
    flex: 1,
    height: 142,
    borderRadius: 20,
    backgroundColor: coachColors.surface,
  },
  action: {
    height: 58,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: coachColors.divider,
  },
  sectionTitle: {
    width: "48%",
    height: 24,
    marginTop: 30,
    borderRadius: 6,
    backgroundColor: coachColors.divider,
  },
  insightCard: {
    height: 116,
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
  },
  recommendationTitle: {
    marginTop: 30,
  },
  recommendationsRow: {
    flexDirection: "row",
    columnGap: 14,
    marginTop: 18,
  },
  recommendationCard: {
    width: 154,
    height: 182,
    borderRadius: 22,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
  },
});
