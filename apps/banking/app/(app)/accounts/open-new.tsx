import React from "react";

import { AccountActionScreen } from "@/components/accounts/account-action-screen";

export default function OpenNewAccountScreen() {
  return (
    <AccountActionScreen
      title="Open a new account"
      description="Explore eligible IDBI Bank accounts that fit your goals."
      actionLabel="Back to Accounts"
    />
  );
}
