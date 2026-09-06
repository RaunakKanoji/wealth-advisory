import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CoachFlowScreen } from "@/components/coach/coach-flow-screen";

export default function CoachChatScreen() {
  const { accountId, cardId, period } = useLocalSearchParams<{
    accountId?: string | string[];
    cardId?: string | string[];
    period?: string | string[];
  }>();
  const selectedAccountId = Array.isArray(accountId) ? accountId[0] : accountId;
  const selectedCardId = Array.isArray(cardId) ? cardId[0] : cardId;
  const selectedPeriod = Array.isArray(period) ? period[0] : period;

  return (
    <CoachFlowScreen
      title={selectedCardId ? "Ask Coach about this card" : selectedAccountId ? "Ask Coach about this account" : "Ask Wealth Coach"}
      description={selectedCardId
        ? "Coach will use this card reference and your selected period after the existing consent step. Card credentials and raw transaction history are not placed in the URL."
        : selectedAccountId
        ? "Coach will use this account reference and your selected period after the existing consent step. Your transaction history is not placed in the URL."
        : "Your conversational coach experience will appear here. Ask about spending, saving, goals, or the next step in your financial plan."}
      contextNote={selectedCardId
        ? `Card context attached · ${selectedPeriod ?? "all available history"}`
        : selectedAccountId
          ? `Account context attached · ${selectedPeriod ?? "all available history"}`
          : undefined}
    />
  );
}
