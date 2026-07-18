import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatIndianCurrency } from "../../lib/currency";
import { BankingActivity } from "../../types/banking";

type ActivityRowProps = {
  activity: BankingActivity;
  onPress: () => void;
};

export default function ActivityRow({ activity, onPress }: ActivityRowProps) {
  const isCredit = activity.direction === "credit";

  // Determine styles and icons based on transaction direction
  const iconContainerBg = isCredit ? "#E8F4F1" : "#F2F3F5";
  const iconColor = isCredit ? "#00866A" : "#737D8C";
  const iconName = isCredit ? "arrow-down-outline" : "card-outline";
  const amountColor = isCredit ? "#00866A" : "#111827";
  const amountPrefix = isCredit ? "+" : "-";

  // Create accessible label text
  const formattedVal = formatIndianCurrency(activity.amount).replace("₹ ", "");
  const a11yLabel = `${activity.title} ${activity.direction} of ${formattedVal} rupees on ${activity.timestamp}`;

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
      <Text style={[styles.activityAmount, { color: amountColor }]}>
        {amountPrefix}
        {formatIndianCurrency(activity.amount)}
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
    borderRadius: 24,
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
    color: "#111827",
  },
  activitySubtitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
    color: "#7B8492",
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "right",
  },
});
