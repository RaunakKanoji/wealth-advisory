import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import {
  createCoachConversation,
  getCoachConsent,
  getCoachConversation,
  retryCoachMessage,
  saveCoachGoal,
  saveCoachReport,
  setCoachConsent,
  stopCoachRun,
  submitCoachMessage,
} from "@/services/wealth-coach-conversation-service";
import type {
  CoachAnswer,
  CoachAnswerBlock,
  CoachConsentStatus,
  CoachConversation,
  CoachMessage,
  CoachSourceReference,
  GoalScenarioOption,
} from "@/types/wealth-coach-conversation";

import { coachColors } from "./tokens";

type CoachConversationScreenProps = {
  conversationId?: string;
  scopeInput?: {
    kind?: "personal" | "account" | "card" | "goal";
    accountId?: string;
    cardId?: string;
    goalId?: string;
  };
};

const progressLabels: Record<string, string> = {
  queued: "Starting the Coach run…",
  retrieving: "Checking the selected transactions…",
  calculating: "Comparing the authorised data…",
  preparing: "Preparing your verified summary…",
};

export function CoachConversationScreen({ conversationId, scopeInput }: CoachConversationScreenProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [conversation, setConversation] = useState<CoachConversation | null>(null);
  const [consent, setConsent] = useState<CoachConsentStatus>("not-requested");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [runState, setRunState] = useState<CoachMessage["status"] | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pendingConsentMessageId, setPendingConsentMessageId] = useState<string | undefined>();
  const [showConsent, setShowConsent] = useState(false);
  const [showScope, setShowScope] = useState(false);
  const [sourceAnswer, setSourceAnswer] = useState<CoachAnswer | undefined>();
  const [savedAnswerIds, setSavedAnswerIds] = useState<string[]>([]);
  const [savedGoalKeys, setSavedGoalKeys] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const shouldStickToBottom = useRef(true);
  const loadedKey = useRef<string | undefined>(undefined);

  const scopeKey = JSON.stringify(scopeInput ?? {});

  useEffect(() => {
    const key = `${customerId}:${conversationId ?? "new"}:${scopeKey}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void Promise.all([
      getCoachConsent(customerId),
      conversationId ? getCoachConversation(conversationId, customerId) : createCoachConversation(customerId, scopeInput),
    ])
      .then(([nextConsent, nextConversation]) => {
        if (cancelled) return;
        setConsent(nextConsent);
        if (!nextConversation) {
          setError("This conversation is unavailable.");
        } else {
          setConversation(nextConversation);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "We could not open Wealth Coach.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, customerId, scopeInput, scopeKey]);

  const messages = conversation?.messages ?? [];
  const latestRun = conversation?.runs[conversation.runs.length - 1];
  const hasMessages = messages.length > 0;

  const send = useCallback(async (textOverride?: string) => {
    if (!conversation || sending) return;
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setSending(true);
    setError(undefined);
    setInput("");
    try {
      const authToken = await getToken();
      const result = await submitCoachMessage({
        customerId,
        conversationId: conversation.id,
        text,
        authToken,
        onRunCreated: setActiveRunId,
        onStateChange: setRunState,
      });
      setConversation(result.conversation);
      setRunState(result.run?.status ?? null);
      if (result.consentRequired) {
        setPendingConsentMessageId(result.userMessageId);
        setShowConsent(true);
      }
    } catch (sendError: unknown) {
      setInput(text);
      setError(sendError instanceof Error ? sendError.message : "We could not send that question.");
    } finally {
      setSending(false);
      setActiveRunId(undefined);
    }
  }, [conversation, customerId, getToken, input, sending]);

  const reviewConsent = useCallback(async (nextStatus: Exclude<CoachConsentStatus, "not-requested">) => {
    setConsent(nextStatus);
    setShowConsent(false);
    await setCoachConsent(customerId, nextStatus);
    if (nextStatus === "granted" && conversation && pendingConsentMessageId) {
      setSending(true);
      setError(undefined);
      try {
        const authToken = await getToken();
        const result = await retryCoachMessage(conversation.id, pendingConsentMessageId, {
          customerId,
          authToken,
          onRunCreated: setActiveRunId,
          onStateChange: setRunState,
        });
        setConversation(result.conversation);
      } catch (retryError: unknown) {
        setError(retryError instanceof Error ? retryError.message : "We could not retry that question.");
      } finally {
        setSending(false);
        setActiveRunId(undefined);
        setPendingConsentMessageId(undefined);
      }
    }
  }, [conversation, customerId, getToken, pendingConsentMessageId]);

  const stop = useCallback(async () => {
    if (!conversation || !activeRunId) return;
    try {
      const stopped = await stopCoachRun(conversation.id, activeRunId, customerId);
      setConversation(stopped);
      setRunState("stopped");
    } catch (stopError: unknown) {
      setError(stopError instanceof Error ? stopError.message : "We could not stop this run.");
    } finally {
      setSending(false);
      setActiveRunId(undefined);
    }
  }, [activeRunId, conversation, customerId]);

  const retry = useCallback(async (messageId: string) => {
    if (!conversation || sending) return;
    setSending(true);
    setError(undefined);
    try {
      const authToken = await getToken();
      const result = await retryCoachMessage(conversation.id, messageId, {
        customerId,
        authToken,
        onRunCreated: setActiveRunId,
        onStateChange: setRunState,
      });
      setConversation(result.conversation);
    } catch (retryError: unknown) {
      setError(retryError instanceof Error ? retryError.message : "We could not retry that response.");
    } finally {
      setSending(false);
      setActiveRunId(undefined);
    }
  }, [conversation, customerId, getToken, sending]);

  const openSource = useCallback((source: CoachSourceReference) => {
    setSourceAnswer(undefined);
    if (source.kind === "transaction" && source.transactionId && source.accountId) {
      router.push({ pathname: "/(app)/activity/[transactionId]", params: { transactionId: source.transactionId, accountId: source.accountId } });
      return;
    }
    if (source.kind === "transaction" && source.transactionId && source.cardId) {
      router.push({ pathname: "/(app)/cards/transaction/[transactionId]", params: { transactionId: source.transactionId, cardId: source.cardId } });
    }
  }, [router]);

  const saveReport = useCallback(async (answer: CoachAnswer) => {
    if (!conversation) return;
    try {
      await saveCoachReport(customerId, {
        idempotencyKey: `${conversation.id}:${answer.messageId}`,
        conversationId: conversation.id,
        answerMessageId: answer.messageId,
      });
      setSavedAnswerIds((ids) => [...new Set([...ids, answer.messageId])]);
    } catch (reportError: unknown) {
      setError(reportError instanceof Error ? reportError.message : "We could not save this summary.");
    }
  }, [conversation, customerId]);

  const saveGoal = useCallback(async (answer: CoachAnswer, option: GoalScenarioOption) => {
    if (!conversation) return;
    const goalBlock = answer.blocks.find((block) => block.type === "goalScenario");
    if (!goalBlock || goalBlock.type !== "goalScenario") return;
    const idempotencyKey = `${conversation.id}:${answer.messageId}:${option.monthlyContributionMinorUnits}`;
    try {
      await saveCoachGoal(customerId, {
        idempotencyKey,
        conversationId: conversation.id,
        sourceAnswerMessageId: answer.messageId,
        name: goalBlock.goal.name,
        targetMinorUnits: goalBlock.goal.targetMinorUnits,
        allocatedMinorUnits: goalBlock.goal.allocatedMinorUnits,
        monthlyContributionMinorUnits: option.monthlyContributionMinorUnits,
        targetDate: goalBlock.goal.targetDate,
      });
      setSavedGoalKeys((keys) => [...new Set([...keys, idempotencyKey])]);
    } catch (goalError: unknown) {
      setError(goalError instanceof Error ? goalError.message : "We could not save this goal draft.");
    }
  }, [conversation, customerId]);

  const scopeDescription = useMemo(() => conversation?.context.scope.label ?? "Selected personal accounts", [conversation]);

  if (loading) {
    return (
      <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
        <View style={styles.loadingState}><ActivityIndicator color={coachColors.brandGreen} /><Text style={styles.loadingText}>Opening Wealth Coach…</Text></View>
      </ScreenContainer>
    );
  }

  if (error && !conversation) {
    return (
      <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
        <View style={styles.errorState}><Text style={styles.errorTitle}>We couldn’t open this conversation</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Coach</Text></Pressable></View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Wealth Coach" onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color={coachColors.textPrimary} /><Text style={styles.headerBackText}>Back to Coach</Text>
            </Pressable>
            <View style={styles.headerMain}>
              <CoachAvatar working={sending} />
              <View style={styles.headerText}><Text style={styles.headerTitle}>Wealth Coach</Text><Text style={styles.headerSubtitle}>{sending ? "Working with selected data" : "AI-assisted · verified banking data"}</Text></View>
              <View style={styles.headerActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Start new Coach conversation" onPress={() => router.push("/(app)/coach/new")} style={styles.iconButton}><Ionicons name="add" size={22} color={coachColors.brandGreen} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Open Coach conversation history" onPress={() => router.push("/(app)/coach/history")} style={styles.iconButton}><Ionicons name="time-outline" size={21} color={coachColors.brandGreen} /></Pressable>
              </View>
            </View>
          </View>

          <View style={styles.scopeBar}>
            <View style={styles.scopeIcon}><Ionicons name="shield-checkmark-outline" size={18} color={coachColors.brandGreen} /></View>
            <View style={styles.scopeText}><Text style={styles.scopeLabel}>Current scope</Text><Text numberOfLines={1} style={styles.scopeValue}>{scopeDescription}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="View Coach data scope" onPress={() => setShowScope(true)}><Text style={styles.scopeAction}>View</Text></Pressable>
          </View>

          {error ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={17} color="#B93A2B" /><Text style={styles.inlineErrorText}>{error}</Text></View> : null}

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              shouldStickToBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (shouldStickToBottom.current) scrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {!hasMessages ? <WelcomeState onAsk={(question) => void send(question)} /> : null}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onOpenSources={setSourceAnswer}
                onOpenSource={openSource}
                onRetry={() => void retry(message.id)}
                onSaveReport={saveReport}
                onSaveGoal={saveGoal}
                savedAnswerIds={savedAnswerIds}
                savedGoalKeys={savedGoalKeys}
                onFollowUp={(question) => void send(question)}
              />
            ))}
            {sending && runState && progressLabels[runState] ? <View style={styles.progressRow}><ActivityIndicator size="small" color={coachColors.brandGreen} /><Text style={styles.progressText}>{progressLabels[runState]}</Text></View> : null}
            {runState === "stopped" && !sending ? <Text style={styles.stoppedText}>This run was stopped. Nothing was saved or sent.</Text> : null}
          </ScrollView>

          <View style={styles.composerWrap}>
            {latestRun?.status === "failed" && !sending ? <Pressable onPress={() => { const userMessageId = latestRun.userMessageId; void retry(userMessageId); }} style={styles.retryBanner}><Ionicons name="refresh-outline" size={17} color={coachColors.brandGreen} /><Text style={styles.retryText}>Retry the last response</Text></Pressable> : null}
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Ask Wealth Coach a question"
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your spending, savings, or goals…"
                placeholderTextColor={coachColors.textMuted}
                multiline
                maxLength={1200}
                editable={!sending}
                style={styles.input}
                onSubmitEditing={(event) => {
                  if (!event.nativeEvent.text.includes("\n")) void send();
                }}
              />
              {sending ? <Pressable accessibilityRole="button" accessibilityLabel="Stop Coach response" onPress={() => void stop()} style={styles.stopButton}><Ionicons name="stop" size={17} color="#B93A2B" /><Text style={styles.stopText}>Stop</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={!input.trim()} onPress={() => void send()} style={[styles.sendButton, !input.trim() && styles.disabledButton]}><Ionicons name="arrow-up" size={20} color="#FFFFFF" /></Pressable>}
            </View>
            <Text style={styles.composerHint}>Never enter your PIN, password, OTP, or full card number. Voice input is unavailable in this demo.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showConsent} transparent animationType="slide" onRequestClose={() => setShowConsent(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><CoachAvatar /><Text style={styles.modalTitle}>Review Coach personalisation</Text><Text style={styles.modalText}>To answer this personal question, Coach needs permission to read the selected transaction data. Banking access remains separate, and this does not include marketing or voice permission.</Text><View style={styles.permissionRow}><Ionicons name="checkmark-circle-outline" size={20} color={coachColors.brandGreen} /><Text style={styles.permissionText}>{scopeDescription}</Text></View><View style={styles.permissionRow}><Ionicons name="time-outline" size={20} color={coachColors.brandGreen} /><Text style={styles.permissionText}>Demo data as of 6 Sep 2026; pending and failed rows stay separate.</Text></View><Pressable accessibilityRole="button" onPress={() => void reviewConsent("granted")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Enable Coach personalisation</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void reviewConsent("declined")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Not now</Text></Pressable></View></View>
      </Modal>

      <Modal visible={showScope} transparent animationType="slide" onRequestClose={() => setShowScope(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Current data scope</Text><Text style={styles.modalText}>Only resources owned by this signed-in customer and validated by the shared banking services can be used.</Text><Text style={styles.scopeModalLabel}>Included resources</Text><Text style={styles.scopeModalValue}>{scopeDescription}</Text><Text style={styles.scopeModalLabel}>Source</Text><Text style={styles.scopeModalValue}>Demo data · latest successful update 6 Sep 2026</Text><Text style={styles.scopeModalLabel}>Coach personalisation</Text><Text style={styles.scopeModalValue}>{consent === "granted" ? "Enabled for this customer" : consent === "declined" ? "Not enabled; personal retrieval is blocked" : "Not reviewed"}</Text><Text style={styles.scopeModalNote}>Answers show their assumptions, limitations, calculation version, and supporting sources. Conversation summaries are not bank records.</Text><Pressable onPress={() => setShowScope(false)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable></View></View>
      </Modal>

      <Modal visible={Boolean(sourceAnswer)} transparent animationType="slide" onRequestClose={() => setSourceAnswer(undefined)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>How this was calculated</Text><Text style={styles.modalText}>Sources are scoped to this answer and are labelled Demo data. Open a row to inspect it in the existing banking detail screen.</Text><ScrollView style={styles.sourceList}>{sourceAnswer?.sourceReferences.map((source) => <Pressable key={source.id} onPress={() => openSource(source)} disabled={source.kind !== "transaction"} style={styles.sourceRow}><View style={styles.sourceRowIcon}><Ionicons name={source.kind === "transaction" ? "receipt-outline" : source.kind === "calculation" ? "calculator-outline" : "shield-checkmark-outline"} size={17} color={coachColors.brandGreen} /></View><View style={styles.sourceRowText}><Text style={styles.sourceTitle}>{source.label}</Text><Text style={styles.sourceMeta}>{source.kind === "calculation" ? "Calculation reference" : source.kind === "transaction" ? "Open transaction" : "Authorised resource"}</Text></View>{source.kind === "transaction" ? <Ionicons name="chevron-forward" size={17} color={coachColors.textMuted} /> : null}</Pressable>)}</ScrollView><Pressable onPress={() => setSourceAnswer(undefined)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Close</Text></Pressable></View></View>
      </Modal>
    </ScreenContainer>
  );
}

function CoachAvatar({ working = false }: { working?: boolean }) {
  return <View accessibilityLabel={working ? "Wealth Coach working" : "Wealth Coach idle"} style={[styles.avatar, working && styles.avatarWorking]}><Ionicons name="sparkles-outline" size={18} color={coachColors.brandGreen} /></View>;
}

function WelcomeState({ onAsk }: { onAsk: (question: string) => void }) {
  const questions = ["Where did my money go this month?", "What changed in my Food & Dining spending?", "Help me plan an emergency fund.", "How are my goals progressing?"];
  return <View style={styles.welcome}><CoachAvatar /><Text style={styles.welcomeTitle}>Let’s understand your money.</Text><Text style={styles.welcomeText}>Ask about spending, saving, or a financial goal. I’ll show the scope and sources behind personal answers.</Text><View style={styles.questionList}>{questions.map((question) => <Pressable key={question} onPress={() => onAsk(question)} style={({ pressed }) => [styles.questionButton, pressed && styles.pressed]}><Text style={styles.questionText}>{question}</Text><Ionicons name="arrow-forward" size={17} color={coachColors.brandGreen} /></Pressable>)}</View></View>;
}

type MessageBubbleProps = {
  message: CoachMessage;
  onOpenSources: (answer: CoachAnswer) => void;
  onOpenSource: (source: CoachSourceReference) => void;
  onRetry: () => void;
  onSaveReport: (answer: CoachAnswer) => void;
  onSaveGoal: (answer: CoachAnswer, option: GoalScenarioOption) => void;
  savedAnswerIds: string[];
  savedGoalKeys: string[];
  onFollowUp: (question: string) => void;
};

function MessageBubble({ message, onOpenSources, onOpenSource, onRetry, onSaveReport, onSaveGoal, savedAnswerIds, savedGoalKeys, onFollowUp }: MessageBubbleProps) {
  if (message.role === "user") return <View style={styles.userMessageWrap}><View style={styles.userBubble}><Text style={styles.userText}>{message.content}</Text></View></View>;
  return <View style={styles.assistantMessage}><View style={styles.assistantHeading}><CoachAvatar /><Text style={styles.assistantLabel}>Wealth Coach</Text></View><View style={styles.assistantBody}><Text style={styles.assistantText}>{message.content}</Text>{message.answer?.blocks.filter((block) => block.type !== "text").map((block) => <AnswerBlock key={block.id} block={block} answer={message.answer as CoachAnswer} onOpenSources={onOpenSources} onOpenSource={onOpenSource} onSaveGoal={onSaveGoal} savedGoalKeys={savedGoalKeys} onFollowUp={onFollowUp} />)}{message.answer ? <View style={styles.answerActions}><Pressable onPress={() => onOpenSources(message.answer as CoachAnswer)} style={styles.answerAction}><Ionicons name="reader-outline" size={16} color={coachColors.brandGreen} /><Text style={styles.answerActionText}>Sources</Text></Pressable><Pressable onPress={() => onSaveReport(message.answer as CoachAnswer)} disabled={savedAnswerIds.includes(message.answer.messageId)} style={styles.answerAction}><Ionicons name={savedAnswerIds.includes(message.answer.messageId) ? "checkmark-circle-outline" : "bookmark-outline"} size={16} color={coachColors.brandGreen} /><Text style={styles.answerActionText}>{savedAnswerIds.includes(message.answer.messageId) ? "Saved" : "Save summary"}</Text></Pressable></View> : null}{message.status === "failed" ? <Pressable onPress={onRetry} style={styles.failedRetry}><Ionicons name="refresh-outline" size={16} color="#B93A2B" /><Text style={styles.failedRetryText}>Retry</Text></Pressable> : null}</View></View>;
}

function AnswerBlock({ block, answer, onOpenSources, onOpenSource, onSaveGoal, savedGoalKeys, onFollowUp }: { block: Exclude<CoachAnswerBlock, { type: "text" }>; answer: CoachAnswer; onOpenSources: (answer: CoachAnswer) => void; onOpenSource: (source: CoachSourceReference) => void; onSaveGoal: (answer: CoachAnswer, option: GoalScenarioOption) => void; savedGoalKeys: string[]; onFollowUp: (question: string) => void }) {
  if (block.type === "spendingComparison") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.categoryLabel}</Text><View style={styles.metricRow}><Metric label="Current" value={formatIndianMinorUnits(block.current.amountMinorUnits)} detail={block.current.period.label.split(" · ")[1]} /><Metric label="Previous" value={formatIndianMinorUnits(block.previous.amountMinorUnits)} detail={block.previous.period.label.split(" · ")[1]} /><Metric label="Change" value={`${block.differenceMinorUnits >= 0 ? "+" : "−"}${formatIndianMinorUnits(Math.abs(block.differenceMinorUnits))}`} detail={block.percentageChange === undefined ? "Baseline zero" : `${Math.abs(block.percentageChange)}%`} /></View>{block.pendingMinorUnits || block.failedMinorUnits ? <Text style={styles.cardNote}>Pending/failed rows are separate from this posted total.</Text> : null}</View>;
  if (block.type === "categoryBreakdown") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>Spending breakdown · {block.period.label.split(" · ")[1]}</Text>{block.items.map((item) => <View key={item.category} style={styles.breakdownRow}><Text style={styles.breakdownLabel}>{item.label}</Text><Text style={styles.breakdownAmount}>{formatIndianMinorUnits(item.amountMinorUnits)}</Text><Text style={styles.breakdownCount}>{item.count} posted</Text></View>)}</View>;
  if (block.type === "transactionList") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.title}</Text>{block.items.map((item) => <Pressable key={item.id} onPress={() => { const source = answer.sourceReferences.find((reference) => reference.id === item.sourceReferenceId); if (source) onOpenSource(source); }} style={styles.transactionItem}><View style={styles.transactionItemText}><Text numberOfLines={1} style={styles.transactionLabel}>{item.label}</Text><Text style={styles.transactionMeta}>{item.date} · {item.status}</Text></View><Text style={styles.transactionAmount}>{item.direction === "credit" ? "+" : "−"}{formatIndianMinorUnits(item.amountMinorUnits)}</Text><Ionicons name="chevron-forward" size={17} color={coachColors.textMuted} /></Pressable>)}</View>;
  if (block.type === "goalScenario") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.goal.name} · no-growth plan</Text><Text style={styles.cardNote}>{formatIndianMinorUnits(block.goal.targetMinorUnits)} target · {formatIndianMinorUnits(block.goal.allocatedMinorUnits)} allocated · {formatIndianMinorUnits(block.goal.remainingMinorUnits)} remaining</Text>{block.options.map((option) => { const key = `${answer.conversationId}:${answer.messageId}:${option.monthlyContributionMinorUnits}`; const saved = savedGoalKeys.includes(key); return <View key={option.monthlyContributionMinorUnits} style={styles.goalOption}><View style={styles.goalOptionText}><Text style={styles.goalOptionTitle}>{option.label}</Text><Text style={styles.goalOptionMeta}>Final contribution {formatIndianMinorUnits(option.finalContributionMinorUnits)}</Text></View><Pressable onPress={() => onSaveGoal(answer, option)} disabled={saved} style={[styles.smallButton, saved && styles.savedButton]}><Text style={styles.smallButtonText}>{saved ? "Saved" : "Save goal"}</Text></Pressable></View>; })}<Text style={styles.cardNote}>Saving creates a planning goal draft only. It does not move or reserve money.</Text></View>;
  if (block.type === "goalProgress") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.name}</Text><Text style={styles.cardNote}>{formatIndianMinorUnits(block.currentMinorUnits)} of {formatIndianMinorUnits(block.targetMinorUnits)} · {block.progressPercentage}%</Text></View>;
  if (block.type === "dataUnavailable") return <View style={styles.unavailableCard}><Ionicons name="information-circle-outline" size={19} color="#9A6B17" /><View style={styles.unavailableText}><Text style={styles.responseCardTitle}>{block.title}</Text><Text style={styles.cardNote}>{block.reason}</Text></View></View>;
  if (block.type === "clarification") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.question}</Text>{block.options.map((option) => <Pressable key={option} onPress={() => onFollowUp(option)} style={styles.questionButton}><Text style={styles.questionText}>{option}</Text><Ionicons name="arrow-forward" size={17} color={coachColors.brandGreen} /></Pressable>)}</View>;
  if (block.type === "metricSummary") return <View style={styles.responseCard}>{block.metrics.map((metric) => <Metric key={metric.key} label={metric.label} value={metric.displayValue} detail={metric.unit} />)}</View>;
  return null;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  headerBack: { minHeight: 36, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  headerBackText: { marginLeft: 2, color: coachColors.textPrimary, fontSize: 15, fontWeight: "600" },
  headerMain: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  avatar: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: coachColors.brandGreenSoft },
  avatarWorking: { backgroundColor: coachColors.brandOrangeSoft },
  headerText: { flex: 1, minWidth: 0, marginLeft: 10 },
  headerTitle: { color: coachColors.textPrimary, fontSize: 17, fontWeight: "700" },
  headerSubtitle: { marginTop: 2, color: coachColors.textSecondary, fontSize: 11 },
  headerActions: { flexDirection: "row", columnGap: 2 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  scopeBar: { marginHorizontal: 16, marginTop: 10, padding: 10, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  scopeIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: coachColors.brandGreenSoft },
  scopeText: { flex: 1, minWidth: 0, marginLeft: 9 },
  scopeLabel: { color: coachColors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  scopeValue: { marginTop: 2, color: coachColors.textPrimary, fontSize: 13, fontWeight: "600" },
  scopeAction: { paddingHorizontal: 5, color: coachColors.brandGreen, fontSize: 13, fontWeight: "700" },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  welcome: { alignItems: "center", paddingTop: 12, paddingBottom: 12 },
  welcomeTitle: { marginTop: 12, color: coachColors.textPrimary, fontSize: 22, lineHeight: 29, fontWeight: "700", textAlign: "center" },
  welcomeText: { maxWidth: 460, marginTop: 7, color: coachColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  questionList: { width: "100%", maxWidth: 560, marginTop: 18, rowGap: 8 },
  questionButton: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  questionText: { flex: 1, color: coachColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  userMessageWrap: { alignItems: "flex-end", marginVertical: 5 },
  userBubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 17, borderBottomRightRadius: 5, backgroundColor: coachColors.brandGreen },
  userText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20 },
  assistantMessage: { marginVertical: 8 },
  assistantHeading: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  assistantLabel: { marginLeft: 8, color: coachColors.textSecondary, fontSize: 12, fontWeight: "700" },
  assistantBody: { paddingLeft: 44 },
  assistantText: { color: coachColors.textPrimary, fontSize: 15, lineHeight: 22 },
  responseCard: { marginTop: 11, padding: 13, borderRadius: 15, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  responseCardTitle: { color: coachColors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  metricRow: { flexDirection: "row", marginTop: 13, columnGap: 8 },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { color: coachColors.textSecondary, fontSize: 11, fontWeight: "600" },
  metricValue: { marginTop: 3, color: coachColors.textPrimary, fontSize: 14, fontWeight: "700" },
  metricDetail: { marginTop: 2, color: coachColors.textMuted, fontSize: 10, lineHeight: 14 },
  cardNote: { marginTop: 9, color: coachColors.textSecondary, fontSize: 12, lineHeight: 17 },
  breakdownRow: { minHeight: 37, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  breakdownLabel: { flex: 1, color: coachColors.textPrimary, fontSize: 13 },
  breakdownAmount: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "700" },
  breakdownCount: { width: 65, marginLeft: 8, color: coachColors.textMuted, fontSize: 10, textAlign: "right" },
  transactionItem: { minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  transactionItemText: { flex: 1, minWidth: 0, marginRight: 8 },
  transactionLabel: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "600" },
  transactionMeta: { marginTop: 2, color: coachColors.textMuted, fontSize: 10 },
  transactionAmount: { marginRight: 8, color: coachColors.textPrimary, fontSize: 12, fontWeight: "700" },
  goalOption: { minHeight: 55, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  goalOptionText: { flex: 1, minWidth: 0 },
  goalOptionTitle: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "700" },
  goalOptionMeta: { marginTop: 2, color: coachColors.textSecondary, fontSize: 11 },
  smallButton: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: coachColors.brandGreen },
  savedButton: { backgroundColor: "#B9D9D0" },
  smallButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  unavailableCard: { marginTop: 11, padding: 13, flexDirection: "row", borderRadius: 15, backgroundColor: "#FFF8E7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#F0D99A" },
  unavailableText: { flex: 1, marginLeft: 9 },
  answerActions: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8, marginTop: 12 },
  answerAction: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  answerActionText: { marginLeft: 5, color: coachColors.brandGreen, fontSize: 12, fontWeight: "700" },
  failedRetry: { alignSelf: "flex-start", minHeight: 34, marginTop: 9, flexDirection: "row", alignItems: "center" },
  failedRetryText: { marginLeft: 5, color: "#B93A2B", fontSize: 12, fontWeight: "700" },
  progressRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  progressText: { marginLeft: 8, color: coachColors.textSecondary, fontSize: 12 },
  stoppedText: { paddingVertical: 8, color: coachColors.textMuted, fontSize: 12, fontStyle: "italic" },
  composerWrap: { paddingHorizontal: 16, paddingTop: 7, paddingBottom: 4, backgroundColor: coachColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: coachColors.divider },
  composer: { minHeight: 48, maxHeight: 120, flexDirection: "row", alignItems: "flex-end", paddingLeft: 13, paddingRight: 6, paddingVertical: 5, borderRadius: 18, backgroundColor: coachColors.surface, borderWidth: 1, borderColor: coachColors.border },
  input: { flex: 1, minHeight: 36, maxHeight: 105, paddingTop: 8, paddingBottom: 7, color: coachColors.textPrimary, fontSize: 14, lineHeight: 20 },
  sendButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: coachColors.brandGreen },
  disabledButton: { backgroundColor: "#B8C8C3" },
  stopButton: { height: 36, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FDEBE8" },
  stopText: { marginLeft: 4, color: "#B93A2B", fontSize: 12, fontWeight: "700" },
  composerHint: { paddingHorizontal: 2, paddingTop: 5, color: coachColors.textMuted, fontSize: 10, lineHeight: 14 },
  retryBanner: { alignSelf: "flex-start", minHeight: 34, marginBottom: 5, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  retryText: { marginLeft: 5, color: coachColors.brandGreen, fontSize: 12, fontWeight: "700" },
  inlineError: { marginHorizontal: 16, marginTop: 8, padding: 9, flexDirection: "row", alignItems: "center", borderRadius: 10, backgroundColor: "#FDEBE8" },
  inlineErrorText: { flex: 1, marginLeft: 6, color: "#9C3327", fontSize: 12, lineHeight: 17 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: coachColors.textSecondary, fontSize: 14 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { color: coachColors.textPrimary, fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorText: { marginTop: 8, color: coachColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  primaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: coachColors.brandGreen },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "center" },
  secondaryButton: { minHeight: 40, marginTop: 7, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: coachColors.brandGreen, fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.42)" },
  modalCard: { maxHeight: "88%", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: coachColors.surface },
  modalHandle: { width: 38, height: 4, alignSelf: "center", marginBottom: 15, borderRadius: 2, backgroundColor: coachColors.border },
  modalTitle: { marginTop: 12, color: coachColors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: "700" },
  modalText: { marginTop: 8, color: coachColors.textSecondary, fontSize: 14, lineHeight: 21 },
  permissionRow: { marginTop: 13, flexDirection: "row", alignItems: "flex-start" },
  permissionText: { flex: 1, marginLeft: 8, color: coachColors.textPrimary, fontSize: 13, lineHeight: 19 },
  scopeModalLabel: { marginTop: 18, color: coachColors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  scopeModalValue: { marginTop: 4, color: coachColors.textPrimary, fontSize: 14, lineHeight: 20 },
  scopeModalNote: { marginTop: 18, color: coachColors.textSecondary, fontSize: 12, lineHeight: 18 },
  sourceList: { maxHeight: 330, marginTop: 14 },
  sourceRow: { minHeight: 53, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  sourceRowIcon: { width: 31, height: 31, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: coachColors.brandGreenSoft },
  sourceRowText: { flex: 1, minWidth: 0, marginLeft: 9 },
  sourceTitle: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "600" },
  sourceMeta: { marginTop: 2, color: coachColors.textMuted, fontSize: 11 },
  pressed: { opacity: 0.7 },
});
