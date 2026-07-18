import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatIndianCurrency } from "@/lib/currency";

import { accountColors, softCardShadow } from "./tokens";

type TotalBalanceSummaryProps = {
  balance: number;
  accountCount: number;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onPress: () => void;
};

export function TotalBalanceSummary({
  balance,
  accountCount,
  isVisible,
  onToggleVisibility,
  onPress,
}: TotalBalanceSummaryProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Total balance ${
        isVisible ? formatIndianCurrency(balance) : "hidden"
      }, across ${accountCount} accounts`}
      accessibilityHint="Opens the balance breakdown"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="bank"
          size={31}
          color={accountColors.brandOrange}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Total Balance</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isVisible ? "Hide total balance" : "Show total balance"
            }
            onPress={(event) => {
              event.stopPropagation();
              onToggleVisibility();
            }}
            style={({ pressed }) => [
              styles.eyeButton,
              pressed && styles.eyePressed,
            ]}
          >
            <Ionicons
              name={isVisible ? "eye-outline" : "eye-off-outline"}
              size={19}
              color={accountColors.textSecondary}
            />
          </Pressable>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.balance}
        >
          {isVisible ? formatIndianCurrency(balance) : "₹••••••••"}
        </Text>
        <Text style={styles.supportText}>Across {accountCount} accounts</Text>
      </View>

      <View style={styles.chevronTarget}>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={accountColors.iconMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 122,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 19,
    borderRadius: 20,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    ...softCardShadow,
  },
  iconContainer: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: accountColors.brandOrangeSoft,
    borderWidth: 1,
    borderColor: "#FFC9B7",
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: accountColors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
  },
  eyeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
    borderRadius: 15,
  },
  eyePressed: {
    backgroundColor: "#F3F4F6",
  },
  balance: {
    marginTop: 4,
    color: accountColors.textPrimary,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "700",
  },
  supportText: {
    marginTop: 1,
    color: accountColors.brandGreen,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  chevronTarget: {
    width: 30,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  pressed: {
    opacity: 0.88,
  },
});
