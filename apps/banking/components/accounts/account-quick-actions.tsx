import React from "react";
import { StyleSheet, View } from "react-native";

import type { BankAccount } from "@/types/banking";

import { AccountQuickAction } from "./account-quick-action";
import { accountColors } from "./tokens";

type AccountQuickActionsProps = {
  account: BankAccount;
  onStatementPress: () => void;
  onDetailsPress: () => void;
  onManageCardPress: () => void;
  onMoreActionsPress: () => void;
};

export function AccountQuickActions({
  account,
  onStatementPress,
  onDetailsPress,
  onManageCardPress,
  onMoreActionsPress,
}: AccountQuickActionsProps) {
  const cardUnavailableHint = "Card management is not available for this account";

  return (
    <View style={styles.container}>
      <AccountQuickAction
        iconName="document-text"
        iconColor={accountColors.brandGreen}
        label="Bank Statement"
        accessibilityLabel="View bank statement"
        accessibilityHint={`Opens the statement for ${account.name.toLowerCase()}`}
        onPress={onStatementPress}
      />
      <AccountQuickAction
        iconName="arrow-down"
        iconColor={accountColors.brandOrange}
        label="Account Details"
        accessibilityLabel="View account details"
        accessibilityHint={`Opens details for ${account.name.toLowerCase()}`}
        onPress={onDetailsPress}
      />
      <AccountQuickAction
        iconName="card-outline"
        iconColor={accountColors.brandOrange}
        label={"Manage\nCard"}
        accessibilityLabel="Manage card"
        accessibilityHint={
          account.cardAvailable === false ? cardUnavailableHint : undefined
        }
        disabled={account.cardAvailable === false}
        onPress={onManageCardPress}
      />
      <AccountQuickAction
        iconName="ellipsis-horizontal"
        iconColor={accountColors.iconMuted}
        label={"More\nActions"}
        accessibilityLabel="View more account actions"
        accessibilityHint={`Opens more actions for ${account.name.toLowerCase()}`}
        onPress={onMoreActionsPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 8,
  },
});
