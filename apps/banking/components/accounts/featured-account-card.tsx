import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatIndianCurrency } from "@/lib/currency";
import type { BankAccount } from "@/types/banking";

import { accountColors } from "./tokens";

type FeaturedAccountCardProps = {
  account: BankAccount;
  width: number;
  onPress: () => void;
};

export function FeaturedAccountCard({
  account,
  width,
  onPress,
}: FeaturedAccountCardProps) {
  const isSmall = width < 330;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${account.name} ending in ${account.lastFour}`}
      accessibilityHint="Opens account details"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        isSmall && styles.cardSmall,
        pressed && styles.pressed,
      ]}
    >
      <View pointerEvents="none" style={styles.decorativeOuter}>
        <View style={styles.decorativeMiddle}>
          <View style={styles.decorativeInner} />
        </View>
      </View>

      <View style={[styles.content, isSmall && styles.contentSmall]}>
        <View style={styles.topRow}>
          <Text numberOfLines={1} style={styles.accountType}>
            {account.name.toUpperCase()}
          </Text>
          {account.isPrimary ? (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Primary</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.balanceRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.balance, isSmall && styles.balanceSmall]}
          >
            {formatIndianCurrency(account.balance)}
          </Text>
          <View style={styles.chevronTarget}>
            <Ionicons name="chevron-forward" size={31} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.availableLabel}>Available Balance</Text>
        <Text
          accessibilityLabel={`Account ending in ${account.lastFour}`}
          style={styles.maskedNumber}
        >
          •••• {account.lastFour}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 215,
    overflow: "hidden",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: accountColors.featuredGreen,
    shadowColor: "#001E16",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  cardSmall: {
    minHeight: 200,
  },
  content: {
    zIndex: 1,
    paddingHorizontal: 24,
    paddingVertical: 23,
  },
  contentSmall: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  accountType: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  primaryBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
  },
  balance: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 40,
    lineHeight: 49,
    fontWeight: "700",
  },
  balanceSmall: {
    fontSize: 34,
    lineHeight: 42,
  },
  chevronTarget: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  availableLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  maskedNumber: {
    marginTop: 25,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  decorativeOuter: {
    position: "absolute",
    width: 290,
    height: 290,
    right: -105,
    top: -45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 145,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorativeMiddle: {
    width: 205,
    height: 205,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 103,
    backgroundColor: "rgba(0,72,49,0.22)",
  },
  decorativeInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(0,63,43,0.20)",
  },
  pressed: {
    opacity: 0.9,
  },
});
