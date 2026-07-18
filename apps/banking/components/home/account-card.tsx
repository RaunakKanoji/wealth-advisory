import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { formatIndianCurrency } from "../../lib/currency";
import { BankAccount } from "../../types/banking";

type AccountCardProps = {
  account: BankAccount;
};

export default function AccountCard({ account }: AccountCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isSmall = width < 375;
  const isTablet = width >= 768;

  // Responsive styling formulas
  const cardWidth = isTablet ? 620 : width - 56;
  const cardHeight = isSmall ? 190 : 210;
  const cardPaddingHoriz = isSmall ? 20 : 24;
  const cardPaddingVert = isSmall ? 16 : 20;

  // Typography scaling
  const balanceFontSize = isSmall ? 30 : 36;
  const balanceLineHeight = isSmall ? 36 : 44;

  const handleDetailsPress = () => {
    router.push({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId: account.id },
    });
  };

  const getAccountLabel = (type: BankAccount["type"]) => {
    switch (type) {
      case "savings":
        return "SAVINGS ACCOUNT";
      case "current":
        return "CURRENT ACCOUNT";
      case "salary":
        return "SALARY ACCOUNT";
      case "fixed-deposit":
        return "FIXED DEPOSIT";
      case "recurring-deposit":
        return "RECURRING DEPOSIT";
      default:
        return "BANK ACCOUNT";
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          width: cardWidth,
          minHeight: cardHeight,
          paddingHorizontal: cardPaddingHoriz,
          paddingVertical: cardPaddingVert,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.accountType}>{getAccountLabel(account.type)}</Text>
        {account.isPrimary && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>Primary</Text>
          </View>
        )}
      </View>

      {/* Available Balance */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[
            styles.balanceText,
            { fontSize: balanceFontSize, lineHeight: balanceLineHeight },
          ]}
        >
          {formatIndianCurrency(account.availableBalance ?? account.balance)}
        </Text>
      </View>

      {/* Card Divider */}
      <View style={styles.divider} />

      {/* Bottom Footer Row */}
      <View style={styles.footerRow}>
        <View>
          <Text
            style={styles.accountNumberLabel}
            accessibilityLabel={`Account ending in ${account.lastFour}`}
          >
            Account Number: •••• {account.lastFour}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${account.name} details`}
          onPress={handleDetailsPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#008764",
    borderRadius: 24,
    justifyContent: "space-between",
    alignSelf: "center",
    // iOS shadow matching instructions
    shadowColor: "#001E17",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    // Android shadow
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountType: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
    letterSpacing: 0.6,
    color: "#FFFFFF",
  },
  primaryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  primaryBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  balanceContainer: {
    marginTop: 16,
  },
  balanceLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: "rgba(255,255,255,0.78)",
  },
  balanceText: {
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.23)",
    marginVertical: 12,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountNumberLabel: {
    fontSize: 16,
    fontWeight: "400",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
});
