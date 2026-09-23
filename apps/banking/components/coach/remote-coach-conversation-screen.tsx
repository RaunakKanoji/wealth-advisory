import { randomUUID } from "expo-crypto";
import type { CoachConversationContextInput } from "@/services/wealth-coach-conversation-service";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { IconButton } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import {
  useCoachConversationMessages,
  useCreateCoachConversation,
  useSendCoachMessage,
  useCoachConsent,
  useSetCoachConsent,
  useCancelCoachRun,
  useSaveCoachReport,
  useSaveGoalContribution,
  useCoachAnswerSources,
} from "@/lib/api/hooks";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { formatINRInText } from "@/lib/currency";
import type {
  ApiCoachSource,
  ApiCoachStructuredCard,
  ApiCoachStructuredPayload,
  ApiMessage,
} from "@/lib/api/types";
import { privacySafeFinancialText } from "@/lib/privacy";

import { claimCoachSubmitIntent } from "./coach-conversation-utils";
import { WealthAnalysisResponse } from "./wealth-analysis-response";

type RemoteCoachConversationScreenProps = {
  conversationId?: string;
  initialPrompt?: string;
  autoSubmitIntentId?: string;
  scopeInput?: {kind?: string;accountId?:string;cardId?:string;goalId?:string};
  contextInput?: CoachConversationContextInput;
};

const MAX_MESSAGE_LENGTH = 1_000;

export function RemoteCoachConversationScreen({ conversationId, initialPrompt, autoSubmitIntentId, scopeInput, contextInput }: RemoteCoachConversationScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const conversationQuery = useCoachConversationMessages(activeConversationId);
  const { refetch: refetchConversation } = conversationQuery;
  const createConversation = useCreateCoachConversation();
  const sendMessage = useSendCoachMessage(activeConversationId);
  const consent = useCoachConsent();
  const setConsent = useSetCoachConsent();
  const cancelRun = useCancelCoachRun();
  const activeRunId = useRef<string | undefined>(undefined);
  const initialScope = useMemo(() => ({accountId:scopeInput?.accountId,cardId:scopeInput?.cardId,goalId:scopeInput?.goalId,transactionId:contextInput?.selectedTransactionId,category:contextInput?.category,from:contextInput?.period?.from,to:contextInput?.period?.to,period:contextInput?.periodId}),[scopeInput,contextInput]);
  const listRef = useRef<FlatList<ApiMessage>>(null);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [pendingMessage, setPendingMessage] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  const [failedRequest, setFailedRequest] = useState<{ message: string; requestId: string }>();
  const [stoppedMessage, setStoppedMessage] = useState<string>();
  const [transientCustomerId, setTransientCustomerId] = useState(customerId);
  const activeCustomerId = useRef<string | undefined>(isUserLoaded ? customerId : undefined);
  const operationGeneration = useRef(0);
  const allowRoutePrompt = useRef(true);
  const isMounted = useRef(true);
  const requestController = useRef<AbortController | null>(null);
  if (isUserLoaded) {
    if (activeCustomerId.current === undefined) {
      activeCustomerId.current = customerId;
    } else if (activeCustomerId.current !== customerId) {
      activeCustomerId.current = customerId;
      operationGeneration.current += 1;
      allowRoutePrompt.current = false;
    }
  }
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      operationGeneration.current += 1;
      requestController.current?.abort();
    };
  }, []);

  const isCurrentCustomer = transientCustomerId === customerId;
  const visibleInput = isCurrentCustomer ? input : "";
  const visiblePendingMessage = isCurrentCustomer ? pendingMessage : undefined;
  const visibleSendError = isCurrentCustomer ? sendError : undefined;
  const visibleStoppedMessage = isCurrentCustomer ? stoppedMessage : undefined;
  const isHydratingCreatedConversation = Boolean(activeConversationId && pendingMessage && !conversationQuery.data);
  const isSending = isCurrentCustomer && (createConversation.isPending || sendMessage.isPending || isHydratingCreatedConversation);
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;
  const storedMessages = useMemo(
    () => conversationQuery.data?.messages.filter((message) => message.role === "user" || message.role === "assistant") ?? [],
    [conversationQuery.data?.messages],
  );

  useEffect(() => {
    setActiveConversationId(conversationId);
    setTransientCustomerId(customerId);
    setInput(conversationId || !allowRoutePrompt.current ? "" : initialPrompt ?? "");
    setPendingMessage(undefined);
    setSendError(undefined);
    setFailedRequest(undefined);
    setStoppedMessage(undefined);
  }, [conversationId, customerId, initialPrompt]);

  useEffect(() => {
    if (!pendingMessage || !conversationQuery.data) return;
    if (conversationQuery.data.messages.some((message) => message.role === "user" && message.content === pendingMessage)) {
      setPendingMessage(undefined);
    }
  }, [conversationQuery.data, pendingMessage]);

  const messages = useMemo(() => {
    if (!visiblePendingMessage) return storedMessages;
    return [
      ...storedMessages,
      {
        id: "pending-user-message",
        conversationId: activeConversationId ?? "pending-conversation",
        role: "user" as const,
        content: visiblePendingMessage,
        structuredPayloadJson: null,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [activeConversationId, storedMessages, visiblePendingMessage]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)/coach");
  }, [router]);

  const send = useCallback(async (textOverride?: string) => {
    if (isSending) return;
    const requestedCustomerId = customerId;
    const generation = operationGeneration.current;
    const isActiveRequest = () => isMounted.current
      && activeCustomerId.current === requestedCustomerId
      && operationGeneration.current === generation;
    const text = (textOverride ?? visibleInput).trim();
    if (!text) return;

    setInput("");
    setPendingMessage(text);
    setSendError(undefined);
    setStoppedMessage(undefined);
    createConversation.reset();
    sendMessage.reset();
    const controller = new AbortController();
    const runId = failedRequest?.message === text ? failedRequest.requestId : randomUUID();
    setFailedRequest(undefined);
    activeRunId.current = runId;
    requestController.current?.abort();
    requestController.current = controller;

    try {
      if (!activeConversationId) {
        const result = await createConversation.mutateAsync({ firstMessage: text, requestId: runId, scope: initialScope, signal: controller.signal });
        if (!isActiveRequest()) return;
        setActiveConversationId(result.conversation.id);
        return;
      }

      await sendMessage.mutateAsync({ message: text, requestId: runId, signal: controller.signal });
      if (!isActiveRequest()) return;
      setPendingMessage(undefined);
    } catch (error: unknown) {
      if (!isActiveRequest()) return;
      setPendingMessage(undefined);
      setInput(text);
      if (isAbortError(error)) {
        setStoppedMessage("Stopped waiting for this response. Check conversation history before sending the question again.");
        setSendError(undefined);
      } else {
        setFailedRequest({ message: text, requestId: runId });
        setSendError(coachErrorMessage(error, "We couldn’t send your question."));
      }
    } finally {
      if (activeRunId.current === runId) activeRunId.current = undefined;
      if (requestController.current === controller) requestController.current = null;
    }
  }, [activeConversationId, createConversation, customerId, failedRequest, initialScope, isSending, sendMessage, visibleInput]);

  const stop = useCallback(() => {
    if (activeRunId.current) void cancelRun.mutateAsync(activeRunId.current).catch(() => setSendError('Could not confirm cancellation. Review history before retrying.'));
    requestController.current?.abort();
  }, [cancelRun]);

  useEffect(() => {
    if (!isUserLoaded || !isBalanceVisibilityHydrated || !autoSubmitIntentId || !initialPrompt || activeConversationId || isSending || !allowRoutePrompt.current) return;
    if (!claimCoachSubmitIntent(customerId, autoSubmitIntentId)) return;
    void send(initialPrompt);
  }, [activeConversationId, autoSubmitIntentId, customerId, initialPrompt, isBalanceVisibilityHydrated, isSending, isUserLoaded, send]);

  const retrySend = useCallback(() => {
    if (visibleInput.trim()) {
      void send(visibleInput);
      return;
    }
    if (activeConversationId) void refetchConversation();
  }, [activeConversationId, refetchConversation, send, visibleInput]);

  const dismissSendError = useCallback(() => {
    setSendError(undefined);
    setFailedRequest(undefined);
  }, []);

  const answerConsent = useCallback(async (granted:boolean) => {
    try {
      await setConsent.mutateAsync({granted});
      if (granted) {
        const question = [...storedMessages].reverse().find(message => message.role === 'user')?.content;
        if (question) await send(question);
      }
    } catch (error) {setSendError(coachErrorMessage(error,'Could not update consent.'));}
  },[send,setConsent,storedMessages]);

  const renderMessage = useCallback(({ item }: ListRenderItemInfo<ApiMessage>) => (
    <RemoteMessage
      balanceVisible={balanceVisible}
      disabled={isSending || item.id !== storedMessages.at(-1)?.id}
      onConsent={answerConsent}
      message={item}
      onFollowUp={(prompt) => void send(prompt)}
    />
  ), [answerConsent, balanceVisible, isSending, send, storedMessages]);

  const isInitialLoading = !isUserLoaded
    || !isBalanceVisibilityHydrated
    || Boolean(activeConversationId && !conversationQuery.data && !visiblePendingMessage && (conversationQuery.isPending || conversationQuery.isFetching));
  const hasInitialError = Boolean(activeConversationId && !conversationQuery.data && !visiblePendingMessage && conversationQuery.isError);
  const title = conversationQuery.data?.conversation.title;
  const safeTitle = title
    ? financialText(title, "Financial conversation", balanceVisible)
    : activeConversationId
      ? "Conversation"
      : "New conversation";

  return (
    <ScreenContainer backgroundColor={appColors.background} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.page}>
          <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Wealth Coach"
              accessibilityHint="Returns to the Wealth Coach overview"
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
              <Text style={styles.backText}>Back to Coach</Text>
            </Pressable>

            <View style={styles.headerMain}>
              <View style={[styles.coachAvatar, isSending && styles.coachAvatarWorking]}>
                <Ionicons name="sparkles-outline" size={19} color={appColors.primary} />
              </View>
              <View style={styles.headerCopy}>
                <Text accessibilityRole="header" style={styles.headerTitle}>Wealth Coach</Text>
                <Text numberOfLines={1} style={styles.headerSubtitle}>{isSending ? "Reviewing your financial context…" : safeTitle}</Text>
              </View>
              <View style={styles.headerActions}>
                {consent.data?.granted ? <IconButton accessibilityLabel="Revoke Coach data access" iconColor={appColors.primary} iconName="shield-checkmark-outline" onPress={() => void answerConsent(false)} /> : null}
                <IconButton
                  accessibilityLabel="Start a new Coach conversation"
                  iconColor={appColors.primary}
                  iconName="add"
                  onPress={() => router.push("/(app)/coach/new")}
                />
                <IconButton
                  accessibilityLabel="Open Coach conversation history"
                  iconColor={appColors.primary}
                  iconName="time-outline"
                  onPress={() => router.push("/(app)/coach/history")}
                />
              </View>
            </View>
          </View>

          {visibleSendError ? (
            <View style={[styles.banner, { marginHorizontal: horizontalPadding }]}>
              <StatusBanner
                actionLabel="Retry"
                actionAccessibilityLabel="Retry sending your Coach question"
                iconName="alert-circle-outline"
                message={visibleSendError}
                onAction={retrySend}
                onSecondaryAction={dismissSendError}
                secondaryActionAccessibilityLabel="Dismiss Coach send error"
                secondaryActionLabel="Dismiss"
                title="Couldn’t send message"
                tone="danger"
              />
            </View>
          ) : null}

          {visibleStoppedMessage ? (
            <View style={[styles.banner, { marginHorizontal: horizontalPadding }]}>
              <StatusBanner
                actionLabel="View history"
                actionAccessibilityLabel="Check Coach conversation history after stopping"
                iconName="stop-circle-outline"
                message={visibleStoppedMessage}
                onAction={() => router.push("/(app)/coach/history")}
                title="Response stopped"
                tone="warning"
              />
            </View>
          ) : null}

          {isInitialLoading ? (
            <View style={[styles.stateContent, { paddingHorizontal: horizontalPadding }]}>
              <ConversationSkeleton />
            </View>
          ) : null}

          {!isInitialLoading && hasInitialError ? (
            <View style={[styles.stateContent, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.errorPanel}>
                <View style={styles.errorIcon}>
                  <Ionicons name="cloud-offline-outline" size={25} color={appColors.danger} />
                </View>
                <Text accessibilityRole="header" style={styles.errorTitle}>Conversation unavailable</Text>
                <Text style={styles.errorDescription}>{coachErrorMessage(conversationQuery.error, "We couldn’t open this conversation.")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry opening the Coach conversation"
                  onPress={() => void conversationQuery.refetch()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  {conversationQuery.isFetching ? <ActivityIndicator size="small" color={appColors.surface} /> : <Ionicons name="refresh-outline" size={18} color={appColors.surface} />}
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isInitialLoading && !hasInitialError ? (
            <FlatList
              ref={listRef}
              contentContainerStyle={[
                styles.messageList,
                { paddingHorizontal: horizontalPadding },
                messages.length === 0 && styles.emptyMessageList,
              ]}
              data={messages}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(message) => message.id}
              ListEmptyComponent={<RemoteWelcome onAsk={(prompt) => void send(prompt)} />}
              ListFooterComponent={isSending ? (
                <View accessibilityLiveRegion="polite" style={styles.progressRow}>
                  <ActivityIndicator size="small" color={appColors.primary} />
                  <Text style={styles.progressText}>Coach is reviewing the available banking data…</Text>
                </View>
              ) : <View style={styles.listFooter} />}
              ListHeaderComponent={conversationQuery.data && conversationQuery.isError ? (
                <View style={styles.listBanner}>
                  <StatusBanner
                    actionLabel="Retry"
                    actionAccessibilityLabel="Retry refreshing the Coach conversation"
                    iconName="refresh-outline"
                    message="Showing the latest saved messages available for your account."
                    onAction={() => void conversationQuery.refetch()}
                    title="Couldn’t refresh"
                    tone="warning"
                  />
                </View>
              ) : null}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: messages.length > 0 })}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
            />
          ) : null}

          {!isInitialLoading && !hasInitialError ? (
            <View style={[styles.composerWrap, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.composer}>
                <TextInput
                  accessibilityLabel="Ask Wealth Coach a question"
                  editable={!isSending}
                  maxLength={MAX_MESSAGE_LENGTH}
                  multiline
                  onChangeText={setInput}
                  onSubmitEditing={(event) => {
                    if (!event.nativeEvent.text.includes("\n")) void send();
                  }}
                  placeholder="Ask about spending, savings or goals…"
                  placeholderTextColor={appColors.textMuted}
                  returnKeyType="send"
                  submitBehavior="submit"
                  style={styles.input}
                  value={visibleInput}
                />
                {isSending ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Stop waiting for the Coach response"
                    onPress={stop}
                    style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="stop" size={17} color={appColors.danger} />
                    <Text style={styles.stopButtonText}>Stop</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send question"
                    accessibilityState={{ disabled: !visibleInput.trim() }}
                    disabled={!visibleInput.trim()}
                    onPress={() => void send()}
                    style={({ pressed }) => [
                      styles.sendButton,
                      !visibleInput.trim() && styles.sendButtonDisabled,
                      pressed && visibleInput.trim() && styles.sendButtonPressed,
                    ]}
                  >
                    <Ionicons name="arrow-up" size={21} color={appColors.surface} />
                  </Pressable>
                )}
              </View>
              <Text style={styles.privacyHint}>Never share your PIN, password, OTP or full card number.</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function RemoteWelcome({ onAsk }: { onAsk: (prompt: string) => void }) {
  const prompts = [
    "Where did I spend the most this month?",
    "How can I improve my savings?",
    "How am I progressing toward my goals?",
  ];

  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeIcon}>
        <Ionicons name="sparkles-outline" size={24} color={appColors.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.welcomeTitle}>Ask about your money</Text>
      <Text style={styles.welcomeDescription}>Coach uses the financial information available to your signed-in profile and shows the evidence included with each answer.</Text>
      <View style={styles.promptList}>
        {prompts.map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            accessibilityLabel={prompt}
            onPress={() => onAsk(prompt)}
            style={({ pressed }) => [styles.promptButton, pressed && styles.pressed]}
          >
            <Text style={styles.promptText}>{prompt}</Text>
            <Ionicons name="arrow-forward" size={18} color={appColors.primary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type RemoteMessageProps = {
  balanceVisible: boolean;
  disabled: boolean;
  message: ApiMessage;
  onFollowUp: (prompt: string) => void;
  onConsent: (granted:boolean) => void;
};

function RemoteMessage({ balanceVisible, disabled, message, onFollowUp, onConsent }: RemoteMessageProps) {
  const saveReport=useSaveCoachReport();
  const [sourcesOpen,setSourcesOpen]=useState(false);
  if (message.role === "user") {
    return (
      <View style={styles.userMessageWrap}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{financialText(message.content, "Financial question with hidden values", balanceVisible)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantMessage}>
      <View style={styles.assistantHeading}>
        <View style={styles.messageAvatar}>
          <Ionicons name="sparkles-outline" size={17} color={appColors.primary} />
        </View>
        <Text style={styles.assistantLabel}>Wealth Coach</Text>
      </View>
      <View style={styles.assistantBody}>
        <Text style={styles.assistantText}>{financialText(message.content, "This answer contains hidden financial values. Show balances to review it.", balanceVisible)}</Text>
        <WealthAnalysisResponse analysis={message.structuredPayloadJson?.analysis} balanceVisible={balanceVisible} />
        <StructuredEvidence
          balanceVisible={balanceVisible}
          disabled={disabled}
          onConsent={onConsent}
          onFollowUp={onFollowUp}
          payload={message.structuredPayloadJson}
        />
        {message.structuredPayloadJson?.transactions?.length ? <><Pressable accessibilityRole="button" onPress={()=>setSourcesOpen(true)} style={styles.followUpButton}><Text style={styles.followUpText}>Inspect all source transactions</Text><Ionicons name="open-outline" size={16} color={appColors.primary}/></Pressable><AnswerSources messageId={message.id} visible={sourcesOpen} balanceVisible={balanceVisible} onClose={()=>setSourcesOpen(false)} /></> : null}
        {message.structuredPayloadJson?.sources?.length ? <Pressable accessibilityRole="button" disabled={saveReport.isPending || saveReport.isSuccess} onPress={() => saveReport.mutate({messageId:message.id,title:'Coach summary'})} style={styles.followUpButton}><Text style={styles.followUpText}>{saveReport.isSuccess?'Summary saved':saveReport.isError?'Retry saving summary':'Save summary'}</Text></Pressable> : null}
      </View>
    </View>
  );
}

function StructuredEvidence({
  balanceVisible,
  disabled,
  onFollowUp,
  onConsent,
  payload,
}: {
  balanceVisible: boolean;
  disabled: boolean;
  onFollowUp: (prompt: string) => void;
  payload?: ApiCoachStructuredPayload | null;
  onConsent: (granted:boolean) => void;
}) {
  const router = useRouter();
  if (!payload) return null;

  const metricCards = Array.isArray(payload.cards)
    ? payload.cards.filter(isRenderableMetric)
    : [];
  const sources = Array.isArray(payload.sources)
    ? payload.sources.filter(isRenderableSource)
    : [];
  const prompts = Array.isArray(payload.suggestedPrompts)
    ? payload.suggestedPrompts.filter((prompt): prompt is string => typeof prompt === "string" && Boolean(prompt.trim()))
    : [];
  const showSourceLimitation = sources.length === 0 && metricCards.length > 0;



  return (
    <>
      {payload.consentRequired ? <View style={styles.sourcesCard}>
        <Text style={styles.sourcesTitle}>Your financial data, with your permission</Text>
        <Text style={styles.sourceMeta}>Allow Wealth Coach to analyze your linked accounts, cards and saved goals. You can revoke access using the shield button. General questions do not require access.</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onConsent(true)} style={styles.followUpButton}><Text style={styles.followUpText}>Allow and continue</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onConsent(false)} style={styles.followUpButton}><Text style={styles.followUpText}>Not now</Text></Pressable>
      </View> : null}
      {payload.dataEnvironment && payload.dataEnvironment !== 'unavailable' ? <Text style={styles.sourceMeta}>Data: {humanize(payload.dataEnvironment)}{payload.dataAsOf ? ` · As of ${new Date(payload.dataAsOf).toLocaleString()}` : ''}</Text> : null}
      {payload.chart?.length ? <View style={styles.sourcesCard} accessibilityLabel="Calculated spending chart">{payload.chart.map(row => {
        const maximum = Math.max(...payload.chart!.map(item => Number(item.amount)),1);
        return <View key={row.label} style={{marginVertical:6}}><Text style={styles.sourceLabel}>{financialText(`${humanize(row.label)} · ₹${row.amount}`, humanize(row.label), balanceVisible)}</Text>{balanceVisible ? <View style={{height:8,marginTop:6,borderRadius:4,backgroundColor:appColors.primary,width:`${Math.max(1,Number(row.amount)/maximum*100)}%`}} /> : null}</View>;
      })}</View> : null}
      {payload.transactions?.length ? <View style={styles.sourcesCard} accessibilityLabel="Matching transaction records"><Text style={styles.sourcesTitle}>Transactions behind this answer</Text>{payload.transactions.map(transaction => <Pressable key={transaction.id} accessibilityRole="button" onPress={() => router.push({pathname:'/(app)/activity/[transactionId]',params:{transactionId:transaction.id,...(transaction.accountId?{accountId:transaction.accountId}:{}),...(transaction.kind==='card'&&transaction.cardId?{cardId:transaction.cardId}:{})}})} style={styles.sourceRow}><View style={styles.sourceCopy}><Text style={styles.sourceLabel}>{financialText(transaction.merchant || transaction.description,'Transaction',balanceVisible)}</Text><Text style={styles.sourceMeta}>{new Date(transaction.transactionAt).toLocaleDateString()} · {transaction.status}</Text></View><Text style={styles.sourceLabel}>{financialText(`₹${transaction.amount}`,'Hidden amount',balanceVisible)}</Text><Ionicons name="chevron-forward" size={16} color={appColors.primary}/></Pressable>)}</View> : null}
      {payload.goals?.map(goal => <SaveGoalScenario key={goal.id} goal={goal} balanceVisible={balanceVisible} />)}
      {payload.warnings?.map(warning => <Text key={warning} style={styles.sourceMeta}>{warning}</Text>)}
      {metricCards.length > 0 ? (
        <View accessibilityLabel="Financial metrics" style={styles.metricsGrid}>
          {metricCards.map((card, index) => (
            <View key={`${card.title}-${index}`} style={styles.metricCard}>
              <Text style={styles.metricTitle}>{financialText(card.title, "Financial metric", balanceVisible)}</Text>
              <Text style={styles.metricValue}>{financialText(card.value ?? "", "Hidden amount", balanceVisible)}</Text>
              {card.description ? <Text style={styles.metricDescription}>{financialText(card.description, "Financial detail hidden", balanceVisible)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {sources.length > 0 || showSourceLimitation ? (
        <View style={styles.sourcesCard}>
          <View style={styles.sourcesHeading}>
            <Ionicons name="shield-checkmark-outline" size={18} color={appColors.primary} />
            <Text style={styles.sourcesTitle}>Based on</Text>
          </View>
          {sources.map((source, index) => (
            <View key={`${source.type}-${source.label ?? source.title ?? index}`} style={styles.sourceRow}>
              <View style={styles.sourceDot} />
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceLabel}>{financialText(sourceLabel(source), "Financial source", balanceVisible)}</Text>
                {source.period ? <Text style={styles.sourceMeta}>{humanize(source.period)}</Text> : null}
              </View>
            </View>
          ))}
          {showSourceLimitation ? (
            <View style={styles.sourceRow}>
              <View style={styles.sourceDot} />
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceLabel}>Linked accounts and recent transactions</Text>
                <Text style={styles.sourceMeta}>The banking service did not return item-level references for this answer.</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {!disabled && prompts.length > 0 ? (
        <View style={styles.followUps}>
          <Text style={styles.followUpsTitle}>Suggested follow-ups</Text>
          {prompts.map((prompt) => {
            const promptLabel = financialText(prompt, "Financial follow-up with hidden values", balanceVisible);
            return (
              <Pressable
                key={prompt}
                accessibilityRole="button"
                accessibilityLabel={`Ask Coach: ${promptLabel}`}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => onFollowUp(prompt)}
                style={({ pressed }) => [styles.followUpButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
              >
                <Text style={styles.followUpText}>{promptLabel}</Text>
                <Ionicons name="arrow-forward" size={17} color={appColors.primary} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

function AnswerSources({messageId,visible,balanceVisible,onClose}:{messageId:string;visible:boolean;balanceVisible:boolean;onClose:()=>void}) {
  const [page,setPage]=useState(1);
  const source=useCoachAnswerSources(messageId,page,visible);
  const router=useRouter();
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><ScreenContainer edges={['top','bottom']} backgroundColor={appColors.background}><View style={{flex:1,padding:20}}><View style={styles.sourcesHeading}><Text style={[styles.sourcesTitle,{flex:1}]}>Answer sources</Text><IconButton accessibilityLabel="Close answer sources" iconName="close" onPress={onClose}/></View><Text style={styles.sourceMeta}>Saved records used when this answer was calculated.</Text>{source.data?.calculation?<Text style={styles.metricDescription}>{source.data.calculation}</Text>:null}{source.isPending?<ActivityIndicator color={appColors.primary}/>:source.isError?<Pressable accessibilityRole="button" onPress={()=>void source.refetch()} style={styles.followUpButton}><Text style={styles.followUpText}>Sources unavailable. Retry</Text></Pressable>:<><Text style={styles.sourceMeta}>{source.data?.totalItems??0} source records · page {page} of {source.data?.totalPages??1}</Text><ScrollView>{source.data?.items.map(t=><Pressable accessibilityRole="button" key={`${t.kind}:${t.id}`} onPress={()=>{onClose();router.push({pathname:'/(app)/activity/[transactionId]',params:{transactionId:t.id,...(t.accountId?{accountId:t.accountId}:{}),...(t.kind==='card'&&t.cardId?{cardId:t.cardId}:{})}});}} style={styles.sourceRow}><View style={styles.sourceCopy}><Text style={styles.sourceLabel}>{financialText(t.merchant||t.description,'Transaction',balanceVisible)}</Text><Text style={styles.sourceMeta}>{new Date(t.transactionAt).toLocaleDateString()} · {t.status}</Text></View><Text style={styles.sourceLabel}>{financialText(`₹${t.amount}`,'Hidden amount',balanceVisible)}</Text></Pressable>)}</ScrollView><View style={{flexDirection:'row',justifyContent:'space-between'}}><Pressable accessibilityRole="button" disabled={page<=1} onPress={()=>setPage(p=>p-1)} style={styles.followUpButton}><Text>Previous</Text></Pressable><Pressable accessibilityRole="button" disabled={page>=(source.data?.totalPages??1)} onPress={()=>setPage(p=>p+1)} style={styles.followUpButton}><Text>Next</Text></Pressable></View></>}</View></ScreenContainer></Modal>;
}

function SaveGoalScenario({goal,balanceVisible}:{goal:NonNullable<ApiCoachStructuredPayload['goals']>[number];balanceVisible:boolean}) {
  const save=useSaveGoalContribution(goal.id);
  if(!goal.monthlyContribution || !goal.monthsToTarget) return null;
  return <View style={styles.metricCard}><Text style={styles.metricTitle}>{goal.title}</Text><Text style={styles.metricDescription}>{financialText(`At ₹${goal.monthlyContribution} per month: ${goal.monthsToTarget} months remaining, excluding returns.`,'Scenario values hidden',balanceVisible)}</Text><Pressable accessibilityRole="button" disabled={save.isPending||save.isSuccess} onPress={()=>save.mutate({monthlyContribution:goal.monthlyContribution!})} style={styles.followUpButton}><Text style={styles.followUpText}>{save.isSuccess?'Contribution saved':save.isError?'Retry saving contribution':'Save this contribution to my goal'}</Text></Pressable></View>;
}

function ConversationSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View accessibilityLabel="Loading conversation" style={styles.skeleton}>
      <View style={styles.skeletonAssistant}>
        <Skeleton opacity={opacity} style={styles.skeletonAvatar} />
        <View style={styles.skeletonCopy}>
          <Skeleton opacity={opacity} style={styles.skeletonLineLong} />
          <Skeleton opacity={opacity} style={styles.skeletonLineMedium} />
          <Skeleton opacity={opacity} style={styles.skeletonCard} />
        </View>
      </View>
      <Skeleton opacity={opacity} style={styles.skeletonUser} />
    </View>
  );
}

function isRenderableMetric(card: ApiCoachStructuredCard): card is ApiCoachStructuredCard & { title: string; value: string } {
  return card?.type === "metric" && typeof card.title === "string" && Boolean(card.title.trim()) && typeof card.value === "string" && Boolean(card.value.trim());
}

function isRenderableSource(source: ApiCoachSource): boolean {
  return Boolean(source && typeof source.type === "string" && source.type.trim());
}

function sourceLabel(source: ApiCoachSource): string {
  if (typeof source.label === "string" && source.label.trim()) return source.label.trim();
  if (typeof source.title === "string" && source.title.trim()) return source.title.trim();
  return humanize(source.type);
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function financialText(value: string, fallback: string, balanceVisible: boolean): string {
  return balanceVisible ? formatINRInText(value) : privacySafeFinancialText(value, fallback);
}

function coachErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "We couldn’t connect to the banking service. Check your connection and try again.";
    if (error.code === "REQUEST_TIMEOUT") return "The Coach request took too long to respond. Please try again.";
    if (["DATABASE_UNAVAILABLE", "DATABASE_TIMEOUT", "DATABASE_CONNECTION_ERROR", "FINANCIAL_DATA_UNAVAILABLE"].includes(error.code)) {
      return "Your financial data is temporarily unavailable. Please try again.";
    }
    if (["AUTH_NOT_CONFIGURED", "UNAUTHORIZED", "USER_NOT_PROVISIONED", "USER_INACTIVE"].includes(error.code)) {
      return "Your session could not be verified. Please sign in again.";
    }
  }
  if (error instanceof ApiError && error.status === 404) {
    return "This conversation is unavailable or you no longer have access to it.";
  }
  if (error instanceof ApiError && ["MODEL_NOT_CONFIGURED", "MODEL_AUTH_FAILED", "MODEL_UNAVAILABLE", "MODEL_RATE_LIMITED", "MODEL_REQUEST_INVALID", "MODEL_TIMEOUT", "MODEL_INCOMPLETE", "MODEL_INVALID_RESPONSE", "INVALID_QUERY_PLAN", "COACH_UNAVAILABLE", "CONSENT_REQUIRED", "RUN_IN_PROGRESS", "IDEMPOTENCY_CONFLICT"].includes(error.code)) return `${error.message}${error.requestId ? ` Reference: ${error.requestId}` : ""}`;
  const message = apiErrorMessage(error, "Coach information");
  return message || fallback;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { paddingTop: appSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.divider },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { marginLeft: 2, color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "600" },
  headerMain: { minHeight: 64, flexDirection: "row", alignItems: "center" },
  coachAvatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.primarySoft },
  coachAvatarWorking: { backgroundColor: appColors.warningSoft },
  headerCopy: { flex: 1, minWidth: 0, marginLeft: appSpacing.md },
  headerTitle: { color: appColors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  headerSubtitle: { marginTop: 1, color: appColors.textSecondary, ...appTypography.metadata },
  headerActions: { flexDirection: "row", columnGap: appSpacing.xs, marginLeft: appSpacing.sm },
  banner: { marginTop: appSpacing.md },
  stateContent: { flex: 1, justifyContent: "center" },
  messageList: { flexGrow: 1, paddingTop: appSpacing.lg },
  emptyMessageList: { justifyContent: "center" },
  listFooter: { height: appSpacing.lg },
  listBanner: { marginBottom: appSpacing.lg },
  welcome: { width: "100%", maxWidth: 560, alignSelf: "center", alignItems: "center", paddingVertical: appSpacing.xxl },
  welcomeIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.primarySoft },
  welcomeTitle: { marginTop: appSpacing.md, color: appColors.textPrimary, ...appTypography.sectionTitle, textAlign: "center" },
  welcomeDescription: { marginTop: appSpacing.sm, color: appColors.textBody, ...appTypography.supporting, textAlign: "center" },
  promptList: { width: "100%", marginTop: appSpacing.xl, rowGap: appSpacing.sm },
  promptButton: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: appSpacing.md, paddingVertical: 10, borderRadius: appRadii.control, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border, backgroundColor: appColors.surface },
  promptText: { flex: 1, marginRight: appSpacing.sm, color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "600" },
  userMessageWrap: { alignItems: "flex-end", marginVertical: 6 },
  userBubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: appRadii.medium, borderBottomRightRadius: appSpacing.xs, backgroundColor: appColors.primary },
  userText: { color: appColors.surface, ...appTypography.supporting },
  assistantMessage: { marginVertical: appSpacing.md },
  assistantHeading: { flexDirection: "row", alignItems: "center", marginBottom: appSpacing.sm },
  messageAvatar: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.primarySoft },
  assistantLabel: { marginLeft: appSpacing.sm, color: appColors.textSecondary, ...appTypography.metadata, fontWeight: "700" },
  assistantBody: { paddingLeft: 44 },
  assistantText: { color: appColors.textPrimary, ...appTypography.body, fontSize: 15, lineHeight: 23 },
  metricsGrid: { marginTop: appSpacing.md, rowGap: appSpacing.sm },
  metricCard: { minHeight: 88, justifyContent: "center", padding: appSpacing.md, borderRadius: appRadii.medium, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border, backgroundColor: appColors.surface },
  metricTitle: { color: appColors.textSecondary, ...appTypography.metadata, fontWeight: "600" },
  metricValue: { marginTop: appSpacing.xs, color: appColors.textPrimary, ...appTypography.amount },
  metricDescription: { marginTop: appSpacing.xs, color: appColors.textBody, ...appTypography.metadata },
  sourcesCard: { marginTop: appSpacing.md, padding: appSpacing.md, borderRadius: appRadii.medium, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.primaryBorder, backgroundColor: appColors.primarySoft },
  sourcesHeading: { minHeight: 24, flexDirection: "row", alignItems: "center" },
  sourcesTitle: { marginLeft: appSpacing.sm, color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "700" },
  sourceRow: { minHeight: 36, flexDirection: "row", alignItems: "center", marginTop: appSpacing.xs },
  sourceDot: { width: 6, height: 6, marginHorizontal: 6, borderRadius: appRadii.round, backgroundColor: appColors.primary },
  sourceCopy: { flex: 1, minWidth: 0, marginLeft: appSpacing.sm },
  sourceLabel: { color: appColors.textPrimary, ...appTypography.metadata, fontWeight: "600" },
  sourceMeta: { marginTop: 1, color: appColors.textSecondary, fontSize: 11, lineHeight: 15 },
  followUps: { marginTop: appSpacing.lg, rowGap: appSpacing.sm },
  followUpsTitle: { color: appColors.textSecondary, ...appTypography.metadata, fontWeight: "700" },
  followUpButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: appSpacing.md, paddingVertical: appSpacing.sm, borderRadius: appRadii.control, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.primaryBorder, backgroundColor: appColors.surface },
  followUpText: { flex: 1, marginRight: appSpacing.sm, color: appColors.primaryPressed, ...appTypography.supporting, fontWeight: "600" },
  progressRow: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingVertical: appSpacing.sm },
  progressText: { flex: 1, marginLeft: appSpacing.sm, color: appColors.textSecondary, ...appTypography.metadata },
  composerWrap: { paddingTop: appSpacing.sm, paddingBottom: appSpacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: appColors.divider, backgroundColor: appColors.background },
  composer: { minHeight: 56, maxHeight: 128, flexDirection: "row", alignItems: "flex-end", paddingLeft: 14, paddingRight: 6, paddingVertical: 6, borderRadius: appRadii.medium, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 112, paddingTop: 11, paddingBottom: 9, color: appColors.textPrimary, ...appTypography.supporting },
  sendButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.primary },
  stopButton: { minWidth: 72, height: 44, paddingHorizontal: appSpacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: appRadii.control, backgroundColor: appColors.dangerSoft },
  stopButtonText: { marginLeft: appSpacing.xs, color: appColors.danger, ...appTypography.metadata, fontWeight: "700" },
  sendButtonDisabled: { backgroundColor: appColors.disabled },
  sendButtonPressed: { backgroundColor: appColors.primaryPressed },
  privacyHint: { paddingTop: 5, color: appColors.textMuted, fontSize: 10, lineHeight: 14 },
  errorPanel: { alignItems: "center", paddingVertical: appSpacing.xxl },
  errorIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.dangerSoft },
  errorTitle: { marginTop: appSpacing.md, color: appColors.textPrimary, ...appTypography.sectionTitle, textAlign: "center" },
  errorDescription: { maxWidth: 420, marginTop: appSpacing.sm, color: appColors.textBody, ...appTypography.supporting, textAlign: "center" },
  primaryButton: { minHeight: 44, marginTop: appSpacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: appSpacing.sm, paddingHorizontal: appSpacing.lg, borderRadius: appRadii.control, backgroundColor: appColors.primary },
  primaryButtonText: { color: appColors.surface, ...appTypography.supporting, fontWeight: "700" },
  skeleton: { width: "100%", paddingVertical: appSpacing.xl },
  skeletonAssistant: { flexDirection: "row" },
  skeletonAvatar: { width: 36, height: 36, borderRadius: appRadii.round },
  skeletonCopy: { flex: 1, marginLeft: appSpacing.sm },
  skeletonLineLong: { width: "88%", height: 14, borderRadius: appRadii.small },
  skeletonLineMedium: { width: "66%", height: 14, marginTop: appSpacing.sm, borderRadius: appRadii.small },
  skeletonCard: { width: "100%", height: 92, marginTop: appSpacing.md, borderRadius: appRadii.medium },
  skeletonUser: { width: "58%", height: 58, alignSelf: "flex-end", marginTop: appSpacing.xxl, borderRadius: appRadii.medium },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
