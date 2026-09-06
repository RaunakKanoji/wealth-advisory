import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CoachFlowScreen } from "@/components/coach/coach-flow-screen";

export default function CoachChatScreen() {
  const { accountId, period } = useLocalSearchParams<{
    accountId?: string | string[];
    period?: string | string[];
  }>();
  const selectedAccountId = Array.isArray(accountId) ? accountId[0] : accountId;
  const selectedPeriod = Array.isArray(period) ? period[0] : period;

  return (
    <CoachFlowScreen
      title={selectedAccountId ? "Ask Coach about this account" : "Ask Wealth Coach"}
      description={selectedAccountId
        ? "Coach will use this account reference and your selected period after the existing consent step. Your transaction history is not placed in the URL."
        : "Your conversational coach experience will appear here. Ask about spending, saving, goals, or the next step in your financial plan."}
      contextNote={selectedAccountId ? `Account context attached · ${selectedPeriod ?? "all available history"}` : undefined}
    />
  );
}
