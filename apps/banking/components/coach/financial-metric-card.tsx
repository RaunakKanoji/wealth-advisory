import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { formatIndianCurrencyWithoutSpace } from "@/lib/currency";
import type { FinancialMetric } from "@/types/wealth-coach";

import { coachColors } from "./tokens";

type FinancialMetricCardProps = {
  metric: FinancialMetric;
};

function renderMetricIcon(metric: FinancialMetric, isWide: boolean) {
  if (metric.icon === "piggy-bank") {
    return (
      <MaterialCommunityIcons
        name="piggy-bank"
        size={isWide ? 31 : 22}
        color={coachColors.brandGreen}
      />
    );
  }

  if (metric.icon === "target") {
    return (
      <MaterialCommunityIcons
        name="target"
        size={isWide ? 33 : 23}
        color={coachColors.brandGreen}
      />
    );
  }

  return (
    <Ionicons name="trending-up" size={isWide ? 31 : 22} color={coachColors.brandGreen} />
  );
}

function formatMetricValue(metric: FinancialMetric): string {
  if (metric.format === "percentage") {
    return `${metric.value}%`;
  }

  if (metric.format === "currency") {
    return formatIndianCurrencyWithoutSpace(metric.value);
  }

  return `${metric.value}`;
}

export function FinancialMetricCard({ metric }: FinancialMetricCardProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;
  const isWide = width >= 600;
  const valueColor = metric.trend === "negative" ? coachColors.brandOrange : coachColors.brandGreen;

  return (
    <View
      accessible
      accessibilityLabel={`${metric.label}, ${formatMetricValue(metric)}, ${metric.supportingLabel}`}
      style={[styles.metricCard, isSmall && styles.metricCardSmall, isWide && styles.metricCardWide]}
    >
      <View
        style={[
          styles.iconContainer,
          isSmall && styles.iconContainerSmall,
          isWide && styles.iconContainerWide,
        ]}
      >
        {renderMetricIcon(metric, isWide)}
      </View>
      <Text style={[styles.label, isWide && styles.labelWide]} numberOfLines={2}>
        {metric.label}
      </Text>
      <Text
        style={[
          styles.value,
          isSmall && styles.valueSmall,
          isWide && styles.valueWide,
          { color: valueColor },
        ]}
      >
        {formatMetricValue(metric)}
      </Text>
      <Text style={[styles.supportingLabel, isWide && styles.supportingLabelWide]} numberOfLines={2}>
        {metric.supportingLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    minHeight: 142,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.divider,
    shadowColor: coachColors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metricCardSmall: {
    paddingHorizontal: 7,
    paddingVertical: 13,
  },
  metricCardWide: {
    minHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 26,
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: coachColors.brandGreenSoft,
  },
  iconContainerSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  iconContainerWide: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  label: {
    minHeight: 18,
    marginTop: 12,
    color: coachColors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  labelWide: {
    minHeight: 23,
    marginTop: 20,
    fontSize: 18,
    lineHeight: 23,
  },
  value: {
    marginTop: 2,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "700",
  },
  valueSmall: {
    fontSize: 23,
    lineHeight: 28,
  },
  valueWide: {
    marginTop: 4,
    fontSize: 37,
    lineHeight: 45,
  },
  supportingLabel: {
    marginTop: 1,
    color: coachColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  supportingLabelWide: {
    fontSize: 16,
    lineHeight: 20,
  },
});
