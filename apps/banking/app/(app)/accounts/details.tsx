import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function AccountDetailsRoute() {
  const { accountId } = useLocalSearchParams<{ accountId?: string | string[] }>();
  const selectedAccountId = Array.isArray(accountId) ? accountId[0] : accountId;

  if (!selectedAccountId) {
    return <Redirect href="/(app)/(tabs)/accounts" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/(app)/accounts/[accountId]",
        params: { accountId: selectedAccountId, section: "details" },
      }}
    />
  );
}
