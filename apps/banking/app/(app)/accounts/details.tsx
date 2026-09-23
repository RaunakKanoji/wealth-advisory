import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function AccountDetailsRoute() {
  const { accountId, source } = useLocalSearchParams<{ accountId?: string | string[]; source?: string | string[] }>();
  const selectedAccountId = Array.isArray(accountId) ? accountId[0] : accountId;
  const selectedSource = Array.isArray(source) ? source[0] : source;

  if (!selectedAccountId) {
    return <Redirect href="/(app)/(tabs)/accounts" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/(app)/accounts/[accountId]",
        params: { accountId: selectedAccountId, section: "details", ...(selectedSource ? { source: selectedSource } : {}) },
      }}
    />
  );
}
