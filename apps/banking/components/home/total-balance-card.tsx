import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { formatINR } from "../../lib/currency";
import { appColors, appRadii, appShadows } from "@/components/theme/tokens";

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
              color={appColors.textSecondary}
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
          {isBalanceVisible ? formatINR(balance) : "₹ ••••••••"}
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
        <Ionicons name="business" size={iconSize} color={appColors.iconMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surface,
    borderRadius: appRadii.hero,
    minHeight: 145,
    paddingHorizontal: 24,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
    ...appShadows.surface,
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
    color: appColors.textSecondary,
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
    backgroundColor: appColors.surfaceMuted,
  },
  balanceText: {
    fontWeight: "700",
    color: appColors.textPrimary,
    marginTop: 12,
  },
  supportText: {
    fontSize: 16,
    fontWeight: "500",
    color: appColors.primary,
    marginTop: 6,
  },
  iconContainer: {
    borderRadius: appRadii.tile,
    backgroundColor: appColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
