import React from "react";

import { AccountActionScreen } from "@/components/accounts/account-action-screen";

export default function StatementsScreen() {
  return (
    <AccountActionScreen
      title="Statements"
      description="Review statements for your linked IDBI Bank accounts."
      allowAccountSelection
    />
  );
}
