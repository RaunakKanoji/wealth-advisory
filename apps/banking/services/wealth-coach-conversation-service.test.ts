import * as SecureStore from "expo-secure-store";

import {
  DEMO_CUSTOMER_A,
  DEMO_CUSTOMER_B,
} from "@/data/accounts-demo-data";
import {
  calculateGoalScenario,
  clearCoachState,
  createCoachConversation,
  deleteCoachConversation,
  getCoachConversation,
  listCoachConversations,
  listSavedCoachReports,
  recordCoachConsentDeclined,
  renameCoachConversation,
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

  it("hides empty drafts and titles a conversation from its first meaningful question", async () => {
    const draft = await createCoachConversation(DEMO_CUSTOMER_A);
    expect(await listCoachConversations(DEMO_CUSTOMER_A)).toEqual([]);

    await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: draft.id,
      text: "Help me save for Goa",
    });

    const [conversation] = await listCoachConversations(DEMO_CUSTOMER_A);
    expect(conversation.title).toBe("Saving for Goa");
    expect(conversation.messages.some((message) => message.role === "user")).toBe(true);
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

  it("finishes a declined personal question with a durable non-personal response", async () => {
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const blocked = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Where did I spend the most this month?",
    });
    expect(blocked.consentRequired).toBe(true);

    const declined = await recordCoachConsentDeclined(
      conversation.id,
      blocked.userMessageId,
      DEMO_CUSTOMER_A,
    );
    expect(declined.messages.at(-1)).toMatchObject({
      role: "assistant",
      status: "completed",
      content: expect.stringMatching(/won.t access your personal financial data/i),
    });
    const repeated = await recordCoachConsentDeclined(
      conversation.id,
      blocked.userMessageId,
      DEMO_CUSTOMER_A,
    );
    expect(repeated.messages).toHaveLength(declined.messages.length);
  });

  it("checks a purchase against scoped available funds without claiming affordability", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Can I afford a ₹50,000 purchase?",
    });
    const metrics = result.answer?.blocks.find((block) => block.type === "metricSummary");
    const evidence = result.answer?.blocks.find((block) => block.type === "transactionList");

    expect(metrics).toMatchObject({
      type: "metricSummary",
      metrics: expect.arrayContaining([
        expect.objectContaining({ key: "purchase-amount", valueMinorUnits: 5_000_000 }),
        expect.objectContaining({ key: "available-funds", valueMinorUnits: 22_500_000 }),
        expect.objectContaining({ key: "funds-after-purchase", valueMinorUnits: 17_500_000 }),
        expect.objectContaining({ key: "recorded-net-cash-flow", valueMinorUnits: 12_250_000 }),
      ]),
    });
    expect(evidence).toMatchObject({
      type: "transactionList",
      transactionIds: expect.arrayContaining(["cur-20260902-vendor", "sav-20260902-rent"]),
    });
    expect(result.answer?.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "account", accountId: "savings-primary" }),
      expect.objectContaining({ kind: "transaction", transactionId: "cur-20260902-vendor" }),
    ]));
    expect(result.answer?.limitations.join(" ")).toMatch(/not a guarantee of affordability/i);
    expect(result.answer?.blocks[0]).toMatchObject({
      type: "text",
      text: expect.stringMatching(/funding-capacity illustration, not certainty/i),
    });

    const lakhResult = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Can I afford an INR 1.25 lakh purchase?",
    });
    const lakhMetrics = lakhResult.answer?.blocks.find((block) => block.type === "metricSummary");
    expect(lakhMetrics).toMatchObject({
      metrics: expect.arrayContaining([
        expect.objectContaining({ key: "purchase-amount", valueMinorUnits: 12_500_000 }),
        expect.objectContaining({ key: "funds-after-purchase", valueMinorUnits: 10_000_000 }),
      ]),
    });
  });

  it("answers the savings quick question with scoped cash-flow and category evidence", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How can I increase my savings?",
    });
    const metrics = result.answer?.blocks.find((block) => block.type === "metricSummary");
    const breakdown = result.answer?.blocks.find((block) => block.type === "categoryBreakdown");

    expect(metrics).toMatchObject({
      type: "metricSummary",
      metrics: expect.arrayContaining([
        expect.objectContaining({ key: "recorded-inflow", valueMinorUnits: 21_000_000 }),
        expect.objectContaining({ key: "recorded-outflow", valueMinorUnits: 8_750_000 }),
        expect.objectContaining({ key: "recorded-net-savings", valueMinorUnits: 12_250_000 }),
        expect.objectContaining({ key: "recorded-savings-rate", value: 58.33 }),
      ]),
    });
    expect(breakdown).toMatchObject({
      type: "categoryBreakdown",
      items: expect.arrayContaining([
        expect.objectContaining({ category: "food", amountMinorUnits: 1_500_000 }),
      ]),
    });
    expect(result.answer?.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ transactionId: "sav-20260901-salary" }),
      expect.objectContaining({ transactionId: "cur-20260903-invoice" }),
    ]));
    expect(result.answer?.assumptions.join(" ")).toMatch(/monthly dashboard.*match/i);
    expect(result.answer?.suggestedFollowUps).toEqual(expect.arrayContaining([
      "Show the transactions behind Food & Dining",
      "Help me plan a savings goal",
    ]));

    await setCoachConsent(DEMO_CUSTOMER_B, "granted");
    const customerBConversation = await createCoachConversation(DEMO_CUSTOMER_B);
    const customerBResult = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_B,
      conversationId: customerBConversation.id,
      text: "How can I increase my savings?",
    });
    const customerBMetrics = customerBResult.answer?.blocks.find((block) => block.type === "metricSummary");
    expect(customerBMetrics).toMatchObject({
      metrics: expect.arrayContaining([
        expect.objectContaining({ key: "recorded-inflow", valueMinorUnits: 4_500_000 }),
        expect.objectContaining({ key: "recorded-outflow", valueMinorUnits: 0 }),
      ]),
    });
    expect(customerBResult.answer?.sourceReferences
      .filter((source) => source.kind === "transaction")
      .every((source) => source.transactionId?.startsWith("b-") === true)).toBe(true);
    expect(customerBResult.answer?.assumptions.join(" ")).not.toMatch(/monthly dashboard.*match/i);
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

  it("uses a scoped period for the first question unless the question explicitly overrides it", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(
      DEMO_CUSTOMER_A,
      undefined,
      { periodId: "previous-month", category: "food" },
    );

    const scopedResult = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Show my Food & Dining transactions",
    });
    const scopedTransactions = scopedResult.answer?.blocks.find((block) => block.type === "transactionList");
    expect(scopedTransactions).toMatchObject({
      type: "transactionList",
      transactionIds: expect.arrayContaining(["sav-20260803-dining-1"]),
    });
    expect(scopedResult.conversation.context.period?.id).toBe("previous-month");

    const explicitlyOverridden = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Show my Food & Dining transactions this month",
    });
    const currentTransactions = explicitlyOverridden.answer?.blocks.find((block) => block.type === "transactionList");
    expect(currentTransactions).toMatchObject({
      type: "transactionList",
      transactionIds: expect.arrayContaining(["sav-20260903-dining-1"]),
    });
    expect(explicitlyOverridden.conversation.context.period?.id).toBe("current-month");
  });

  it("preserves an exact Activity date range instead of widening it to all history", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(
      DEMO_CUSTOMER_A,
      undefined,
      {
        period: {
          id: "all-available",
          label: "Custom range · 2026-09-03–2026-09-03",
          from: "2026-09-03",
          to: "2026-09-03",
          isComplete: true,
        },
        category: "food",
      },
    );

    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Show my Food & Dining transactions",
    });
    const transactions = result.answer?.blocks.find((block) => block.type === "transactionList");
    expect(transactions).toMatchObject({
      type: "transactionList",
      transactionIds: ["sav-20260903-dining-1"],
    });
    expect(result.conversation.context.period).toMatchObject({
      from: "2026-09-03",
      to: "2026-09-03",
    });
  });

  it("keeps transaction-detail Coach analysis pinned to the selected owner-scoped transaction", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(
      DEMO_CUSTOMER_A,
      { kind: "account", accountId: "savings-primary" },
      { periodId: "all-available", selectedTransactionId: "sav-20260903-dining-1" },
    );

    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Explain this selected transaction, including its category, status, and bank-recorded evidence.",
    });
    const transactions = result.answer?.blocks.find((block) => block.type === "transactionList");
    expect(transactions).toMatchObject({
      type: "transactionList",
      title: "Selected transaction",
      transactionIds: ["sav-20260903-dining-1"],
    });
    expect(result.answer?.sourceReferences.filter((source) => source.kind === "transaction")).toEqual([
      expect.objectContaining({ transactionId: "sav-20260903-dining-1", accountId: "savings-primary" }),
    ]);
    expect(result.conversation.context.selectedTransactionId).toBe("sav-20260903-dining-1");
  });

  it("does not broaden a selected transaction that is outside the customer scope", async () => {
    await setCoachConsent(DEMO_CUSTOMER_B, "granted");
    const conversation = await createCoachConversation(
      DEMO_CUSTOMER_B,
      undefined,
      { periodId: "all-available", selectedTransactionId: "sav-20260903-dining-1" },
    );

    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_B,
      conversationId: conversation.id,
      text: "Explain this selected transaction, including its category, status, and bank-recorded evidence.",
    });
    expect(result.answer?.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "dataUnavailable", title: "Selected transaction unavailable" }),
    ]));
    expect(result.answer?.sourceReferences.some((source) => source.kind === "transaction")).toBe(false);
    expect(result.answer?.blocks.some((block) => block.type === "transactionList")).toBe(false);
  });

  it("grounds a goal-scoped analysis in the validated goal values", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A, {
      kind: "goal",
      goalId: "retirement-fund",
    });

    expect(conversation.context).toMatchObject({
      selectedGoalId: "retirement-fund",
      goalScenario: {
        name: "Retirement Fund",
        targetMinorUnits: 400_000_000,
        allocatedMinorUnits: 272_000_000,
        remainingMinorUnits: 128_000_000,
        targetDate: "2045",
      },
    });

    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How can I reach my Retirement Fund target faster?",
    });
    const goalScenario = result.answer?.blocks.find((block) => block.type === "goalScenario");
    expect(goalScenario).toMatchObject({
      type: "goalScenario",
      goal: {
        name: "Retirement Fund",
        targetMinorUnits: 400_000_000,
        allocatedMinorUnits: 272_000_000,
        remainingMinorUnits: 128_000_000,
        targetDate: "2045",
      },
    });
    expect(result.answer?.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "source:goal:retirement-fund", kind: "goal", label: "Retirement Fund" }),
    ]));
  });

  it("answers the overview goal-progress prompt with reported goal progress", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How am I progressing toward my goals?",
    });

    const progress = result.answer?.blocks.find((block) => block.type === "goalProgress");
    expect(progress).toMatchObject({
      type: "goalProgress",
      goalId: "retirement-fund",
      name: "Retirement Fund",
      targetMinorUnits: 400_000_000,
      currentMinorUnits: 272_000_000,
      remainingMinorUnits: 128_000_000,
      progressPercentage: 68,
      targetDate: "2045",
      sourceReferenceId: "source:goal:retirement-fund",
    });
    expect(result.answer?.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "source:goal:retirement-fund", kind: "goal" }),
    ]));
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

  it("does not resurrect a conversation deleted while a Coach run is active", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    let deletion: Promise<void> | undefined;

    const run = submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How can I increase my savings?",
      onStateChange: (state) => {
        if (state === "preparing" && !deletion) {
          deletion = deleteCoachConversation(conversation.id, DEMO_CUSTOMER_A);
        }
      },
    });

    await expect(run).rejects.toThrow("Conversation unavailable");
    await deletion;
    expect(await getCoachConversation(conversation.id, DEMO_CUSTOMER_A)).toBeUndefined();
  });

  it("recovers an interrupted persisted run as a retryable failure", async () => {
    const customerId = `interrupted-customer-${Date.now()}`;
    const conversationId = "conversation-interrupted";
    const userMessageId = "message-interrupted-user";
    const runId = "run-interrupted";
    const timestamp = "2026-09-20T10:00:00.000Z";
    const persistedState = {
      consent: "granted",
      conversations: [{
        id: conversationId,
        environment: "demo",
        title: "Interrupted question",
        createdAt: timestamp,
        updatedAt: timestamp,
        context: {
          scope: {
            kind: "personal",
            accountIds: [],
            cardIds: [],
            label: "Selected personal accounts",
          },
        },
        messages: [{
          id: userMessageId,
          role: "user",
          content: "How can I increase my savings?",
          createdAt: timestamp,
          status: "retrieving",
          runId,
        }],
        runs: [{
          id: runId,
          userMessageId,
          status: "retrieving",
          sequence: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      }],
      goals: [],
      reports: [],
    };
    const storagePrefix = `idbi-wealth-coach.v1.${customerId}`;
    await SecureStore.setItemAsync(`${storagePrefix}.chunk.0`, JSON.stringify(persistedState));
    await SecureStore.setItemAsync(`${storagePrefix}.manifest`, "1");

    const recovered = await getCoachConversation(conversationId, customerId);
    expect(recovered?.runs[0]).toMatchObject({
      id: runId,
      status: "failed",
      assistantMessageId: expect.any(String),
    });
    expect(recovered?.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: userMessageId, role: "user", status: "failed" }),
      expect.objectContaining({ role: "assistant", runId, status: "failed", content: expect.stringMatching(/interrupted/i) }),
    ]));

    const retried = await retryCoachMessage(conversationId, userMessageId, { customerId });
    expect(retried.run?.status).toBe("completed");
    expect(retried.answer).toBeDefined();
    await clearCoachState(customerId);
  });

  it("preserves a rename made while a Coach run is active", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    let rename: Promise<unknown> | undefined;

    const result = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How can I increase my savings?",
      onStateChange: (state) => {
        if (state === "preparing" && !rename) {
          rename = renameCoachConversation(conversation.id, "My savings review", DEMO_CUSTOMER_A);
        }
      },
    });

    await rename;
    const stored = await getCoachConversation(conversation.id, DEMO_CUSTOMER_A);
    expect(stored?.title).toBe("My savings review");
    expect(stored?.messages.some((message) => message.id === result.answer?.messageId)).toBe(true);
  });

  it("preserves other saved Coach state while a follow-up run is active", async () => {
    await setCoachConsent(DEMO_CUSTOMER_A, "granted");
    const conversation = await createCoachConversation(DEMO_CUSTOMER_A);
    const first = await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "How can I increase my savings?",
    });
    const firstAnswerId = first.answer?.messageId as string;
    let reportSave: Promise<unknown> | undefined;

    await submitCoachMessage({
      customerId: DEMO_CUSTOMER_A,
      conversationId: conversation.id,
      text: "Show the transactions behind this",
      onStateChange: (state) => {
        if (state === "preparing" && !reportSave) {
          reportSave = saveCoachReport(DEMO_CUSTOMER_A, {
            idempotencyKey: "report-during-run",
            conversationId: conversation.id,
            answerMessageId: firstAnswerId,
          });
        }
      },
    });

    await reportSave;
    expect(await listSavedCoachReports(DEMO_CUSTOMER_A)).toEqual([
      expect.objectContaining({ idempotencyKey: "report-during-run" }),
    ]);
    const stored = await getCoachConversation(conversation.id, DEMO_CUSTOMER_A);
    expect(stored?.messages.filter((message) => message.role === "assistant")).toHaveLength(2);
  });
});
