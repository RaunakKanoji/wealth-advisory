import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AskCoachComposer,
  CoachPageHeader,
  CoachTopicActions,
  CoachSkeletons,
  GoalsSection,
  InsightsSection,
  RecentConversations,
  RecommendationsSection,
} from "@/components/coach";
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import type { CoachConversationListItem } from "@/components/coach/conversation-row";
import { activityParamsForInsight } from "@/components/coach/insight-presentation";
import { Surface } from "@/components/design-system";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { isRemoteCoachEnabled, isRemoteDataEnabled } from "@/lib/env";
import { useCoachConversations, useFinancialData, useGoals, useInsights, useWealthSummary } from "@/lib/api/hooks";
import { apiGoalToFinancialGoal, apiInsightToCoachWealthInsight, apiRecommendationToCoachRecommendation, apiWealthSummaryToSnapshotDashboard } from "@/lib/api/view-models";
import { useLoadingTimeout } from "@/lib/use-loading-timeout";
import { useDemoSession } from "@/lib/demo-session";
import { listCoachConversations } from "@/services/wealth-coach-conversation-service";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";
import type { WealthCoachDashboard } from "@/types/wealth-coach";

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const remoteAccounts = useFinancialData();
  const remoteWealth = useWealthSummary();
  const remoteInsights = useInsights();
  const remoteGoals = useGoals();
  const remoteConversations = useCoachConversations(isRemoteCoachEnabled);
  const { data: remoteWealthData, error: remoteWealthError, isLoading: remoteWealthLoading, refetch: refetchRemoteWealth } = remoteWealth;
  const { data: remoteConversationsData, error: remoteConversationsError, refetch: refetchRemoteConversations } = remoteConversations;
  const [stateCustomerId, setStateCustomerId] = useState(customerId);
  const [loadState, setLoadState] = useState<LoadState>(() => isRemoteDataEnabled && remoteWealthData ? "ready" : "loading");
  const [dashboard, setDashboard] = useState<WealthCoachDashboard | null>(() => isRemoteDataEnabled && remoteWealthData ? apiWealthSummaryToSnapshotDashboard(remoteWealthData) : null);
  const [conversations, setConversations] = useState<CoachConversationListItem[]>(() => isRemoteCoachEnabled ? remoteConversationsData?.items ?? [] : []);
  const [conversationError, setConversationError] = useState<string | undefined>();
  const [isConversationInitialLoading, setIsConversationInitialLoading] = useState(() => isRemoteCoachEnabled ? !remoteConversationsData : true);
  const [dashboardError, setDashboardError] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isDemoUserReady);
  const hasLoadedDashboard = useRef(Boolean(isRemoteDataEnabled && remoteWealthData));
  const activeCustomerId = useRef(customerId);
  activeCustomerId.current = customerId;

  const mappedRemoteInsights = useMemo(
    () => remoteInsights.data ? remoteInsights.data.items.map(apiInsightToCoachWealthInsight) : null,
    [remoteInsights.data],
  );
  const mappedRemoteGoals = useMemo(
    () => remoteGoals.data ? remoteGoals.data.items.map(apiGoalToFinancialGoal) : null,
    [remoteGoals.data],
  );
  const mappedRemoteRecommendations = useMemo(
    () => remoteWealthData ? (remoteWealthData.recommendations ?? []).map(apiRecommendationToCoachRecommendation) : null,
    [remoteWealthData],
  );
  const isCurrentCustomer = stateCustomerId === customerId;
  const visibleDashboard = isCurrentCustomer ? dashboard : null;
  const visibleConversations = isCurrentCustomer ? conversations : [];
  const visibleConversationError = isCurrentCustomer ? conversationError : undefined;
  const visibleConversationLoading = !isCurrentCustomer || isConversationInitialLoading;
  const visibleLoadState: LoadState = isCurrentCustomer ? loadState : "loading";
  const insights = isRemoteDataEnabled ? mappedRemoteInsights : visibleDashboard?.insights ?? null;
  const goals = isRemoteDataEnabled ? mappedRemoteGoals : visibleDashboard?.goals ?? null;
  const recommendations = isRemoteDataEnabled ? mappedRemoteRecommendations : visibleDashboard?.recommendations ?? null;
  const insightsLoading = isRemoteDataEnabled
    ? !mappedRemoteInsights && (remoteInsights.isPending || remoteInsights.isFetching)
    : visibleLoadState === "loading";
  const goalsLoading = isRemoteDataEnabled
    ? !mappedRemoteGoals && (remoteGoals.isPending || remoteGoals.isFetching)
    : visibleLoadState === "loading";
  const insightsError = isRemoteDataEnabled
    ? remoteInsights.isError
    : visibleLoadState === "error" || Boolean(dashboardError);
  const goalsError = isRemoteDataEnabled
    ? remoteGoals.isError
    : visibleLoadState === "error" || Boolean(dashboardError);
  const isAuthLoading = !isDemoUserReady || !isBalanceVisibilityHydrated;
  const { timedOut: loadingTimedOut, reset: resetLoadingTimeout } = useLoadingTimeout(isAuthLoading);

  useEffect(() => {
    if (stateCustomerId === customerId) return;
    hasLoadedDashboard.current = false;
    setStateCustomerId(customerId);
    setDashboard(null);
    setLoadState("loading");
    setDashboardError(undefined);
    setIsRefreshing(false);
    setConversations([]);
    setConversationError(undefined);
    setIsConversationInitialLoading(true);
  }, [customerId, stateCustomerId]);

  const loadDashboard = useCallback(async () => {
    const requestedCustomerId = customerId;
    if (isRemoteDataEnabled) {
      if (!hasLoadedDashboard.current) setLoadState("loading");
      else setIsRefreshing(true);
      try {
        const result = await refetchRemoteWealth();
        if (activeCustomerId.current !== requestedCustomerId) return;
        if (result.error || !result.data) throw new Error("Remote wealth data unavailable");
        setDashboard(apiWealthSummaryToSnapshotDashboard(result.data));
        setStateCustomerId(requestedCustomerId);
        hasLoadedDashboard.current = true;
        setLoadState("ready");
        setDashboardError(undefined);
      } catch {
        if (activeCustomerId.current !== requestedCustomerId) return;
        if (!hasLoadedDashboard.current) setLoadState("error");
        else setDashboardError("We couldn’t refresh the monthly overview. Showing the last successful data.");
      } finally {
        if (activeCustomerId.current === requestedCustomerId) setIsRefreshing(false);
      }
      return;
    }
    if (!hasLoadedDashboard.current) setLoadState("loading");
    else setIsRefreshing(true);
    try {
      const nextDashboard = await getWealthCoachDashboard({ customerId });
      if (activeCustomerId.current !== requestedCustomerId) return;
      setDashboard(nextDashboard);
      setStateCustomerId(requestedCustomerId);
      hasLoadedDashboard.current = true;
      setLoadState("ready");
      setDashboardError(undefined);
    } catch {
      if (activeCustomerId.current !== requestedCustomerId) return;
      if (!hasLoadedDashboard.current) setLoadState("error");
      else setDashboardError("We couldn’t refresh the monthly overview. Showing the last successful data.");
    } finally {
      if (activeCustomerId.current === requestedCustomerId) setIsRefreshing(false);
    }
  }, [customerId, refetchRemoteWealth]);

  const loadConversations = useCallback(async () => {
    const requestedCustomerId = customerId;
    if (isRemoteCoachEnabled) {
      try {
        const result = await refetchRemoteConversations();
        if (activeCustomerId.current !== requestedCustomerId) return;
        if (result.error || !result.data) throw new Error("Remote conversations unavailable");
        setConversations(result.data.items);
        setStateCustomerId(requestedCustomerId);
        setConversationError(undefined);
      } catch {
        if (activeCustomerId.current !== requestedCustomerId) return;
        setConversationError("Recent conversations are unavailable right now.");
      } finally {
        if (activeCustomerId.current === requestedCustomerId) setIsConversationInitialLoading(false);
      }
      return;
    }
    try {
      const nextConversations = await listCoachConversations(customerId);
      if (activeCustomerId.current !== requestedCustomerId) return;
      setConversations(nextConversations);
      setStateCustomerId(requestedCustomerId);
      setConversationError(undefined);
    } catch {
      if (activeCustomerId.current !== requestedCustomerId) return;
      setConversationError("Recent conversations are unavailable right now.");
    } finally {
      if (activeCustomerId.current === requestedCustomerId) setIsConversationInitialLoading(false);
    }
  }, [customerId, refetchRemoteConversations]);

  useEffect(() => {
    if (!isRemoteDataEnabled) return;
    if (remoteWealthData) {
      setDashboard(apiWealthSummaryToSnapshotDashboard(remoteWealthData));
      setStateCustomerId(customerId);
      hasLoadedDashboard.current = true;
      setLoadState("ready");
      setDashboardError(remoteWealthError ? "We couldn’t refresh the monthly overview. Showing the last successful data." : undefined);
    } else if (remoteWealthError && !hasLoadedDashboard.current) {
      setLoadState("error");
    } else if (remoteWealthLoading && !hasLoadedDashboard.current) {
      setLoadState("loading");
    }
  }, [customerId, remoteWealthData, remoteWealthError, remoteWealthLoading]);

  useEffect(() => {
    if (!isRemoteCoachEnabled) return;
    if (remoteConversationsData) {
      setConversations(remoteConversationsData.items);
      setStateCustomerId(customerId);
      setIsConversationInitialLoading(false);
      setConversationError(undefined);
    } else if (remoteConversationsError) {
      setIsConversationInitialLoading(false);
      setConversationError("Recent conversations are unavailable right now.");
    }
  }, [customerId, remoteConversationsData, remoteConversationsError]);

  useEffect(() => {
    if (!isDemoUserReady) return;
    if (!isRemoteDataEnabled) void loadDashboard();
    if (!isRemoteCoachEnabled) void loadConversations();
  }, [isDemoUserReady, loadConversations, loadDashboard]);

  const retryInsights = useCallback(() => {
    if (isRemoteDataEnabled) {
      void remoteInsights.refetch();
      return;
    }
    void loadDashboard();
  }, [loadDashboard, remoteInsights]);

  const retryGoals = useCallback(() => {
    if (isRemoteDataEnabled) {
      void remoteGoals.refetch();
      return;
    }
    void loadDashboard();
  }, [loadDashboard, remoteGoals]);

  const refreshAll = useCallback(() => {
    resetLoadingTimeout();
    if (isRemoteDataEnabled) {
      void Promise.all([
        remoteAccounts.refetch(),
        loadDashboard(),
        remoteInsights.refetch(),
        remoteGoals.refetch(),
        loadConversations(),
      ]);
      return;
    }
    void Promise.all([loadDashboard(), loadConversations()]);
  }, [loadConversations, loadDashboard, remoteAccounts, remoteGoals, remoteInsights, resetLoadingTimeout]);

  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });


  const openChat = useCallback((initialPrompt?: string, autoSubmit = false) => {
    router.push({
      pathname: "/(app)/coach/new",
      params: initialPrompt
        ? {
            prompt: initialPrompt,
            ...(autoSubmit ? { submitIntent: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` } : {}),
          }
        : undefined,
    });
  }, [router]);

  const openNewConversation = useCallback(() => openChat(), [openChat]);
  const submitCoachQuestion = useCallback((question: string) => openChat(question, true), [openChat]);

  const openInsight = useCallback((insightId: string) => {
    const insight = insights?.find((item) => item.id === insightId);
    const activityParams = insight ? activityParamsForInsight(insight) : null;
    if (activityParams) {
      router.push({
        pathname: "/(app)/activity",
        params: {
          period: activityParams.period,
          source: "insights",
          insightId,
          ...(activityParams.category ? { category: activityParams.category } : {}),
        },
      });
      return;
    }
    router.push({ pathname: "/(app)/coach/insight/[insightId]", params: { insightId } });
  }, [insights, router]);

  const openGoal = useCallback((goalId: string) => {
    router.push({ pathname: "/(app)/coach/goal/[goalId]", params: { goalId } });
  }, [router]);

  const openRecommendation = useCallback((recommendationId: string) => {
    const recommendation = recommendations?.find((item) => item.id === recommendationId);
    if (recommendation?.category === "emergency-fund") {
      const goalId = recommendation.route.split("/").pop();
      if (goalId) {
        openGoal(goalId);
        return;
      }
    }
    router.push({ pathname: "/(app)/coach/recommendation/[recommendationId]", params: { recommendationId } });
  }, [openGoal, recommendations, router]);

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.contentInner, { maxWidth: isTablet ? 720 : undefined, paddingHorizontal: horizontalPadding, paddingBottom: 28 + tabBarHeight }]}>
          <CoachPageHeader
            onNewConversation={openNewConversation}
            onRefresh={refreshAll}
            isRefreshing={visibleLoadState === "loading" || isRefreshing || remoteAccounts.isFetching || remoteInsights.isFetching || remoteGoals.isFetching || remoteConversations.isFetching}
          />

          {isAuthLoading && !loadingTimedOut ? (
            <CoachSkeletons />
          ) : isAuthLoading && loadingTimedOut ? (
            <StatusBanner
              actionLabel="Retry"
              actionAccessibilityLabel="Retry loading Wealth Coach"
              message="The banking service did not finish loading. Check your connection and try again."
              onAction={refreshAll}
              title="Wealth Coach data is taking too long"
              tone="warning"
            />
          ) : (
            <>
              <CoachAskExperience key={customerId} onSubmit={submitCoachQuestion} />

              <View style={styles.sectionGap}>
                <InsightsSection
                  insights={insights ?? []}
                  goals={goals ?? []}
                  recommendations={recommendations ?? []}
                  onViewAll={() => router.push("/(app)/coach/insights")}
                  onInsightPress={openInsight}
                  onRecommendationPress={openRecommendation}
                  onGoalPress={openGoal}
                  onAskCoach={openChat}
                  balanceVisible={balanceVisible}
                  errorMessage={insightsError ? "We couldn’t load your latest financial insights. Try again without leaving the rest of Wealth Coach." : undefined}
                  isLoading={insightsLoading}
                  onRetry={retryInsights}
                />
              </View>

              {recommendations && recommendations.length > 1 ? (
                <View style={styles.sectionGap}>
                  <RecommendationsSection
                    recommendations={recommendations.slice(1)}
                    onViewAll={() => router.push("/(app)/coach/recommendations")}
                    onRecommendationPress={openRecommendation}
                  />
                </View>
              ) : null}

              <View style={styles.sectionGap}>
                <GoalsSection
                  goals={goals ?? []}
                  onViewAll={() => router.push("/(app)/coach/goals")}
                  onGoalPress={openGoal}
                  onCreateGoal={() => openChat("Help me create a financial goal.")}
                  balanceVisible={balanceVisible}
                  errorMessage={goalsError ? "We couldn’t load your financial goals. Try again without leaving the rest of Wealth Coach." : undefined}
                  isLoading={goalsLoading}
                  onRetry={retryGoals}
                />
              </View>

              <View style={styles.sectionGap}>
                <RecentConversations
                  conversations={visibleConversations}
                  onViewAll={() => router.push("/(app)/coach/history")}
                  onConversationPress={(conversationId) => router.push({ pathname: "/(app)/coach/chat", params: { conversationId } })}
                  onStartConversation={openNewConversation}
                  balanceVisible={balanceVisible}
                  errorMessage={visibleConversationError}
                  isLoading={visibleConversationLoading}
                  onRetry={() => void loadConversations()}
                  title={isRemoteDataEnabled && !isRemoteCoachEnabled ? "Demo Coach conversations" : undefined}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AskSectionHeading() {
  return (
    <View style={styles.askHeader}>
      <View style={styles.askIcon}>
        <Ionicons name="sparkles-outline" size={18} color={appColors.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.askTitle}>Ask your Wealth Coach</Text>
    </View>
  );
}

function CoachAskExperience({ onSubmit }: { onSubmit: (question: string) => void }) {
  const [draft, setDraft] = useState("");
  const composerRef = React.useRef<TextInput>(null);

  const handleTopicSelect = useCallback((question: string) => {
    setDraft(question);
    setTimeout(() => composerRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback((question: string) => {
    setDraft("");
    onSubmit(question);
  }, [onSubmit]);

  return (
    <>
      <CoachTopicActions onSelect={handleTopicSelect} />
      <Surface style={styles.askSection}>
        <AskSectionHeading />
        <AskCoachComposer
          value={draft}
          onChangeText={setDraft}
          inputRef={composerRef}
          helperText={isRemoteCoachEnabled
            ? "Based on your linked accounts"
            : isRemoteDataEnabled
              ? "Coach preview uses clearly labelled sample data"
              : "Based on your linked demo accounts"}
          maxLength={isRemoteCoachEnabled ? 1_000 : 1_200}
          onSubmit={handleSubmit}
        />
      </Surface>
    </>
  );
}

type LoadState = "loading" | "ready" | "error";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    width: "100%",
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
    paddingTop: appSpacing.xxl,
  },
  statusSpacing: {
    marginBottom: appSpacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
  askSection: {
    marginTop: appSpacing.lg,
    paddingHorizontal: appSpacing.lg,
    paddingTop: appSpacing.lg,
    paddingBottom: 14,
    borderRadius: appRadii.card,
  },
  askHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  askIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  askTitle: {
    flex: 1,
    marginLeft: appSpacing.md,
    color: appColors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  sectionGap: {
    marginTop: 28,
  },
});
