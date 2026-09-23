import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { ProgressBar } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import { isRemoteCoachEnabled, isRemoteDataEnabled } from "@/lib/env";
import { privacySafeFinancialText } from "@/lib/privacy";
import { useDemoSession } from "@/lib/demo-session";
import {
  createCoachConversation,
  deleteCoachConversation,
  getCoachConsent,
  getCoachConversation,
  recordCoachConsentDeclined,
  retryCoachMessage,
  saveCoachGoal,
  saveCoachReport,
  setCoachConsent,
  stopCoachRun,
  submitCoachMessage,
} from "@/services/wealth-coach-conversation-service";
import type { CoachConversationContextInput } from "@/services/wealth-coach-conversation-service";
import type {
  CoachAnswer,
  CoachAnswerBlock,
  CoachConsentStatus,
  CoachConversation,
  CoachMessage,
  CoachSourceReference,
  GoalScenarioOption,
} from "@/types/wealth-coach-conversation";

import { activeCoachRun, claimCoachSubmitIntent, pendingConsentUserMessageId, retryUserMessageId } from "./coach-conversation-utils";
import { RemoteCoachConversationScreen } from "./remote-coach-conversation-screen";
import { coachColors } from "./tokens";

type CoachConversationScreenProps = {
  conversationId?: string;
  initialPrompt?: string;
  autoSubmitIntentId?: string;
  scopeInput?: {
    kind?: "personal" | "account" | "card" | "goal";
    accountId?: string;
    cardId?: string;
    goalId?: string;
  };
  contextInput?: CoachConversationContextInput;
};

const progressLabels: Record<string, string> = {
  queued: "Starting the Coach run…",
  retrieving: "Checking the selected transactions…",
  calculating: "Comparing the authorised data…",
  preparing: "Preparing your verified summary…",
};
const RUN_POLL_INTERVAL_MS = 400;

export function CoachConversationScreen(props: CoachConversationScreenProps) {
  if (isRemoteCoachEnabled) {
    return (
      <RemoteCoachConversationScreen
        conversationId={props.conversationId}
        initialPrompt={props.initialPrompt}
        autoSubmitIntentId={props.autoSubmitIntentId}
        scopeInput={props.scopeInput}
        contextInput={props.contextInput}
      />
    );
  }

  if (isRemoteDataEnabled) {
    return <LocalCoachDemoGate {...props} />;
  }

  return <LocalCoachConversationScreen {...props} />;
}

function LocalCoachDemoGate(props: CoachConversationScreenProps) {
  const router = useRouter();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [acceptedCustomerId, setAcceptedCustomerId] = useState<string>();

  if (acceptedCustomerId === customerId) return <LocalCoachConversationScreen {...props} />;

  return (
    <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
      <View style={styles.errorState}>
        <View style={styles.demoGateIcon}>
          <Ionicons name="flask-outline" size={26} color={coachColors.brandGreen} />
        </View>
        <Text accessibilityRole="header" style={styles.errorTitle}>Coach preview uses sample data</Text>
        <Text style={styles.errorText}>Live Coach analysis is not enabled for this banking connection yet. The preview will use clearly labelled sample accounts and will not analyse your live balances or transactions.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue to the sample Coach preview" onPress={() => setAcceptedCustomerId(customerId)} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Continue with sample data</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back without opening the Coach preview" onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/coach")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function LocalCoachConversationScreen({ conversationId, initialPrompt, autoSubmitIntentId, scopeInput, contextInput }: CoachConversationScreenProps) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const { balanceVisible } = useBalanceVisibility(customerId, isDemoUserReady);
  const [conversation, setConversation] = useState<CoachConversation | null>(null);
  const [consent, setConsent] = useState<CoachConsentStatus>("not-requested");
  const [input, setInput] = useState(initialPrompt ?? "");
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
  const [stateCustomerId, setStateCustomerId] = useState(customerId);
  const scrollRef = useRef<FlatList<CoachMessage>>(null);
  const shouldStickToBottom = useRef(true);
  const loadedKey = useRef<string | undefined>(undefined);
  const activeCustomerId = useRef<string | undefined>(isDemoUserReady ? customerId : undefined);
  const operationGeneration = useRef(0);
  const allowRoutePrompt = useRef(true);
  if (isDemoUserReady) {
    if (activeCustomerId.current === undefined) {
      activeCustomerId.current = customerId;
    } else if (activeCustomerId.current !== customerId) {
      activeCustomerId.current = customerId;
      operationGeneration.current += 1;
      allowRoutePrompt.current = false;
    }
  }

  const isCurrentCustomer = stateCustomerId === customerId;
  const visibleConversation = isCurrentCustomer ? conversation : null;
  const visibleError = isCurrentCustomer ? error : undefined;
  const visibleLoading = !isCurrentCustomer || loading;

  const scopeKey = JSON.stringify({ scopeInput, contextInput });

  useEffect(() => {
    if (!isDemoUserReady) return;
    const key = `${customerId}:${conversationId ?? "new"}:${scopeKey}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    let cancelled = false;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const isActiveRequest = () => !cancelled
      && activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    setLoading(true);
    setError(undefined);
    setInput(allowRoutePrompt.current ? initialPrompt ?? "" : "");
    setConversation(null);
    setSending(false);
    setRunState(null);
    setActiveRunId(undefined);
    setPendingConsentMessageId(undefined);
    setShowConsent(false);
    setShowScope(false);
    setSourceAnswer(undefined);
    setSavedAnswerIds([]);
    setSavedGoalKeys([]);
    const conversationRequest = conversationId
      ? Promise.all([getCoachConsent(requestedCustomerId), getCoachConversation(conversationId, requestedCustomerId)])
      : getCoachConsent(requestedCustomerId).then((nextConsent) => [nextConsent, undefined] as const);
    void conversationRequest
      .then(([nextConsent, nextConversation]) => {
        if (!isActiveRequest()) return;
        setStateCustomerId(requestedCustomerId);
        setConsent(nextConsent);
        if (conversationId && !nextConversation) {
          setError("This conversation is unavailable.");
        } else {
          setConversation(nextConversation ?? null);
          const consentMessageId = pendingConsentUserMessageId(nextConversation);
          setPendingConsentMessageId(consentMessageId);
          setShowConsent(Boolean(consentMessageId && nextConsent === "not-requested"));
          const hydratedRun = activeCoachRun(nextConversation);
          if (hydratedRun) {
            setSending(true);
            setRunState(hydratedRun.status);
            setActiveRunId(hydratedRun.id);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (!isActiveRequest()) return;
        setStateCustomerId(requestedCustomerId);
        setError(loadError instanceof Error ? loadError.message : "We could not open Wealth Coach.");
      })
      .finally(() => {
        if (isActiveRequest()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, contextInput, customerId, initialPrompt, isDemoUserReady, scopeInput, scopeKey]);

  const messages = visibleConversation?.messages ?? [];
  const latestRun = visibleConversation?.runs[visibleConversation.runs.length - 1];
  const persistedActiveRun = activeCoachRun(visibleConversation);
  const visibleConversationId = visibleConversation?.id;
  const persistedActiveRunId = persistedActiveRun?.id;

  useEffect(() => {
    if (!isDemoUserReady || !visibleConversationId || !persistedActiveRunId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const conversationToPoll = visibleConversationId;
    const isActiveRequest = () => !cancelled
      && activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    const schedulePoll = () => {
      pollTimer = setTimeout(() => void poll(), RUN_POLL_INTERVAL_MS);
    };
    const poll = async () => {
      try {
        const refreshed = await getCoachConversation(conversationToPoll, requestedCustomerId);
        if (!isActiveRequest()) return;
        if (!refreshed) {
          setConversation(null);
          setSending(false);
          setRunState(null);
          setActiveRunId(undefined);
          setError("This conversation is unavailable.");
          return;
        }
        setConversation(refreshed);
        const refreshedActiveRun = activeCoachRun(refreshed);
        if (refreshedActiveRun) {
          setSending(true);
          setRunState(refreshedActiveRun.status);
          setActiveRunId(refreshedActiveRun.id);
          schedulePoll();
          return;
        }
        setSending(false);
        setRunState(refreshed.runs[refreshed.runs.length - 1]?.status === "stopped" ? "stopped" : null);
        setActiveRunId(undefined);
      } catch (pollError: unknown) {
        if (!isActiveRequest()) return;
        setError(pollError instanceof Error ? pollError.message : "We could not refresh this Coach response.");
        schedulePoll();
      }
    };
    schedulePoll();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [customerId, isDemoUserReady, persistedActiveRunId, visibleConversationId]);

  const send = useCallback(async (textOverride?: string) => {
    if (sending) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const isActiveRequest = () => activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setSending(true);
    setError(undefined);
    setInput("");
    let activeConversation = visibleConversation;
    let createdForMessage = false;
    try {
      if (!activeConversation) {
        activeConversation = await createCoachConversation(requestedCustomerId, scopeInput, contextInput);
        if (!isActiveRequest()) return;
        createdForMessage = true;
        setConversation(activeConversation);
      }
      const result = await submitCoachMessage({
        customerId: requestedCustomerId,
        conversationId: activeConversation.id,
        text,
        onRunCreated: (runId) => { if (isActiveRequest()) setActiveRunId(runId); },
        onStateChange: (state) => { if (isActiveRequest()) setRunState(state); },
      });
      if (!isActiveRequest()) return;
      setConversation(result.conversation);
      setRunState(result.run?.status ?? null);
      if (result.consentRequired) {
        setPendingConsentMessageId(result.userMessageId);
        setShowConsent(true);
      }
    } catch (sendError: unknown) {
      if (!isActiveRequest()) return;
      if (createdForMessage && activeConversation?.messages.length === 0) {
        await deleteCoachConversation(activeConversation.id, requestedCustomerId).catch(() => undefined);
        if (!isActiveRequest()) return;
        setConversation(null);
      }
      setInput(text);
      setError(sendError instanceof Error ? sendError.message : "We could not send that question.");
    } finally {
      if (isActiveRequest()) {
        setSending(false);
        setActiveRunId(undefined);
      }
    }
  }, [contextInput, customerId, input, scopeInput, sending, visibleConversation]);

  const reviewConsent = useCallback(async (nextStatus: Exclude<CoachConsentStatus, "not-requested">) => {
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const previousConsent = consent;
    const isActiveRequest = () => activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    setConsent(nextStatus);
    setShowConsent(false);
    setError(undefined);
    setSending(true);
    try {
      await setCoachConsent(requestedCustomerId, nextStatus);
    } catch (consentError: unknown) {
      if (!isActiveRequest()) return;
      setConsent(previousConsent);
      setShowConsent(true);
      setSending(false);
      setError(consentError instanceof Error ? consentError.message : "We could not save your Coach personalisation choice. Please try again.");
      return;
    }
    if (!isActiveRequest()) return;
    if (nextStatus === "declined") {
      try {
        if (visibleConversation && pendingConsentMessageId) {
          const nextConversation = await recordCoachConsentDeclined(
            visibleConversation.id,
            pendingConsentMessageId,
            requestedCustomerId,
          );
          if (!isActiveRequest()) return;
          setConversation(nextConversation);
          setPendingConsentMessageId(undefined);
        }
      } catch (declineError: unknown) {
        if (!isActiveRequest()) return;
        setError(declineError instanceof Error ? declineError.message : "We could not finish that Coach response. Please try again.");
      } finally {
        if (isActiveRequest()) setSending(false);
      }
      return;
    }
    if (nextStatus === "granted" && visibleConversation && pendingConsentMessageId) {
      setError(undefined);
      try {
        const result = await retryCoachMessage(visibleConversation.id, pendingConsentMessageId, {
          customerId: requestedCustomerId,
          onRunCreated: (runId) => { if (isActiveRequest()) setActiveRunId(runId); },
          onStateChange: (state) => { if (isActiveRequest()) setRunState(state); },
        });
        if (!isActiveRequest()) return;
        setConversation(result.conversation);
      } catch (retryError: unknown) {
        if (!isActiveRequest()) return;
        setError(retryError instanceof Error ? retryError.message : "We could not retry that question.");
      } finally {
        if (isActiveRequest()) {
          setSending(false);
          setActiveRunId(undefined);
          setPendingConsentMessageId(undefined);
        }
      }
      return;
    }
    setSending(false);
  }, [consent, customerId, pendingConsentMessageId, visibleConversation]);

  const stop = useCallback(async () => {
    if (!visibleConversation || !activeRunId) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const isActiveRequest = () => activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    try {
      const stopped = await stopCoachRun(visibleConversation.id, activeRunId, requestedCustomerId);
      if (!isActiveRequest()) return;
      setConversation(stopped);
      setRunState("stopped");
    } catch (stopError: unknown) {
      if (!isActiveRequest()) return;
      setError(stopError instanceof Error ? stopError.message : "We could not stop this run.");
    } finally {
      if (isActiveRequest()) {
        setSending(false);
        setActiveRunId(undefined);
      }
    }
  }, [activeRunId, customerId, visibleConversation]);

  const retry = useCallback(async (messageId: string) => {
    if (!visibleConversation || sending) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const isActiveRequest = () => activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    setSending(true);
    setError(undefined);
    try {
      const result = await retryCoachMessage(visibleConversation.id, messageId, {
        customerId: requestedCustomerId,
        onRunCreated: (runId) => { if (isActiveRequest()) setActiveRunId(runId); },
        onStateChange: (state) => { if (isActiveRequest()) setRunState(state); },
      });
      if (!isActiveRequest()) return;
      setConversation(result.conversation);
    } catch (retryError: unknown) {
      if (!isActiveRequest()) return;
      setError(retryError instanceof Error ? retryError.message : "We could not retry that response.");
    } finally {
      if (isActiveRequest()) {
        setSending(false);
        setActiveRunId(undefined);
      }
    }
  }, [customerId, sending, visibleConversation]);

  useEffect(() => {
    if (!isDemoUserReady || !autoSubmitIntentId || !initialPrompt || conversationId || visibleLoading || sending || visibleConversation || !allowRoutePrompt.current) return;
    if (!claimCoachSubmitIntent(customerId, autoSubmitIntentId)) return;
    void send(initialPrompt);
  }, [autoSubmitIntentId, conversationId, customerId, initialPrompt, isDemoUserReady, send, sending, visibleConversation, visibleLoading]);

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
    if (!visibleConversation) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    try {
      await saveCoachReport(requestedCustomerId, {
        idempotencyKey: `${visibleConversation.id}:${answer.messageId}`,
        conversationId: visibleConversation.id,
        answerMessageId: answer.messageId,
      });
      if (activeCustomerId.current !== requestedCustomerId || operationGeneration.current !== generation) return;
      setSavedAnswerIds((ids) => [...new Set([...ids, answer.messageId])]);
    } catch (reportError: unknown) {
      if (activeCustomerId.current !== requestedCustomerId || operationGeneration.current !== generation) return;
      setError(reportError instanceof Error ? reportError.message : "We could not save this summary.");
    }
  }, [customerId, visibleConversation]);

  const saveGoal = useCallback(async (answer: CoachAnswer, option: GoalScenarioOption) => {
    if (!visibleConversation) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const goalBlock = answer.blocks.find((block) => block.type === "goalScenario");
    if (!goalBlock || goalBlock.type !== "goalScenario") return;
    const idempotencyKey = `${visibleConversation.id}:${answer.messageId}:${option.monthlyContributionMinorUnits}`;
    try {
      await saveCoachGoal(requestedCustomerId, {
        idempotencyKey,
        conversationId: visibleConversation.id,
        sourceAnswerMessageId: answer.messageId,
        name: goalBlock.goal.name,
        targetMinorUnits: goalBlock.goal.targetMinorUnits,
        allocatedMinorUnits: goalBlock.goal.allocatedMinorUnits,
        monthlyContributionMinorUnits: option.monthlyContributionMinorUnits,
        targetDate: goalBlock.goal.targetDate,
      });
      if (activeCustomerId.current !== requestedCustomerId || operationGeneration.current !== generation) return;
      setSavedGoalKeys((keys) => [...new Set([...keys, idempotencyKey])]);
    } catch (goalError: unknown) {
      if (activeCustomerId.current !== requestedCustomerId || operationGeneration.current !== generation) return;
      setError(goalError instanceof Error ? goalError.message : "We could not save this goal draft.");
    }
  }, [customerId, visibleConversation]);

  const scopeDescription = useMemo(() => visibleConversation?.context.scope.label ?? "Selected personal accounts", [visibleConversation]);
  const contextDescription = useMemo(() => {
    if (!visibleConversation?.context.period && !visibleConversation?.context.category && !visibleConversation?.context.selectedTransactionId) return undefined;
    return [visibleConversation.context.period?.label, visibleConversation.context.category ? `Category: ${visibleConversation.context.category}` : undefined, visibleConversation.context.selectedTransactionId ? "Selected transaction" : undefined].filter(Boolean).join(" · ");
  }, [visibleConversation]);

  useEffect(() => {
    if (!balanceVisible) setSourceAnswer(undefined);
  }, [balanceVisible]);

  if (visibleLoading) {
    return (
      <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
        <View style={styles.loadingState}><ActivityIndicator color={coachColors.brandGreen} /><Text style={styles.loadingText}>Opening Wealth Coach…</Text></View>
      </ScreenContainer>
    );
  }

  if (visibleError && !visibleConversation) {
    return (
      <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
        <View style={styles.errorState}><Text style={styles.errorTitle}>We couldn’t open this conversation</Text><Text style={styles.errorText}>{visibleError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Back to Wealth Coach" onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Coach</Text></Pressable></View>
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
              <View style={styles.headerText}><Text style={styles.headerTitle}>Wealth Coach</Text><Text style={styles.headerSubtitle}>{sending ? "Working with selected data" : "Demo adapter · Demo data"}</Text></View>
              <View style={styles.headerActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Start new Coach conversation" onPress={() => router.push("/(app)/coach/new")} style={styles.iconButton}><Ionicons name="add" size={22} color={coachColors.brandGreen} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Open Coach conversation history" onPress={() => router.push("/(app)/coach/history")} style={styles.iconButton}><Ionicons name="time-outline" size={21} color={coachColors.brandGreen} /></Pressable>
              </View>
            </View>
          </View>

          <View style={styles.scopeBar}>
            <View style={styles.scopeIcon}><Ionicons name="shield-checkmark-outline" size={18} color={coachColors.brandGreen} /></View>
            <View style={styles.scopeText}><Text style={styles.scopeLabel}>Current scope</Text><Text numberOfLines={1} style={styles.scopeValue}>{scopeDescription}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="View Coach data scope" onPress={() => setShowScope(true)} style={styles.scopeActionButton}><Text style={styles.scopeAction}>View</Text></Pressable>
          </View>
          {contextDescription ? <View style={styles.contextBar}><Ionicons name="funnel-outline" size={16} color={coachColors.brandGreen} /><Text style={styles.contextText}>Context from transaction activity: {contextDescription}</Text></View> : null}

          {visibleError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={17} color="#B93A2B" /><Text style={styles.inlineErrorText}>{visibleError}</Text></View> : null}

          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(message) => message.id}
            renderItem={({ item: message }) => {
              const retryMessageId = retryUserMessageId(visibleConversation, message);
              return (
                <MessageBubble
                  message={message}
                  balanceVisible={balanceVisible}
                  onOpenSources={setSourceAnswer}
                  onOpenSource={openSource}
                  onRetry={retryMessageId ? () => void retry(retryMessageId) : undefined}
                  onSaveReport={saveReport}
                  onSaveGoal={saveGoal}
                  savedAnswerIds={savedAnswerIds}
                  savedGoalKeys={savedGoalKeys}
                  onFollowUp={(question) => void send(question)}
                />
              );
            }}
            ListEmptyComponent={<WelcomeState onAsk={(question) => void send(question)} />}
            ListFooterComponent={(
              <>
                {sending && runState && progressLabels[runState] ? <View style={styles.progressRow}><ActivityIndicator size="small" color={coachColors.brandGreen} /><Text style={styles.progressText}>{progressLabels[runState]}</Text></View> : null}
                {runState === "stopped" && !sending ? <Text style={styles.stoppedText}>This run was stopped. Nothing was saved or sent.</Text> : null}
              </>
            )}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
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
          />

          <View style={styles.composerWrap}>
            {pendingConsentMessageId && !showConsent && !sending ? <View style={styles.consentRecovery}><View style={styles.consentRecoveryText}><Text style={styles.consentRecoveryTitle}>Personal financial data was not accessed</Text><Text style={styles.consentRecoveryBody}>{consent === "granted" ? "Continue the pending question with your saved personalisation choice." : "Review Coach personalisation if you want a data-based answer to the pending question."}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={consent === "granted" ? "Continue the pending Coach answer" : "Review Coach personalisation"} onPress={() => consent === "granted" ? void reviewConsent("granted") : setShowConsent(true)} style={styles.consentRecoveryButton}><Text style={styles.consentRecoveryButtonText}>{consent === "granted" ? "Continue" : "Review"}</Text></Pressable></View> : null}
            {latestRun?.status === "failed" && !sending ? <Pressable accessibilityRole="button" accessibilityLabel="Retry the last Coach response" onPress={() => { const userMessageId = latestRun.userMessageId; void retry(userMessageId); }} style={styles.retryBanner}><Ionicons name="refresh-outline" size={17} color={coachColors.brandGreen} /><Text style={styles.retryText}>Retry the last response</Text></Pressable> : null}
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Ask Wealth Coach a question"
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your spending, savings, or goals…"
                placeholderTextColor={coachColors.textMuted}
                returnKeyType="send"
                submitBehavior="submit"
                multiline
                maxLength={1200}
                editable={!sending}
                accessibilityState={{ disabled: sending }}
                style={styles.input}
                onSubmitEditing={() => void send()}
              />
              {sending ? <Pressable accessibilityRole="button" accessibilityLabel="Stop Coach response" onPress={() => void stop()} style={styles.stopButton}><Ionicons name="stop" size={17} color="#B93A2B" /><Text style={styles.stopText}>Stop</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Send question" accessibilityState={{ disabled: !input.trim() }} disabled={!input.trim()} onPress={() => void send()} style={[styles.sendButton, !input.trim() && styles.disabledButton]}><Ionicons name="arrow-up" size={20} color="#FFFFFF" /></Pressable>}
            </View>
            <Text style={styles.composerHint}>Never enter your PIN, password, OTP, or full card number. Voice input is unavailable in this demo.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showConsent} transparent animationType="slide" onRequestClose={() => undefined}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><CoachAvatar /><Text style={styles.modalTitle}>Review Coach personalisation</Text><Text style={styles.modalText}>To answer this personal question, Coach needs permission to read the selected transaction data. Banking access remains separate, and this does not include marketing or voice permission.</Text>{visibleError ? <Text accessibilityRole="alert" style={styles.modalError}>{visibleError}</Text> : null}<View style={styles.permissionRow}><Ionicons name="checkmark-circle-outline" size={20} color={coachColors.brandGreen} /><Text style={styles.permissionText}>{scopeDescription}</Text></View><View style={styles.permissionRow}><Ionicons name="time-outline" size={20} color={coachColors.brandGreen} /><Text style={styles.permissionText}>Demo data as of 6 Sep 2026; pending and failed rows stay separate.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Enable Coach personalisation" onPress={() => void reviewConsent("granted")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Enable Coach personalisation</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => void reviewConsent("declined")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Not now</Text></Pressable></View></View>
      </Modal>

      <Modal visible={showScope} transparent animationType="slide" onRequestClose={() => setShowScope(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Current data scope</Text><Text style={styles.modalText}>Only resources owned by this signed-in customer and validated by the shared banking services can be used.</Text><Text style={styles.scopeModalLabel}>Included resources</Text><Text style={styles.scopeModalValue}>{scopeDescription}</Text><Text style={styles.scopeModalLabel}>Source</Text><Text style={styles.scopeModalValue}>Demo data · latest successful update 6 Sep 2026</Text><Text style={styles.scopeModalLabel}>Coach personalisation</Text><Text style={styles.scopeModalValue}>{consent === "granted" ? "Enabled for this customer" : consent === "declined" ? "Not enabled; personal retrieval is blocked" : "Not reviewed"}</Text><Text style={styles.scopeModalNote}>Answers show their assumptions, limitations, calculation version, and supporting sources. Conversation summaries are not bank records.</Text><Pressable accessibilityRole="button" accessibilityLabel="Close data scope" onPress={() => setShowScope(false)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable></View></View>
      </Modal>

      <Modal visible={Boolean(sourceAnswer)} transparent animationType="slide" onRequestClose={() => setSourceAnswer(undefined)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>How this was calculated</Text><Text style={styles.modalText}>Sources are scoped to this answer and are labelled Demo data. Open a row to inspect it in the existing banking detail screen.</Text><ScrollView style={styles.sourceList}>{sourceAnswer?.sourceReferences.map((source) => <Pressable key={source.id} accessibilityRole="button" accessibilityLabel={`${source.kind === "transaction" ? "Open" : "View"} source: ${source.label}`} accessibilityState={{ disabled: source.kind !== "transaction" }} onPress={() => openSource(source)} disabled={source.kind !== "transaction"} style={styles.sourceRow}><View style={styles.sourceRowIcon}><Ionicons name={source.kind === "transaction" ? "receipt-outline" : source.kind === "calculation" ? "calculator-outline" : "shield-checkmark-outline"} size={17} color={coachColors.brandGreen} /></View><View style={styles.sourceRowText}><Text style={styles.sourceTitle}>{source.label}</Text><Text style={styles.sourceMeta}>{source.kind === "calculation" ? "Calculation reference" : source.kind === "transaction" ? "Open transaction" : "Authorised resource"}</Text></View>{source.kind === "transaction" ? <Ionicons name="chevron-forward" size={17} color={coachColors.textMuted} /> : null}</Pressable>)}</ScrollView><Pressable accessibilityRole="button" accessibilityLabel="Close sources" onPress={() => setSourceAnswer(undefined)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Close</Text></Pressable></View></View>
      </Modal>
    </ScreenContainer>
  );
}

function CoachAvatar({ working = false }: { working?: boolean }) {
  return <View accessibilityLabel={working ? "Wealth Coach working" : "Wealth Coach idle"} style={[styles.avatar, working && styles.avatarWorking]}><Ionicons name="sparkles-outline" size={18} color={coachColors.brandGreen} /></View>;
}

function WelcomeState({ onAsk }: { onAsk: (question: string) => void }) {
  const questions = ["Where did my money go this month?", "What changed in my Food & Dining spending?", "Help me plan an emergency fund.", "How are my goals progressing?"];
  return <View style={styles.welcome}><CoachAvatar /><Text style={styles.welcomeTitle}>Let’s understand your money.</Text><Text style={styles.welcomeText}>Ask about spending, saving, or a financial goal. I’ll show the scope and sources behind personal answers.</Text><View style={styles.questionList}>{questions.map((question) => <Pressable key={question} accessibilityRole="button" accessibilityLabel={`Ask Wealth Coach: ${question}`} onPress={() => onAsk(question)} style={({ pressed }) => [styles.questionButton, pressed && styles.pressed]}><Text style={styles.questionText}>{question}</Text><Ionicons name="arrow-forward" size={17} color={coachColors.brandGreen} /></Pressable>)}</View></View>;
}

type MessageBubbleProps = {
  balanceVisible: boolean;
  message: CoachMessage;
  onOpenSources: (answer: CoachAnswer) => void;
  onOpenSource: (source: CoachSourceReference) => void;
  onRetry?: () => void;
  onSaveReport: (answer: CoachAnswer) => void;
  onSaveGoal: (answer: CoachAnswer, option: GoalScenarioOption) => void;
  savedAnswerIds: string[];
  savedGoalKeys: string[];
  onFollowUp: (question: string) => void;
};

function MessageBubble({ balanceVisible, message, onOpenSources, onOpenSource, onRetry, onSaveReport, onSaveGoal, savedAnswerIds, savedGoalKeys, onFollowUp }: MessageBubbleProps) {
  const content = balanceVisible
    ? message.content
    : privacySafeFinancialText(
      message.content,
      message.role === "user" ? "Financial question with hidden values" : "This answer contains hidden financial values. Show balances to review it.",
    );
  if (message.role === "user") return <View style={styles.userMessageWrap}><View style={styles.userBubble}><Text style={styles.userText}>{content}</Text></View></View>;
  return <View style={styles.assistantMessage}><View style={styles.assistantHeading}><CoachAvatar /><Text style={styles.assistantLabel}>Wealth Coach</Text></View><View style={styles.assistantBody}><Text style={styles.assistantText}>{content}</Text>{message.answer && !balanceVisible ? <HiddenFinancialDetails /> : message.answer?.blocks.filter((block) => block.type !== "text").map((block) => <AnswerBlock key={block.id} block={block} answer={message.answer as CoachAnswer} onOpenSources={onOpenSources} onOpenSource={onOpenSource} onSaveGoal={onSaveGoal} savedGoalKeys={savedGoalKeys} onFollowUp={onFollowUp} />)}{message.answer && balanceVisible ? <><View style={styles.answerActions}><Pressable accessibilityRole="button" accessibilityLabel="View answer sources" onPress={() => onOpenSources(message.answer as CoachAnswer)} style={styles.answerAction}><Ionicons name="reader-outline" size={16} color={coachColors.brandGreen} /><Text style={styles.answerActionText}>Sources</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={savedAnswerIds.includes(message.answer.messageId) ? "Summary saved" : "Save answer summary"} accessibilityState={{ disabled: savedAnswerIds.includes(message.answer.messageId) }} onPress={() => onSaveReport(message.answer as CoachAnswer)} disabled={savedAnswerIds.includes(message.answer.messageId)} style={styles.answerAction}><Ionicons name={savedAnswerIds.includes(message.answer.messageId) ? "checkmark-circle-outline" : "bookmark-outline"} size={16} color={coachColors.brandGreen} /><Text style={styles.answerActionText}>{savedAnswerIds.includes(message.answer.messageId) ? "Saved" : "Save summary"}</Text></Pressable></View>{message.answer.suggestedFollowUps.length > 0 ? <View style={styles.followUps}><Text style={styles.followUpsTitle}>Suggested follow-ups</Text>{message.answer.suggestedFollowUps.map((question) => <Pressable key={question} accessibilityRole="button" accessibilityLabel={`Ask Wealth Coach: ${question}`} onPress={() => onFollowUp(question)} style={styles.followUpButton}><Text style={styles.followUpText}>{question}</Text><Ionicons name="arrow-forward" size={16} color={coachColors.brandGreen} /></Pressable>)}</View> : null}</> : null}{message.status === "failed" && onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry this Coach response" onPress={onRetry} style={styles.failedRetry}><Ionicons name="refresh-outline" size={16} color="#B93A2B" /><Text style={styles.failedRetryText}>Retry</Text></Pressable> : null}</View></View>;
}

function HiddenFinancialDetails() {
  return <View style={styles.unavailableCard}><Ionicons name="eye-off-outline" size={19} color={coachColors.textSecondary} /><View style={styles.unavailableText}><Text style={styles.responseCardTitle}>Financial details hidden</Text><Text style={styles.cardNote}>Turn on balance visibility from Accounts to review the evidence used for this answer.</Text></View></View>;
}

function AnswerBlock({ block, answer, onOpenSources, onOpenSource, onSaveGoal, savedGoalKeys, onFollowUp }: { block: Exclude<CoachAnswerBlock, { type: "text" }>; answer: CoachAnswer; onOpenSources: (answer: CoachAnswer) => void; onOpenSource: (source: CoachSourceReference) => void; onSaveGoal: (answer: CoachAnswer, option: GoalScenarioOption) => void; savedGoalKeys: string[]; onFollowUp: (question: string) => void }) {
  if (block.type === "spendingComparison") {
    const comparisonMax = Math.max(block.current.amountMinorUnits, block.previous.amountMinorUnits, 1);
    return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.categoryLabel}</Text><View style={styles.metricRow}><Metric label="Current" value={formatIndianMinorUnits(block.current.amountMinorUnits)} detail={block.current.period.label.split(" · ")[1]} /><Metric label="Previous" value={formatIndianMinorUnits(block.previous.amountMinorUnits)} detail={block.previous.period.label.split(" · ")[1]} /><Metric label="Change" value={`${block.differenceMinorUnits >= 0 ? "+" : "−"}${formatIndianMinorUnits(Math.abs(block.differenceMinorUnits))}`} detail={block.percentageChange === undefined ? "Baseline zero" : formatPercentage(Math.abs(block.percentageChange))} /></View><View style={styles.evidenceBars}><EvidenceBar label="Current" accessibilityLabel={`${block.current.period.label} spending`} value={block.current.amountMinorUnits} max={comparisonMax} /><EvidenceBar label="Previous" accessibilityLabel={`${block.previous.period.label} spending`} value={block.previous.amountMinorUnits} max={comparisonMax} previous /></View>{block.pendingMinorUnits || block.failedMinorUnits ? <Text style={styles.cardNote}>Pending/failed rows are separate from this posted total.</Text> : null}</View>;
  }
  if (block.type === "categoryBreakdown") {
    const categoryMax = Math.max(1, ...block.items.map((item) => item.amountMinorUnits));
    return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>Spending breakdown · {block.period.label.split(" · ")[1]}</Text>{block.items.map((item) => { const amount = formatIndianMinorUnits(item.amountMinorUnits); return <View key={item.category} style={styles.breakdownItem}><View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>{item.label}</Text><Text style={styles.breakdownAmount}>{amount}</Text><Text style={styles.breakdownCount}>{item.count} posted</Text></View><ProgressBar accessibilityLabel={`${item.label} spending magnitude`} accessibilityValueText={`${amount}, relative to the largest category`} max={categoryMax} value={item.amountMinorUnits} style={styles.categoryProgress} /></View>; })}</View>;
  }
  if (block.type === "transactionList") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.title}</Text>{block.items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open transaction ${item.label}, ${item.direction === "credit" ? "credit" : "debit"} ${formatIndianMinorUnits(item.amountMinorUnits)}`} onPress={() => { const source = answer.sourceReferences.find((reference) => reference.id === item.sourceReferenceId); if (source) onOpenSource(source); }} style={styles.transactionItem}><View style={styles.transactionItemText}><Text numberOfLines={1} style={styles.transactionLabel}>{item.label}</Text><Text style={styles.transactionMeta}>{item.date} · {item.status}</Text></View><Text style={[styles.transactionAmount, item.direction === "credit" ? styles.transactionCreditAmount : styles.transactionDebitAmount]}>{item.direction === "credit" ? "+" : "-"}{formatIndianMinorUnits(item.amountMinorUnits)}</Text><Ionicons name="chevron-forward" size={17} color={coachColors.textMuted} /></Pressable>)}</View>;
  if (block.type === "goalScenario") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.goal.name} · no-growth plan</Text><Text style={styles.cardNote}>{formatIndianMinorUnits(block.goal.targetMinorUnits)} target · {formatIndianMinorUnits(block.goal.allocatedMinorUnits)} allocated · {formatIndianMinorUnits(block.goal.remainingMinorUnits)} remaining</Text>{block.options.map((option) => { const key = `${answer.conversationId}:${answer.messageId}:${option.monthlyContributionMinorUnits}`; const saved = savedGoalKeys.includes(key); return <View key={option.monthlyContributionMinorUnits} style={styles.goalOption}><View style={styles.goalOptionText}><Text style={styles.goalOptionTitle}>{option.label}</Text><Text style={styles.goalOptionMeta}>Final contribution {formatIndianMinorUnits(option.finalContributionMinorUnits)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={saved ? `${option.label} goal saved` : `Save ${option.label} goal`} accessibilityState={{ disabled: saved }} onPress={() => onSaveGoal(answer, option)} disabled={saved} style={[styles.smallButton, saved && styles.savedButton]}><Text style={styles.smallButtonText}>{saved ? "Saved" : "Save goal"}</Text></Pressable></View>; })}<Text style={styles.cardNote}>Saving creates a planning goal draft only. It does not move or reserve money.</Text></View>;
  if (block.type === "goalProgress") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.name}</Text><Text style={styles.cardNote}>{formatIndianMinorUnits(block.currentMinorUnits)} of {formatIndianMinorUnits(block.targetMinorUnits)} · {block.progressPercentage}%</Text><ProgressBar accessibilityLabel={`${block.name} goal progress`} accessibilityValueText={`${block.progressPercentage}% complete`} value={block.progressPercentage} style={styles.goalProgress} /></View>;
  if (block.type === "dataUnavailable") return <View style={styles.unavailableCard}><Ionicons name="information-circle-outline" size={19} color="#9A6B17" /><View style={styles.unavailableText}><Text style={styles.responseCardTitle}>{block.title}</Text><Text style={styles.cardNote}>{block.reason}</Text></View></View>;
  if (block.type === "clarification") return <View style={styles.responseCard}><Text style={styles.responseCardTitle}>{block.question}</Text>{block.options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Reply to Wealth Coach: ${option}`} onPress={() => onFollowUp(option)} style={styles.questionButton}><Text style={styles.questionText}>{option}</Text><Ionicons name="arrow-forward" size={17} color={coachColors.brandGreen} /></Pressable>)}</View>;
  if (block.type === "metricSummary") return <MetricSummaryBlock block={block} />;
  return null;
}

function MetricSummaryBlock({ block }: { block: Extract<CoachAnswerBlock, { type: "metricSummary" }> }) {
  const purchase = block.metrics.find((metric) => metric.key === "purchase-amount" && metric.valueMinorUnits !== undefined);
  const available = block.metrics.find((metric) => metric.key === "available-funds" && metric.valueMinorUnits !== undefined);
  const afterPurchase = block.metrics.find((metric) => metric.key === "funds-after-purchase" && metric.valueMinorUnits !== undefined);
  const availableMinorUnits = available?.valueMinorUnits
    ?? (purchase?.valueMinorUnits !== undefined && afterPurchase?.valueMinorUnits !== undefined
      ? purchase.valueMinorUnits + afterPurchase.valueMinorUnits
      : undefined);
  const canShowAffordability = purchase?.valueMinorUnits !== undefined
    && availableMinorUnits !== undefined
    && Number.isFinite(purchase.valueMinorUnits)
    && Number.isFinite(availableMinorUnits)
    && availableMinorUnits > 0;

  return <View style={styles.responseCard}>{block.metrics.map((metric) => <Metric key={metric.key} label={metric.label} value={metric.displayValue} detail={metric.unit} />)}{canShowAffordability && purchase?.valueMinorUnits !== undefined && availableMinorUnits !== undefined ? <View style={styles.affordability}><View style={styles.affordabilityHeader}><Text style={styles.evidenceBarLabel}>Purchase vs available funds</Text><Text style={styles.evidenceBarValue}>{purchase.displayValue} of {available?.displayValue ?? formatIndianMinorUnits(availableMinorUnits)}</Text></View><ProgressBar accessibilityLabel="Purchase amount relative to available funds" accessibilityValueText={`${purchase.displayValue} purchase from ${available?.displayValue ?? formatIndianMinorUnits(availableMinorUnits)} available${afterPurchase ? `, ${afterPurchase.displayValue} after purchase` : ""}`} value={purchase.valueMinorUnits} max={availableMinorUnits} style={styles.affordabilityProgress} />{afterPurchase ? <Text style={styles.affordabilityNote}>{afterPurchase.displayValue} after purchase</Text> : null}</View> : null}</View>;
}

function EvidenceBar({ label, accessibilityLabel, value, max, previous = false }: { label: string; accessibilityLabel: string; value: number; max: number; previous?: boolean }) {
  const formattedValue = formatIndianMinorUnits(value);
  return <View style={styles.evidenceBar}><View style={styles.evidenceBarHeader}><Text style={styles.evidenceBarLabel}>{label}</Text><Text style={styles.evidenceBarValue}>{formattedValue}</Text></View><ProgressBar accessibilityLabel={accessibilityLabel} accessibilityValueText={formattedValue} value={value} max={max} style={styles.evidenceProgress} fillStyle={previous ? styles.previousEvidenceFill : undefined} /></View>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  headerBack: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  headerBackText: { marginLeft: 2, color: coachColors.textPrimary, fontSize: 15, fontWeight: "600" },
  headerMain: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  avatar: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: coachColors.brandGreenSoft },
  avatarWorking: { backgroundColor: coachColors.brandOrangeSoft },
  headerText: { flex: 1, minWidth: 0, marginLeft: 10 },
  headerTitle: { color: coachColors.textPrimary, fontSize: 17, fontWeight: "700" },
  headerSubtitle: { marginTop: 2, color: coachColors.textSecondary, fontSize: 11 },
  headerActions: { flexDirection: "row", columnGap: 2 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  scopeBar: { marginHorizontal: 16, marginTop: 10, padding: 10, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  scopeIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: coachColors.brandGreenSoft },
  scopeText: { flex: 1, minWidth: 0, marginLeft: 9 },
  contextBar: { marginHorizontal: 16, marginTop: 7, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "flex-start", borderRadius: 11, backgroundColor: coachColors.brandGreenSoft },
  contextText: { flex: 1, marginLeft: 7, color: coachColors.textSecondary, fontSize: 11, lineHeight: 16 },
  scopeLabel: { color: coachColors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  scopeValue: { marginTop: 2, color: coachColors.textPrimary, fontSize: 13, fontWeight: "600" },
  scopeActionButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
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
  evidenceBars: { marginTop: 12, rowGap: 9 },
  evidenceBar: { rowGap: 4 },
  evidenceBarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  evidenceBarLabel: { color: coachColors.textSecondary, fontSize: 11, fontWeight: "600" },
  evidenceBarValue: { color: coachColors.textPrimary, fontSize: 11, fontWeight: "700" },
  evidenceProgress: { height: 6, backgroundColor: coachColors.progressTrack },
  previousEvidenceFill: { backgroundColor: coachColors.brandOrange },
  affordability: { marginTop: 12, rowGap: 5 },
  affordabilityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 10 },
  affordabilityProgress: { height: 7, backgroundColor: coachColors.progressTrack },
  affordabilityNote: { color: coachColors.textSecondary, fontSize: 10, lineHeight: 14, textAlign: "right" },
  breakdownItem: { paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  breakdownRow: { minHeight: 25, flexDirection: "row", alignItems: "center" },
  breakdownLabel: { flex: 1, color: coachColors.textPrimary, fontSize: 13 },
  breakdownAmount: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "700" },
  breakdownCount: { width: 65, marginLeft: 8, color: coachColors.textMuted, fontSize: 10, textAlign: "right" },
  categoryProgress: { height: 5, marginTop: 5, backgroundColor: coachColors.progressTrack },
  goalProgress: { height: 7, marginTop: 10, backgroundColor: coachColors.progressTrack },
  transactionItem: { minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  transactionItemText: { flex: 1, minWidth: 0, marginRight: 8 },
  transactionLabel: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "600" },
  transactionMeta: { marginTop: 2, color: coachColors.textMuted, fontSize: 10 },
  transactionAmount: { marginRight: 8, color: coachColors.textPrimary, fontSize: 12, fontWeight: "700" },
  transactionCreditAmount: { color: coachColors.brandGreen },
  transactionDebitAmount: { color: "#A62B32" },
  goalOption: { minHeight: 55, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  goalOptionText: { flex: 1, minWidth: 0 },
  goalOptionTitle: { color: coachColors.textPrimary, fontSize: 13, fontWeight: "700" },
  goalOptionMeta: { marginTop: 2, color: coachColors.textSecondary, fontSize: 11 },
  smallButton: { minHeight: 44, marginLeft: 8, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: coachColors.brandGreen },
  savedButton: { backgroundColor: "#B9D9D0" },
  smallButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  unavailableCard: { marginTop: 11, padding: 13, flexDirection: "row", borderRadius: 15, backgroundColor: "#FFF8E7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#F0D99A" },
  unavailableText: { flex: 1, marginLeft: 9 },
  answerActions: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8, marginTop: 12 },
  answerAction: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  answerActionText: { marginLeft: 5, color: coachColors.brandGreen, fontSize: 12, fontWeight: "700" },
  followUps: { marginTop: 12, rowGap: 8 },
  followUpsTitle: { color: coachColors.textPrimary, fontSize: 12, fontWeight: "700" },
  followUpButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, backgroundColor: coachColors.brandGreenSoft },
  followUpText: { flex: 1, marginRight: 8, color: coachColors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  failedRetry: { alignSelf: "flex-start", minHeight: 44, marginTop: 9, flexDirection: "row", alignItems: "center" },
  failedRetryText: { marginLeft: 5, color: "#B93A2B", fontSize: 12, fontWeight: "700" },
  progressRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  progressText: { marginLeft: 8, color: coachColors.textSecondary, fontSize: 12 },
  stoppedText: { paddingVertical: 8, color: coachColors.textMuted, fontSize: 12, fontStyle: "italic" },
  composerWrap: { paddingHorizontal: 16, paddingTop: 7, paddingBottom: 4, backgroundColor: coachColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: coachColors.divider },
  consentRecovery: { marginBottom: 8, padding: 12, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "#FFF8E7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#F0D99A" },
  consentRecoveryText: { flex: 1, minWidth: 0, marginRight: 8 },
  consentRecoveryTitle: { color: coachColors.textPrimary, fontSize: 12, fontWeight: "700" },
  consentRecoveryBody: { marginTop: 2, color: coachColors.textSecondary, fontSize: 11, lineHeight: 16 },
  consentRecoveryButton: { minWidth: 72, minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: coachColors.brandGreen },
  consentRecoveryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  composer: { minHeight: 48, maxHeight: 120, flexDirection: "row", alignItems: "flex-end", paddingLeft: 13, paddingRight: 6, paddingVertical: 5, borderRadius: 18, backgroundColor: coachColors.surface, borderWidth: 1, borderColor: coachColors.border },
  input: { flex: 1, minHeight: 36, maxHeight: 105, paddingTop: 8, paddingBottom: 7, color: coachColors.textPrimary, fontSize: 14, lineHeight: 20 },
  sendButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: coachColors.brandGreen },
  disabledButton: { backgroundColor: "#B8C8C3" },
  stopButton: { minHeight: 44, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FDEBE8" },
  stopText: { marginLeft: 4, color: "#B93A2B", fontSize: 12, fontWeight: "700" },
  composerHint: { paddingHorizontal: 2, paddingTop: 5, color: coachColors.textMuted, fontSize: 10, lineHeight: 14 },
  retryBanner: { alignSelf: "flex-start", minHeight: 44, marginBottom: 5, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  retryText: { marginLeft: 5, color: coachColors.brandGreen, fontSize: 12, fontWeight: "700" },
  inlineError: { marginHorizontal: 16, marginTop: 8, padding: 9, flexDirection: "row", alignItems: "center", borderRadius: 10, backgroundColor: "#FDEBE8" },
  inlineErrorText: { flex: 1, marginLeft: 6, color: "#9C3327", fontSize: 12, lineHeight: 17 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: coachColors.textSecondary, fontSize: 14 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  demoGateIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", marginBottom: 14, borderRadius: 27, backgroundColor: coachColors.brandGreenSoft },
  errorTitle: { color: coachColors.textPrimary, fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorText: { marginTop: 8, color: coachColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  primaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: coachColors.brandGreen },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "center" },
  secondaryButton: { minHeight: 44, marginTop: 7, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: coachColors.brandGreen, fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.42)" },
  modalCard: { maxHeight: "88%", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: coachColors.surface },
  modalHandle: { width: 38, height: 4, alignSelf: "center", marginBottom: 15, borderRadius: 2, backgroundColor: coachColors.border },
  modalTitle: { marginTop: 12, color: coachColors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: "700" },
  modalText: { marginTop: 8, color: coachColors.textSecondary, fontSize: 14, lineHeight: 21 },
  modalError: { marginTop: 10, color: "#B93A2B", fontSize: 12, lineHeight: 17, fontWeight: "600" },
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
