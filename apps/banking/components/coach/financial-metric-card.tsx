import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatINR } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import type { FinancialMetric } from "@/types/wealth-coach";

import { coachColors } from "./tokens";

type FinancialMetricCardProps = {
  compact?: boolean;
  metric: FinancialMetric;
  showDivider?: boolean;
};

function renderMetricIcon(metric: FinancialMetric) {
  if (metric.id === "expenses") {
    return <Ionicons name="wallet-outline" size={18} color={coachColors.brandGreen} />;
  }

  if (metric.icon === "piggy-bank") {
    return <Ionicons name="cash-outline" size={18} color={coachColors.brandGreen} />;
  }

  if (metric.icon === "target") {
    return <Ionicons name="flag-outline" size={18} color={coachColors.brandGreen} />;
  }

  return <Ionicons name="analytics-outline" size={18} color={coachColors.brandGreen} />;
}

function formatMetricValue(metric: FinancialMetric): string {
  if (metric.format === "percentage") {
    const sign = metric.showSign && metric.value > 0 ? "+" : "";
    return `${sign}${formatPercentage(metric.value)}`;
  }

  if (metric.format === "currency") {
    return formatINR(metric.value);
  }

  return `${metric.value}`;
}

export function FinancialMetricCard({ compact = false, metric, showDivider = false }: FinancialMetricCardProps) {
  const valueColor = metric.trend === "negative"
    ? coachColors.brandOrange
    : metric.trend === "positive"
      ? coachColors.brandGreen
      : coachColors.textPrimary;
  const formattedValue = formatMetricValue(metric);

  return (
    <View
      accessible
      accessibilityLabel={`${metric.label}, ${formattedValue}, ${metric.supportingLabel}`}
      style={[styles.metricCard, compact && styles.metricCardCompact, showDivider && styles.metricCardDivider]}
    >
      <View style={styles.iconContainer}>{renderMetricIcon(metric)}</View>
      <Text numberOfLines={1} style={styles.label}>{metric.label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.68}
        numberOfLines={1}
        style={[styles.value, compact && styles.valueCompact, { color: valueColor }]}
      >
        {formattedValue}
      </Text>
      <Text numberOfLines={1} style={styles.supportingLabel}>{metric.supportingLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 93,
    paddingHorizontal: 8,
  },
  metricCardCompact: {
    paddingHorizontal: 5,
  },
  metricCardDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: coachColors.brandGreenBorder,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: coachColors.surface,
  },
  label: {
    marginTop: 7,
    flexShrink: 1,
    color: coachColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  value: {
    marginTop: 1,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  valueCompact: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.35,
  },
  supportingLabel: {
    marginTop: 1,
    flexShrink: 1,
    color: coachColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});
