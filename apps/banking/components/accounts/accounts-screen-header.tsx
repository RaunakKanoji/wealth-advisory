import React from "react";

import { IconButton, PageHeader } from "@/components/design-system";

import { accountColors } from "./tokens";

type AccountsScreenHeaderProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function AccountsScreenHeader({
  isRefreshing,
  onRefresh,
}: AccountsScreenHeaderProps) {
  return (
    <PageHeader
      title="My Accounts"
      action={
        <IconButton
          accessibilityLabel={isRefreshing ? "Refreshing accounts" : "Refresh accounts"}
          busyIconColor={accountColors.iconMuted}
          iconColor={accountColors.textSecondary}
          iconName="refresh-outline"
          isBusy={isRefreshing}
          onPress={onRefresh}
          rotateWhenBusy
        />
      }
    />
  );
}
