import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BankAccount } from "@/types/banking";

import { AccountListItem } from "./account-list-item";
import { accountColors } from "./tokens";

type AccountsListCardProps = {
  accounts: BankAccount[];
  onAccountPress: (account: BankAccount) => void;
};

export function AccountsListCard({
  accounts,
  onAccountPress,
}: AccountsListCardProps) {
  return (
    <View>
      <Text style={styles.title}>All Accounts ({accounts.length})</Text>
      <View style={styles.card}>
        {accounts.map((account, index) => (
          <AccountListItem
            key={account.id}
            account={account}
            isLast={index === accounts.length - 1}
            onPress={() => onAccountPress(account)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 14,
    color: accountColors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  card: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
