import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CoachConversationScreen } from "@/components/coach/coach-conversation-screen";

export default function CoachChatScreen() {
  const { accountId, cardId, conversationId } = useLocalSearchParams<{
    accountId?: string | string[];
    cardId?: string | string[];
    conversationId?: string | string[];
  }>();
  const selectedAccountId = Array.isArray(accountId) ? accountId[0] : accountId;
  const selectedCardId = Array.isArray(cardId) ? cardId[0] : cardId;
  const selectedConversationId = Array.isArray(conversationId) ? conversationId[0] : conversationId;

  return <CoachConversationScreen conversationId={selectedConversationId} scopeInput={selectedCardId ? { kind: "card", cardId: selectedCardId } : selectedAccountId ? { kind: "account", accountId: selectedAccountId } : undefined} />;
}
