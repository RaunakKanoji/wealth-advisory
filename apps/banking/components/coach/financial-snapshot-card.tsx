import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Surface } from "@/components/design-system";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { formatIndianMinorUnits } from "@/lib/currency";

type FinancialSnapshotCardProps = {
  balanceSummary: {
    totalBalanceMinorUnits: number;
    availableToSpendMinorUnits: number;
    depositsMinorUnits: number;
  };
  balanceVisible?: boolean;
  onAskCoach?: () => void;
};

export function FinancialSnapshotCard({ balanceSummary, balanceVisible = true, onAskCoach }: FinancialSnapshotCardProps) {
  const { width, fontScale } = useWindowDimensions();
  const stackSupportingMetrics = width < 360 || fontScale > 1.25;

  return (
    <Surface variant="brand" style={styles.card}>
      <View style={styles.periodRow}>
        <View style={styles.periodCopy}>
          <Text style={styles.periodTitle}>Total Balance</Text>
        </View>
      </View>

      <View style={styles.metricsBlock}>
        <View accessible accessibilityLabel={`Total Balance, ${formatBalanceValue(balanceSummary.totalBalanceMinorUnits, balanceVisible)}`} style={styles.primaryMetric}>
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.primaryValue}>
            {formatBalanceValue(balanceSummary.totalBalanceMinorUnits, balanceVisible)}
          </Text>
        </View>
        <View style={[styles.supportingMetrics, stackSupportingMetrics && styles.supportingMetricsStacked]}>
          <BalanceMetric value={balanceSummary.availableToSpendMinorUnits} label="Available" balanceVisible={balanceVisible} />
          <BalanceMetric value={balanceSummary.depositsMinorUnits} label="Deposits" balanceVisible={balanceVisible} />
        </View>
      </View>

      {onAskCoach ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Wealth Coach about this month"
          onPress={onAskCoach}
          style={({ pressed }) => [styles.askAction, pressed && styles.askActionPressed]}
        >
          <Text style={styles.askActionText}>Ask Coach about this month</Text>
          <Ionicons name="arrow-forward" size={17} color={appColors.surface} />
        </Pressable>
      ) : null}
    </Surface>
  );
}

function BalanceMetric({ value, label, balanceVisible }: { value: number; label: string; balanceVisible: boolean }) {
  const formattedValue = formatBalanceValue(value, balanceVisible);
  return (
    <View accessible accessibilityLabel={`${label}, ${formattedValue}`} style={styles.supportingMetric}>
      <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.supportingValue}>
        {formattedValue}
      </Text>
      <Text style={styles.supportingLabel}>{label}</Text>
    </View>
  );
}

function formatBalanceValue(minorUnits: number, balanceVisible: boolean): string {
  return balanceVisible ? formatIndianMinorUnits(minorUnits) : "₹ ••••••••";
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 18,
    paddingBottom: 8,
    borderRadius: appRadii.card,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  periodCopy: {
    flex: 1,
    minWidth: 0,
  },
  periodTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  metricsBlock: {
    marginTop: appSpacing.lg,
  },
  primaryMetric: {
    minWidth: 0,
  },
  primaryValue: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  supportingMetric: {
    flex: 1,
    minWidth: 0,
  },
  supportingMetrics: {
    flexDirection: "row",
    columnGap: appSpacing.xl,
    marginTop: appSpacing.md,
  },
  supportingMetricsStacked: {
    flexDirection: "column",
    rowGap: appSpacing.sm,
  },
  supportingLabel: {
    marginTop: 1,
    color: "#FFFFFF",
    ...appTypography.metadata,
  },
  supportingValue: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: appTypography.amount.fontWeight,
  },
  askAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.24)",
  },
  askActionPressed: {
    opacity: 0.72,
  },
  askActionText: {
    color: appColors.surface,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
});
