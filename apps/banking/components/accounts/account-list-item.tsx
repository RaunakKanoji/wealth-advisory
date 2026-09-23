import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import type {
  AccountOverviewAction,
  AccountOverviewItem,
  AccountType,
} from "@/types/banking";

import { PrivateAmount } from "./private-amount";

export type AccountCardAction = AccountOverviewAction;

type AccountListItemProps = {
  account: AccountOverviewItem;
  isBalanceVisible: boolean;
  onPress: () => void;
  onActionPress: (action: AccountCardAction) => void;
};

const actionPresentation: Record<
  AccountOverviewAction,
  { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  transfer: { label: "Transfer", icon: "arrow-up-outline" },
  statement: { label: "Statement", icon: "document-text-outline" },
  details: { label: "Details", icon: "chevron-forward-outline" },
  maturity: { label: "Maturity", icon: "calendar-outline" },
  schedule: { label: "Schedule", icon: "repeat-outline" },
};

function getAccountIcon(type: AccountType): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "current":
      return "briefcase-outline";
    case "fixed-deposit":
      return "lock-closed-outline";
    case "recurring-deposit":
      return "calendar-outline";
    case "savings":
    case "salary":
    default:
      return "wallet-outline";
  }
}

function formatInterestRate(value?: string): string {
  const rate = value?.trim();
  if (!rate) return "Rate unavailable";
  if (/p\.?\s*a\.?/i.test(rate)) return rate;
  return `${rate.includes("%") ? rate : `${rate}%`} p.a.`;
}

function privateAccessibilityLabel(
  label: string,
  amountMinorUnits: number | null,
  isVisible: boolean,
): string {
  if (amountMinorUnits === null) return `${label} unavailable`;
  return `${label}, ${isVisible ? formatIndianMinorUnits(amountMinorUnits) : "amount hidden"}`;
}

function accountAccessibilityLabel(
  account: AccountOverviewItem,
  isBalanceVisible: boolean,
): string {
  const parts = [
    `Open ${account.displayName}`,
    `${account.typeLabel}, account ending in ${account.lastFour}`,
    account.isPrimary ? "Primary account" : null,
    privateAccessibilityLabel(
      account.mainBalanceLabel,
      account.mainBalanceMinorUnits,
      isBalanceVisible,
    ),
    account.status !== "active" ? `Status ${account.status}` : null,
  ];

  if (account.productKind === "fixed-deposit") {
    const maturity = account.maturityDate
      ? `Matures ${formatDate(account.maturityDate)}`
      : "Maturity date unavailable";
    parts.push(`${formatInterestRate(account.interestRate)}, ${maturity}`);
  }

  if (account.productKind === "recurring-deposit") {
    const contributionLabel = account.contributionFrequency === "Quarterly"
      ? "Quarterly contribution"
      : "Monthly contribution";
    parts.push(
      privateAccessibilityLabel(
        contributionLabel,
        account.monthlyContributionMinorUnits,
        isBalanceVisible,
      ),
      account.nextDepositDate
        ? `Next deposit ${formatDate(account.nextDepositDate)}`
        : "Next deposit unavailable",
    );
  }

  return parts.filter((part): part is string => Boolean(part)).join(". ");
}

export function AccountListItem({
  account,
  isBalanceVisible,
  onPress,
  onActionPress,
}: AccountListItemProps) {
  const icon = getAccountIcon(account.type);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accountAccessibilityLabel(account, isBalanceVisible)}
        accessibilityHint="Opens account details"
        onPress={onPress}
        style={({ pressed }) => [styles.cardContent, pressed && styles.cardPressed]}
      >
        <View style={styles.cardHeader}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.iconContainer}
          >
            <Ionicons name={icon} size={21} color={appColors.primaryPressed} />
          </View>

          <View style={styles.headerCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.accountName}>{account.displayName}</Text>
              {account.isPrimary ? (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Primary</Text>
                </View>
              ) : null}
            </View>
            <Text
              accessibilityLabel={`Account ending in ${account.lastFour}`}
              numberOfLines={1}
              style={styles.maskedNumber}
            >
              {account.typeLabel} •••• {account.lastFour}
            </Text>
          </View>
        </View>

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>{account.mainBalanceLabel}</Text>
          <PrivateAmount
            accessibilityLabel={privateAccessibilityLabel(
              account.mainBalanceLabel,
              account.mainBalanceMinorUnits,
              isBalanceVisible,
            )}
            amountMinorUnits={account.mainBalanceMinorUnits}
            unavailableLabel="Unavailable"
            visible={isBalanceVisible}
            style={styles.amount}
          />
          {account.status !== "active" ? (
            <Text style={styles.status}>{account.status}</Text>
          ) : null}
        </View>

        {account.productKind === "fixed-deposit" ? (
          <Text style={styles.productSupport}>
            {formatInterestRate(account.interestRate)} · {account.maturityDate ? `Matures ${formatDate(account.maturityDate)}` : "Maturity date unavailable"}
          </Text>
        ) : null}

        {account.productKind === "recurring-deposit" ? (
          <View style={styles.depositMetrics}>
            <DepositMetric label={account.contributionFrequency === "Quarterly" ? "Quarterly contribution" : "Monthly contribution"}>
              <PrivateAmount
                accessibilityLabel={privateAccessibilityLabel(
                  account.contributionFrequency === "Quarterly" ? "Quarterly contribution" : "Monthly contribution",
                  account.monthlyContributionMinorUnits,
                  isBalanceVisible,
                )}
                amountMinorUnits={account.monthlyContributionMinorUnits}
                unavailableLabel="Unavailable"
                visible={isBalanceVisible}
                style={styles.depositMetricValue}
              />
            </DepositMetric>
            <DepositMetric label="Next deposit">
              <Text numberOfLines={1} style={styles.depositMetricValue}>
                {account.nextDepositDate ? formatDate(account.nextDepositDate) : "Unavailable"}
              </Text>
            </DepositMetric>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actionDivider} />
      <View style={styles.actionRow}>
        {account.actions.map((action) => {
          const presentation = actionPresentation[action];
          return (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={`${presentation.label} for ${account.displayName}`}
              onPress={() => onActionPress(action)}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
            >
              <Ionicons name={presentation.icon} size={18} color={appColors.primaryPressed} />
              <Text numberOfLines={1} style={styles.actionLabel}>{presentation.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DepositMetric({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.depositMetric}>
      <Text numberOfLines={1} style={styles.depositMetricLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: appRadii.card,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  cardContent: {
    paddingHorizontal: 18,
    paddingTop: appSpacing.lg,
    paddingBottom: appSpacing.md,
  },
  cardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  cardHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: appSpacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  accountName: {
    flex: 1,
    minWidth: 0,
    color: appColors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  maskedNumber: {
    marginTop: 2,
    color: appColors.textSecondary,
    ...appTypography.supporting,
  },
  primaryBadge: {
    flexShrink: 0,
    marginLeft: appSpacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  primaryBadgeText: {
    color: appColors.primaryPressed,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  balanceBlock: {
    marginTop: appSpacing.md,
  },
  balanceLabel: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  amount: {
    marginTop: 2,
    color: appColors.textPrimary,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
  },
  status: {
    marginTop: 2,
    color: appColors.warning,
    ...appTypography.metadata,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  productSupport: {
    marginTop: appSpacing.sm,
    color: appColors.textSecondary,
    ...appTypography.metadata,
  },
  depositMetrics: {
    flexDirection: "row",
    columnGap: appSpacing.lg,
    marginTop: appSpacing.md,
  },
  depositMetric: {
    flex: 1,
    minWidth: 0,
  },
  depositMetricLabel: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  depositMetricValue: {
    marginTop: 2,
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  actionDivider: {
    marginHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.divider,
  },
  actionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 2,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 3,
    borderRadius: appRadii.control,
  },
  actionLabel: {
    flexShrink: 1,
    color: appColors.primaryPressed,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  actionPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
