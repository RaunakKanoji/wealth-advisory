import type { CoachConversation, CoachMessage } from "@/types/wealth-coach-conversation";

import { activeCoachRun, claimCoachSubmitIntent, pendingConsentUserMessageId, retryUserMessageId } from "./coach-conversation-utils";

describe("Coach conversation helpers", () => {
  it("maps a failed assistant response back to the user message required for retry", () => {
    const failedAssistant: CoachMessage = {
      id: "assistant-failed",
      role: "assistant",
      content: "Please retry.",
      createdAt: "2026-09-20T10:00:00.000Z",
      runId: "run-failed",
      status: "failed",
    };
    const conversation = {
      runs: [{
        id: "run-failed",
        userMessageId: "user-original",
        assistantMessageId: failedAssistant.id,
        status: "failed",
        sequence: 1,
        createdAt: "2026-09-20T10:00:00.000Z",
        updatedAt: "2026-09-20T10:00:01.000Z",
      }],
    } as CoachConversation;

    expect(retryUserMessageId(conversation, failedAssistant)).toBe("user-original");
  });

  it("claims an explicit submit intent only once, including across remounts", () => {
    const intentId = `intent-${Date.now()}-${Math.random()}`;
    expect(claimCoachSubmitIntent("customer-a", intentId)).toBe(true);
    expect(claimCoachSubmitIntent("customer-a", intentId)).toBe(false);
  });

  it("recovers only the latest still-unanswered consent turn", () => {
    const conversation = {
      runs: [
        { id: "old-consent", userMessageId: "resolved-user", status: "completed", sequence: 1 },
        { id: "old-retry", userMessageId: "resolved-user", assistantMessageId: "answer", status: "completed", sequence: 2 },
        { id: "pending-consent", userMessageId: "pending-user", status: "completed", sequence: 3 },
      ],
    } as CoachConversation;

    expect(pendingConsentUserMessageId(conversation)).toBe("pending-user");
  });

  it("hydrates only the latest in-progress run as active", () => {
    const conversation = {
      runs: [
        {
          id: "run-completed",
          userMessageId: "user-completed",
          status: "completed",
          sequence: 1,
          createdAt: "2026-09-20T10:00:00.000Z",
          updatedAt: "2026-09-20T10:00:01.000Z",
        },
        {
          id: "run-active",
          userMessageId: "user-active",
          status: "calculating",
          sequence: 2,
          createdAt: "2026-09-20T10:01:00.000Z",
          updatedAt: "2026-09-20T10:01:01.000Z",
        },
      ],
    } as CoachConversation;

    expect(activeCoachRun(conversation)?.id).toBe("run-active");
    conversation.runs[1].status = "completed";
    expect(activeCoachRun(conversation)).toBeUndefined();
  });
});
