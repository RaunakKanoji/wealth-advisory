import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { formatIndianCurrency } from "../../lib/currency";

type TotalBalanceCardProps = {
  balance: number;
};

export default function TotalBalanceCard({ balance }: TotalBalanceCardProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const { width } = useWindowDimensions();

  const isSmall = width < 375;

  // Responsive sizes
  const balanceFontSize = isSmall ? 29 : 34;
  const balanceLineHeight = isSmall ? 36 : 42;
  const iconContainerSize = isSmall ? 82 : 105;
  const iconSize = isSmall ? 38 : 46;

  const toggleBalance = () => {
    setIsBalanceVisible((prev) => !prev);
  };

  return (
    <View style={styles.card}>
      {/* Left Info Panel */}
      <View style={styles.leftPanel}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>Total Balance</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isBalanceVisible ? "Hide total balance" : "Show total balance"
            }
            onPress={toggleBalance}
            hitSlop={12}
            style={({ pressed }) => [
              styles.eyeButton,
              pressed && styles.eyeButtonPressed,
            ]}
          >
            <Ionicons
              name={isBalanceVisible ? "eye-outline" : "eye-off-outline"}
              size={20}
              color="#737D8C"
            />
          </Pressable>
        </View>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.balanceText,
            { fontSize: balanceFontSize, lineHeight: balanceLineHeight },
          ]}
        >
          {isBalanceVisible ? formatIndianCurrency(balance) : "₹ ••••••••"}
        </Text>

        <Text style={styles.supportText}>Across all accounts</Text>
      </View>

      {/* Right Icon Block */}
      <View
        style={[
          styles.iconContainer,
          { width: iconContainerSize, height: iconContainerSize },
        ]}
      >
        <Ionicons name="business" size={iconSize} color="#A2AAB7" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    minHeight: 145,
    paddingHorizontal: 24,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F0F1F3",
    // Premium soft card shadow
    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  leftPanel: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#737D8C",
  },
  eyeButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  eyeButtonPressed: {
    backgroundColor: "#F3F4F6",
  },
  balanceText: {
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
  },
  supportText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#00866A",
    marginTop: 6,
  },
  iconContainer: {
    borderRadius: 18,
    backgroundColor: "#F2F3F5",
    alignItems: "center",
    justifyContent: "center",
  },
});
