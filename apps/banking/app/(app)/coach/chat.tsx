import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CoachConversationScreen } from "@/components/coach/coach-conversation-screen";
import { TRANSACTION_CATEGORIES } from "@/services/accounts-service";
import type { TransactionCategory } from "@/types/banking";
import type { CoachConversationContextInput } from "@/services/wealth-coach-conversation-service";

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isIsoDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function CoachChatScreen() {
  const { accountId, cardId, conversationId, period, category, fromDate, toDate, transactionId, prompt } = useLocalSearchParams<{
    accountId?: string | string[];
    cardId?: string | string[];
    conversationId?: string | string[];
    period?: string | string[];
    category?: string | string[];
    fromDate?: string | string[];
    toDate?: string | string[];
    transactionId?: string | string[];
    prompt?: string | string[];
  }>();
  const selectedAccountId = firstParam(accountId);
  const selectedCardId = firstParam(cardId);
  const selectedConversationId = firstParam(conversationId);
  const selectedPeriod = firstParam(period);
  const selectedCategory = firstParam(category);
  const selectedFromDate = firstParam(fromDate);
  const selectedToDate = firstParam(toDate);
  const selectedTransactionId = firstParam(transactionId)?.trim().slice(0, 200) || undefined;
  const selectedPrompt = firstParam(prompt)?.trim().slice(0, 1_200) || undefined;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const ninetyDaysAgo = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  const hasValidCustomRange = selectedPeriod === "custom"
    && (!selectedFromDate || isIsoDate(selectedFromDate))
    && (!selectedToDate || isIsoDate(selectedToDate))
    && Boolean(selectedFromDate || selectedToDate)
    && (selectedFromDate ?? yearStart) <= (selectedToDate ?? today);
  const exactPeriod = selectedPeriod === "last-90-days"
    ? { id: "all-available" as const, label: `Last 90 days · ${ninetyDaysAgo}–${today}`, from: ninetyDaysAgo, to: today, isComplete: true }
    : hasValidCustomRange
      ? {
          id: "all-available" as const,
          label: `Custom range · ${selectedFromDate ?? yearStart}–${selectedToDate ?? today}`,
          from: selectedFromDate ?? yearStart,
          to: selectedToDate ?? today,
          isComplete: true,
        }
      : undefined;
  const contextInput: CoachConversationContextInput = {
    periodId: selectedPeriod === "this-month" ? "current-month" : selectedPeriod === "last-month" ? "previous-month" : selectedPeriod === "all" ? "all-available" : undefined,
    period: exactPeriod,
    category: TRANSACTION_CATEGORIES.includes(selectedCategory as TransactionCategory) ? selectedCategory as TransactionCategory : undefined,
    selectedTransactionId,
  };

  return <CoachConversationScreen conversationId={selectedConversationId} initialPrompt={selectedPrompt} scopeInput={selectedCardId ? { kind: "card", cardId: selectedCardId } : selectedAccountId ? { kind: "account", accountId: selectedAccountId } : undefined} contextInput={contextInput.period || contextInput.periodId || contextInput.category || contextInput.selectedTransactionId ? contextInput : undefined} />;
}
