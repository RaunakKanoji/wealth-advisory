import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatIndianCurrencyWithoutSpace } from "@/lib/currency";
import type { WealthInsight } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type SpendingInsightCardProps = {
  insight: WealthInsight;
  onPress: () => void;
};

function SpendingPercentageRing({ percentage }: { percentage: number }) {
  const segmentCount = 12;
  const activeSegmentCount = Math.round((Math.min(Math.max(percentage, 0), 100) / 100) * segmentCount);
  const center = 29;
  const radius = 24;
  const segmentWidth = 11;

  return (
    <View
      accessible
      accessibilityLabel={`${percentage}% higher than last month`}
      style={styles.ring}
    >
      {Array.from({ length: segmentCount }, (_, index) => {
        const angle = (index / segmentCount) * 360 - 90;
        const radians = (angle * Math.PI) / 180;
        const left = center + radius * Math.cos(radians) - segmentWidth / 2;
        const top = center + radius * Math.sin(radians) - 2.5;

        return (
          <View
            key={`ring-segment-${index}`}
            style={[
              styles.ringSegment,
              {
                left,
                top,
                backgroundColor:
                  index < activeSegmentCount ? coachColors.brandOrange : coachColors.progressTrack,
                transform: [{ rotate: `${angle + 90}deg` }],
              },
            ]}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{percentage}%</Text>
      </View>
    </View>
  );
}

export function SpendingInsightCard({ insight, onPress }: SpendingInsightCardProps) {
  const amount = insight.amount ?? 0;
  const percentage = insight.percentage ?? 0;

  return (
    <InsightCard
      accessibilityLabel="View Food and Dining spending insight"
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={25}
            color={coachColors.brandOrange}
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>
            <Text>You spent </Text>
            <Text style={styles.amount}>{formatIndianCurrencyWithoutSpace(amount)}</Text>
            <Text> more on {insight.title}</Text>
          </Text>
          <Text style={styles.description}>{percentage}% higher than last month</Text>
        </View>

        <SpendingPercentageRing percentage={percentage} />
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: coachColors.brandOrangeSoft,
  },
  copy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  title: {
    color: coachColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  amount: {
    color: coachColors.brandOrange,
    fontWeight: "700",
  },
  description: {
    marginTop: 6,
    color: "#7C8594",
    fontSize: 14,
    lineHeight: 20,
  },
  ring: {
    width: 58,
    height: 58,
    position: "relative",
    flexShrink: 0,
    marginRight: 5,
  },
  ringSegment: {
    width: 11,
    height: 5,
    position: "absolute",
    borderRadius: 3,
  },
  ringCenter: {
    position: "absolute",
    top: 9,
    left: 9,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: coachColors.surface,
  },
  ringValue: {
    color: coachColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
});
