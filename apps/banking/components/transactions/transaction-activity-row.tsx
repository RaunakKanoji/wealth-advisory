import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatTransactionAmount } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { activityDirectionLabel, activityTypeLabel } from "@/services/transaction-explorer-service";
import type { ActivityRecord } from "@/types/transaction-explorer";
import { appColors } from "@/components/theme/tokens";

type TransactionActivityRowProps = {
  activity: ActivityRecord;
  isBalanceVisible: boolean;
  onPress: () => void;
};

const categoryIcons: Record<ActivityRecord["category"], React.ComponentProps<typeof Ionicons>["name"]> = {
  salary: "briefcase-outline",
  shopping: "cart-outline",
  food: "restaurant-outline",
  bill: "receipt-outline",
  transfer: "swap-horizontal-outline",
  refund: "return-up-back-outline",
  cash: "cash-outline",
  deposit: "wallet-outline",
  interest: "trending-up-outline",
  other: "ellipse-outline",
};

export function TransactionActivityRow({ activity, isBalanceVisible, onPress }: TransactionActivityRowProps) {
  const isCredit = activity.direction === "credit";
  const isTransfer = activity.direction === "transfer";
  const icon = isTransfer ? "swap-horizontal-outline" : categoryIcons[activity.category];
  const sourceLabel = activity.sourceKind === "transfer-group"
    ? `${activity.movementFrom ?? "Source account"} → ${activity.movementTo ?? "Destination account"}`
    : activity.accountLabel ?? activity.cardLabel ?? "Source unavailable";
  const statusLabel = activity.status === "posted" ? activityTypeLabel(activity.transactionType) : activity.status;
  const amountText = isBalanceVisible
    ? formatTransactionAmount(activity.amountMinorUnits, isTransfer ? "transfer" : isCredit ? "credit" : "debit")
    : "Amount hidden";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${activityDirectionLabel(activity)}, ${isBalanceVisible ? amountText : "amount hidden"}, ${formatDate(activity.transactionDate)}`}
      accessibilityHint="Opens transaction details"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, isCredit ? styles.creditIcon : isTransfer ? styles.transferIcon : styles.debitIcon]}>
        <Ionicons name={icon} size={20} color={isCredit ? appColors.primary : isTransfer ? appColors.textSecondary : appColors.textSecondary} />
      </View>
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>{activity.title}</Text>
        <Text numberOfLines={1} style={styles.source}>{sourceLabel}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatDate(activity.transactionDate)}{activity.transactionTime ? ` · ${activity.transactionTime}` : ""}</Text>
          <Text style={styles.meta}> · {statusLabel}</Text>
        </View>
      </View>
      <View style={styles.amountColumn}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.amount, isCredit ? styles.creditAmount : !isTransfer && styles.debitAmount]}>{amountText}</Text>
        <Text numberOfLines={1} style={styles.category}>{activity.category}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={appColors.iconMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 82, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", backgroundColor: appColors.surface },
  pressed: { opacity: 0.72 },
  icon: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  creditIcon: { backgroundColor: appColors.primarySoft },
  debitIcon: { backgroundColor: appColors.surfaceMuted },
  transferIcon: { backgroundColor: appColors.surfaceMuted },
  content: { flex: 1, minWidth: 0, marginLeft: 11, marginRight: 8 },
  title: { color: appColors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  source: { marginTop: 2, color: appColors.textSecondary, fontSize: 11, lineHeight: 16 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  meta: { color: appColors.textMuted, fontSize: 10, lineHeight: 15 },
  amountColumn: { maxWidth: 118, alignItems: "flex-end", marginRight: 7 },
  amount: { color: appColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "right" },
  creditAmount: { color: appColors.primary },
  debitAmount: { color: appColors.danger },
  category: { marginTop: 2, color: appColors.textMuted, fontSize: 10, textTransform: "capitalize" },
});
