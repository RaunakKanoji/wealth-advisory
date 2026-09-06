import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { formatMaturityDate } from "@/lib/date";
import { formatIndianCurrency } from "@/lib/currency";
import type { AccountType, BankAccount } from "@/types/banking";

import { accountColors } from "./tokens";

type AccountListItemProps = {
  account: BankAccount;
  isLast: boolean;
  onPress: () => void;
};

function getAccountIcon(type: AccountType) {
  switch (type) {
    case "current":
      return { name: "scale-balance" as const, color: accountColors.brandOrange };
    case "fixed-deposit":
      return { name: "cash" as const, color: accountColors.brandGreen };
    case "recurring-deposit":
      return { name: "history" as const, color: accountColors.brandOrange };
    case "savings":
    case "salary":
    default:
      return { name: "bank" as const, color: accountColors.brandGreen };
  }
}

function getAccountIconBackground(type: AccountType) {
  return type === "current" || type === "recurring-deposit"
    ? accountColors.brandOrangeSoft
    : accountColors.brandGreenSoft;
}

export function AccountListItem({
  account,
  isLast,
  onPress,
}: AccountListItemProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;
  const icon = getAccountIcon(account.type);
  const isDeposit = account.type === "fixed-deposit" || account.type === "recurring-deposit";
  const accountLabel = account.nickname || account.name;
  const balanceLabel = account.availableBalanceMinorUnits !== undefined
    ? "Available balance"
    : account.type === "fixed-deposit"
      ? "Principal"
      : isDeposit
        ? "Reported balance"
        : "Reported balance";
  const statusText = account.status === "active" ? "Active" : account.status;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${accountLabel} ending in ${account.lastFour}`}
      accessibilityHint="Opens account details"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { paddingHorizontal: isSmall ? 16 : 20 },
        !isLast && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.iconContainer,
          { backgroundColor: getAccountIconBackground(account.type) },
        ]}
      >
        <MaterialCommunityIcons name={icon.name} size={25} color={icon.color} />
      </View>

      <View style={styles.nameColumn}>
        <View style={styles.nameRow}>
          <Text
            numberOfLines={2}
            style={[styles.accountName, isSmall && styles.accountNameSmall]}
          >
            {accountLabel}
          </Text>
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
          •••• {account.lastFour}
        </Text>
        <Text numberOfLines={1} style={styles.productType}>
          {account.name}
        </Text>
      </View>

      <View style={[styles.amountColumn, isSmall && styles.amountColumnSmall]}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={[styles.amount, isSmall && styles.amountSmall]}
        >
          {formatIndianCurrency(
            account.availableBalance ?? account.balance,
          ).replace("₹ ", "₹")}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.status,
            account.status === "active" ? styles.availableStatus : styles.maturityStatus,
          ]}
        >
          {statusText}
        </Text>
        <Text numberOfLines={1} style={styles.balanceLabel}>
          {balanceLabel}
        </Text>
        {account.maturityDate ? (
          <Text numberOfLines={1} style={styles.maturityDate}>
            {formatMaturityDate(account.maturityDate)}
          </Text>
        ) : null}
      </View>

      <View style={styles.chevronTarget}>
        <Ionicons
          name="chevron-forward"
          size={22}
          color="#C2C8D0"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    backgroundColor: accountColors.surface,
  },
  iconContainer: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  accountName: {
    flex: 1,
    color: accountColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  accountNameSmall: {
    fontSize: 15,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 6,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: accountColors.brandGreenSoft,
  },
  primaryBadgeText: {
    color: accountColors.brandGreenDark,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  maskedNumber: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
  },
  productType: {
    marginTop: 1,
    color: accountColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  amountColumn: {
    width: 126,
    alignItems: "flex-end",
    marginLeft: 8,
  },
  amountColumnSmall: {
    width: 112,
  },
  amount: {
    width: "100%",
    color: accountColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "right",
  },
  amountSmall: {
    fontSize: 15,
  },
  status: {
    width: "100%",
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
  },
  balanceLabel: {
    width: "100%",
    marginTop: 1,
    color: accountColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
  },
  maturityDate: {
    width: "100%",
    marginTop: 1,
    color: accountColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
  },
  availableStatus: {
    color: accountColors.brandGreen,
    fontWeight: "500",
  },
  maturityStatus: {
    color: "#9CA3AF",
    fontWeight: "400",
  },
  chevronTarget: {
    width: 22,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: accountColors.divider,
  },
  pressed: {
    backgroundColor: "#FBFCFC",
  },
});
