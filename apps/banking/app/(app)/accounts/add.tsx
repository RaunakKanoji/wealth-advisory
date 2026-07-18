import React from "react";

import { AccountActionScreen } from "@/components/accounts/account-action-screen";

export default function AddAccountScreen() {
  return (
    <AccountActionScreen
      title="Add an account"
      description="Link an eligible IDBI Bank account to see it in My Accounts."
      actionLabel="Done"
    />
  );
}
