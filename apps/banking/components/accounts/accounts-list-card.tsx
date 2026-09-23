import React from "react";
import { StyleSheet, View } from "react-native";

import { SectionHeader } from "@/components/design-system";
import { appSpacing } from "@/components/theme/tokens";
import type {
  AccountOverviewAction,
  AccountOverviewItem,
  BankAccount,
} from "@/types/banking";

import { AccountListItem } from "./account-list-item";

type AccountsListCardProps = {
  accounts: AccountOverviewItem[];
  onAccountPress: (account: BankAccount) => void;
  onActionPress?: (account: BankAccount, action: AccountOverviewAction) => void;
  isBalanceVisible: boolean;
  title?: string;
};

export type AccountCardAction = AccountOverviewAction;

export function AccountsListCard({
  accounts,
  onAccountPress,
  onActionPress,
  isBalanceVisible,
  title = "Accounts",
}: AccountsListCardProps) {
  return (
    <View>
      <SectionHeader
        style={styles.titleRow}
        title={title}
      />
      <View style={styles.listGap}>
        {accounts.map((account) => (
          <AccountListItem
            key={account.id}
            account={account}
            isBalanceVisible={isBalanceVisible}
            onPress={() => onAccountPress(account.account)}
            onActionPress={(action) => onActionPress?.(account.account, action)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    marginBottom: appSpacing.sm,
  },
  listGap: {
    rowGap: appSpacing.md,
  },
});
