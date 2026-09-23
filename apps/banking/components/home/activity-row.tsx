import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatTransactionCurrency } from "../../lib/currency";
import { BankingActivity } from "../../types/banking";
import { appColors, appRadii } from "@/components/theme/tokens";

type ActivityRowProps = {
  activity: BankingActivity;
  balanceVisible?: boolean;
  onPress: () => void;
};

export default function ActivityRow({ activity, balanceVisible = true, onPress }: ActivityRowProps) {
  const isCredit = activity.direction === "credit";

  // Determine styles and icons based on transaction direction
  const iconContainerBg = isCredit ? appColors.primarySoft : appColors.surfaceMuted;
  const iconColor = isCredit ? appColors.primary : appColors.textSecondary;
  const iconName = isCredit ? "arrow-down-outline" : "card-outline";
  const amountColor = isCredit ? appColors.primary : appColors.danger;

  // Create accessible label text
  const formattedVal = formatTransactionCurrency(activity.amount, activity.direction);
  const a11yLabel = balanceVisible
    ? `${activity.title} ${activity.direction} of ${formattedVal} rupees on ${activity.timestamp}`
    : `${activity.title}, ${activity.direction} transaction, amount hidden, on ${activity.timestamp}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Transaction Icon */}
      <View style={[styles.iconContainer, { backgroundColor: iconContainerBg }]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>

      {/* Transaction Details */}
      <View style={styles.activityDetails}>
        <Text numberOfLines={1} style={styles.activityTitle}>
          {activity.title}
        </Text>
        <Text numberOfLines={1} style={styles.activitySubtitle}>
          {activity.timestamp}
        </Text>
      </View>

      {/* Transaction Amount */}
      <Text accessible={false} style={[styles.activityAmount, { color: balanceVisible ? amountColor : appColors.textSecondary }]}>
        {balanceVisible ? formatTransactionCurrency(activity.amount, activity.direction) : "₹ ••••••••"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: appRadii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDetails: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  activityTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    color: appColors.textPrimary,
  },
  activitySubtitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
    color: appColors.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "right",
  },
});
