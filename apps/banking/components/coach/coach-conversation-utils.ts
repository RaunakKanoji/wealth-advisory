import type { CoachConversation, CoachMessage } from "@/types/wealth-coach-conversation";

const claimedSubmitIntents = new Set<string>();
const MAX_CLAIMED_SUBMIT_INTENTS = 100;
const ACTIVE_RUN_STATUSES = new Set<CoachMessage["status"]>(["queued", "retrieving", "calculating", "preparing"]);

export function activeCoachRun(
  conversation: CoachConversation | null | undefined,
): CoachConversation["runs"][number] | undefined {
  const latestRun = conversation?.runs[conversation.runs.length - 1];
  return latestRun && ACTIVE_RUN_STATUSES.has(latestRun.status) ? latestRun : undefined;
}

export function retryUserMessageId(
  conversation: CoachConversation | null | undefined,
  message: CoachMessage,
): string | undefined {
  if (!conversation || message.role !== "assistant" || message.status !== "failed") return undefined;
  const run = message.runId
    ? conversation.runs.find((candidate) => candidate.id === message.runId)
    : conversation.runs.find((candidate) => candidate.assistantMessageId === message.id);
  return run?.userMessageId;
}

export function pendingConsentUserMessageId(
  conversation: CoachConversation | null | undefined,
): string | undefined {
  if (!conversation) return undefined;
  const latestRunByUserMessage = new Map<string, CoachConversation["runs"][number]>();
  conversation.runs.forEach((run) => latestRunByUserMessage.set(run.userMessageId, run));
  return [...latestRunByUserMessage.values()]
    .reverse()
    .find((run) => run.status === "completed" && !run.assistantMessageId)
    ?.userMessageId;
}

export function claimCoachSubmitIntent(customerId: string, intentId: string): boolean {
  const normalizedIntentId = intentId.trim();
  if (!normalizedIntentId) return false;
  const key = `${customerId}:${normalizedIntentId}`;
  if (claimedSubmitIntents.has(key)) return false;
  claimedSubmitIntents.add(key);
  if (claimedSubmitIntents.size > MAX_CLAIMED_SUBMIT_INTENTS) {
    const oldest = claimedSubmitIntents.values().next().value;
    if (oldest) claimedSubmitIntents.delete(oldest);
  }
  return true;
}
