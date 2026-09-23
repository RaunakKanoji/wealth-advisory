import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton, Surface } from "@/components/design-system";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";

import { PrivateAmount } from "./private-amount";

type AccountsBalanceCardProps = {
  availableToSpendMinorUnits: number | null | undefined;
  depositBalanceMinorUnits: number | null | undefined;
  isVisibilityReady?: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  totalBalanceMinorUnits: number | null | undefined;
};

export function AccountsBalanceCard({
  availableToSpendMinorUnits,
  depositBalanceMinorUnits,
  isVisibilityReady = true,
  isVisible,
  onToggleVisibility,
  totalBalanceMinorUnits,
}: AccountsBalanceCardProps) {
  return (
    <Surface accessibilityLabel="Account balance summary" style={styles.card} variant="brand">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Total Balance</Text>
        <IconButton
          accessibilityLabel={!isVisibilityReady ? "Loading balance privacy setting" : isVisible ? "Hide account balances" : "Show account balances"}
          disabled={!isVisibilityReady}
          hitSlop={4}
          iconColor="rgba(255,255,255,0.92)"
          iconName={isVisible ? "eye-outline" : "eye-off-outline"}
          onPress={onToggleVisibility}
          style={styles.eyeButton}
        />
      </View>

      <PrivateAmount
        amountMinorUnits={totalBalanceMinorUnits}
        unavailableLabel="Total unavailable"
        visible={isVisible}
        style={styles.totalValue}
      />

      <View style={styles.divider} />

      <View style={styles.breakdownRow}>
        <BalanceMetric
          amountMinorUnits={availableToSpendMinorUnits}
          isVisible={isVisible}
          label="Available"
        />
        <BalanceMetric
          amountMinorUnits={depositBalanceMinorUnits}
          isVisible={isVisible}
          label="Deposits"
        />
      </View>
    </Surface>
  );
}

function BalanceMetric({
  amountMinorUnits,
  isVisible,
  label,
}: {
  amountMinorUnits: number | null | undefined;
  isVisible: boolean;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <PrivateAmount
        amountMinorUnits={amountMinorUnits}
        unavailableLabel="Unavailable"
        visible={isVisible}
        style={styles.metricValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: appSpacing.xl,
    borderRadius: appRadii.card,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: appColors.surface,
    ...appTypography.cardTitle,
    fontWeight: "700",
  },
  eyeButton: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  totalValue: {
    maxWidth: "100%",
    marginTop: appSpacing.xs,
    color: appColors.surface,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: appSpacing.lg,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  breakdownRow: {
    flexDirection: "row",
    columnGap: appSpacing.lg,
    paddingTop: appSpacing.md,
  },
  metric: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: "rgba(255,255,255,0.76)",
    ...appTypography.supporting,
    fontSize: 13,
    lineHeight: 18,
  },
  metricValue: {
    marginTop: appSpacing.xs,
    color: appColors.surface,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
});
