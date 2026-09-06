import {
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
} from "@/data/accounts-demo-data";
import {
  calculateGoalScenario,
  clearCoachState,
  createCoachConversation,
  getCoachConversation,
  resolveCoachScope,
  retryCoachMessage,
  saveCoachGoal,
  saveCoachReport,
  setCoachConsent,
  submitCoachMessage,
} from "@/services/wealth-coach-conversation-service";

describe("wealth coach conversation service", () => {
  beforeEach(async () => {
    await clearCoachState(DEMO_CUSTOMER_A);
    await clearCoachState(DEMO_CUSTOMER_B);
  });

  it("calculates no-growth goal options in exact paise", () => {
    expect(calculateGoalScenario(120_000_00, 30_000_00, 5_000_00)).toMatchObject({
      months: 18,
      finalContributionMinorUnits: 5_000_00,
    });
    expect(calculateGoalScenario(120_000_00, 30_000_00, 7_000_00)).toMatchObject({
      months: 13,
      finalContributionMinorUnits: 6_000_00,
    });
    expect(() => calculateGoalScenario(100, 0, 0)).toThrow();
  });

  it("requires consent, then grounds Food & Dining comparison in shared transactions", async () => {
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const blocked = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Why did my Food & Dining spending change?",
    });
    expect(blocked.consentRequired).toBe(true);
    expect(blocked.conversation.messages).toHaveLength(1);

    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const answered = await retryCoachMessage(conversation.id, blocked.userMessageId, { customerId: DEMO_CUSTOMER_A });
    const comparison = answered.answer?.blocks.find((block) => block.type === "spendingComparison");
    expect(comparison).toMatchObject({
      current: { amountMinorUnits: 1_500_000 },
      previous: { amountMinorUnits: 1_200_000 },
      differenceMinorUnits: 300_000,
      percentageChange: 25,
    });
    expect(answered.answer?.modelStatus).toBe("test-adapter");
    expect(answered.answer?.dataEnvironment).toBe("Demo data");
    expect(answered.answer?.sourceReferences.some((source) => source.transactionId === "sav-20260903-dining-1")).toBe(true);
  });

  it("preserves category and period context for an evidence follow-up", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const first = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Why did my Food & Dining spending change?",
    });
    const followUp = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Show the transactions behind that",
    });
    expect(followUp.answer?.blocks[1]).toMatchObject({ type: "transactionList" });
    expect(followUp.answer?.scope).toEqual(first.answer?.scope);
    expect(followUp.answer?.blocks.some((block) => block.type === "transactionList" && block.transactionIds.includes("sav-20260905-dining-2"))).toBe(true);
  });

  it("isolates conversations and rejects another customer's account", async () => {
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    expect(await getCoachConversation(conversation.id, DEMO_CUSTOMER_B)).toBeUndefined();
    await expect(resolveCoachScope(DEMO_CUSTOMER_B, { kind: "account", accountId: "savings-primary" })).rejects.toThrow("Account unavailable");
  });

  it("saves reviewed goals and reports idempotently", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Help me plan an emergency fund",
    });
    const answerMessageId = result.answer?.messageId;
    expect(answerMessageId).toBeTruthy();
    const goalInput = {
      idempotencyKey: "goal-review-1",
      conversationId: conversation.id,
      sourceAnswerMessageId: answerMessageId as string,
      name: "Emergency fund",
      targetMinorUnits: 120_000_00,
      allocatedMinorUnits: 30_000_00,
      monthlyContributionMinorUnits: 7_000_00,
    };
    const firstGoal = await saveCoachGoal(DEMO_CUSTOMER_A, goalInput);
    const secondGoal = await saveCoachGoal(DEMO_CUSTOMER_A, goalInput);
    expect(secondGoal.id).toBe(firstGoal.id);
    const reportInput = { idempotencyKey: "report-1", conversationId: conversation.id, answerMessageId: answerMessageId as string };
    const firstReport = await saveCoachReport(DEMO_CUSTOMER_A, reportInput);
    const secondReport = await saveCoachReport(DEMO_CUSTOMER_A, reportInput);
    expect(secondReport.id).toBe(firstReport.id);
  });
});
