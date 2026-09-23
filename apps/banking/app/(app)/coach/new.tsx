import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CoachConversationScreen } from "@/components/coach/coach-conversation-screen";

export default function NewCoachConversationScreen() {
  const { goalId: rawGoalId, prompt: rawPrompt, submitIntent: rawSubmitIntent } = useLocalSearchParams<{
    goalId?: string | string[];
    prompt?: string | string[];
    submitIntent?: string | string[];
  }>();
  const goalId = Array.isArray(rawGoalId) ? rawGoalId[0] : rawGoalId;
  const prompt = Array.isArray(rawPrompt) ? rawPrompt[0] : rawPrompt;
  const submitIntent = Array.isArray(rawSubmitIntent) ? rawSubmitIntent[0] : rawSubmitIntent;
  return (
    <CoachConversationScreen
      initialPrompt={prompt}
      autoSubmitIntentId={submitIntent}
      scopeInput={goalId ? { kind: "goal", goalId } : undefined}
    />
  );
}
