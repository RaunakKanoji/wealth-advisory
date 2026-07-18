import React from "react";

import { AccountActionScreen } from "@/components/accounts/account-action-screen";

export default function AccountsSummaryScreen() {
  return (
    <AccountActionScreen
      title="Balance summary"
      description="Review the funds held across your linked accounts."
    />
  );
}
