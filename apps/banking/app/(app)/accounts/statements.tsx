import React from "react";

import { AccountActionScreen } from "@/components/accounts/account-action-screen";

export default function AccountStatementsScreen() {
  return (
    <AccountActionScreen
      title="Statements"
      description="Your account statements will be available here."
      allowAccountSelection
    />
  );
}
