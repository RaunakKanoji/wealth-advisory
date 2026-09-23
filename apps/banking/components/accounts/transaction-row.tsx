import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatTransactionAmount } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import type { AccountTransaction, TransactionCategory } from "@/types/banking";
import { accountColors } from "./tokens";

type TransactionRowProps = {
  transaction: AccountTransaction;
  onPress: () => void;
  isBalanceVisible?: boolean;
};

const categoryIcon: Record<TransactionCategory, React.ComponentProps<typeof Ionicons>["name"]> = {
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

const categoryLabels: Record<TransactionCategory, string> = {
  salary: "Salary",
  shopping: "Shopping",
  food: "Food",
  bill: "Bills",
  transfer: "Transfer",
  refund: "Refund",
  cash: "Cash",
  deposit: "Deposit",
  interest: "Interest",
  other: "Other",
};

export function TransactionRow({
  transaction,
  onPress,
  isBalanceVisible = true,
}: TransactionRowProps) {
  const isCredit = transaction.direction === "credit";
  const title = transaction.counterparty ?? transaction.description;
  const directionText = isCredit ? "Credit" : "Debit";
  const amountText = isBalanceVisible ? formatTransactionAmount(transaction.amountMinorUnits, isCredit ? "credit" : "debit") : "Amount hidden";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${directionText}, ${isBalanceVisible ? amountText : "amount hidden"}, ${formatDate(transaction.transactionDate)}`}
      accessibilityHint="Opens transaction details"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconContainer, isCredit ? styles.creditIcon : styles.debitIcon]}>
        <Ionicons
          name={categoryIcon[transaction.annotation?.category ?? transaction.originalCategory]}
          size={21}
          color={isCredit ? accountColors.brandGreen : accountColors.textSecondary}
        />
      </View>

      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={2} style={styles.meta}>
          {formatDate(transaction.transactionDate)}
          {transaction.transactionTime ? ` · ${transaction.transactionTime}` : ""}
          {transaction.channel ? ` · ${transaction.channel}` : ""}
        </Text>
        <View style={styles.tagRow}>
          <Text style={styles.category}>{categoryLabels[transaction.annotation?.category ?? transaction.originalCategory]}</Text>
          {transaction.status !== "posted" ? (
            <View style={[styles.statusPill, transaction.status === "failed" && styles.failedPill]}>
              <Text style={[styles.statusText, transaction.status === "failed" && styles.failedText]}>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.amountColumn}>
        <Text style={[styles.amount, isCredit ? styles.creditAmount : styles.debitAmount]}>
          {amountText}
        </Text>
        <Ionicons name="chevron-forward" size={19} color="#B4BCC6" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EDF0F2",
  },
  pressed: {
    opacity: 0.72,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  creditIcon: {
    backgroundColor: accountColors.brandGreenSoft,
  },
  debitIcon: {
    backgroundColor: accountColors.surfaceMuted,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: accountColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  meta: {
    marginTop: 3,
    color: accountColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    columnGap: 7,
  },
  category: {
    color: accountColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: accountColors.brandOrangeSoft,
  },
  failedPill: {
    backgroundColor: accountColors.dangerSoft,
  },
  statusText: {
    color: accountColors.warning,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  failedText: {
    color: accountColors.danger,
  },
  amountColumn: {
    flexShrink: 0,
    minWidth: 96,
    alignItems: "flex-end",
    rowGap: 5,
  },
  amount: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "right",
  },
  creditAmount: {
    color: accountColors.brandGreen,
  },
  debitAmount: {
    color: accountColors.danger,
  },
});
