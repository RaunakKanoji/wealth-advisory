import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AskCoachButton,
  CoachPageHeader,
  CoachSkeletons,
  FinancialSnapshotCard,
  InsightsSection,
  RecommendationsSection,
} from "@/components/coach";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";
import type { WealthCoachDashboard } from "@/types/wealth-coach";

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [dashboard, setDashboard] = useState<WealthCoachDashboard | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoadState("loading");
    setDashboard(null);

    try {
      const nextDashboard = await getWealthCoachDashboard();
      setDashboard(nextDashboard);
      setLoadState(isDashboardEmpty(nextDashboard) ? "empty" : "ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!isUserLoaded) {
      return;
    }

    void loadDashboard();
  }, [isUserLoaded, loadDashboard, user?.id]);

  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });

  const openNewConversation = useCallback(() => {
    router.push("/(app)/coach/new");
  }, [router]);

  const openChat = useCallback(() => {
    router.push({
      pathname: "/(app)/coach/chat",
      params: { source: "coach-dashboard" },
    });
  }, [router]);

  const openInsight = useCallback(
    (insightId: string) => {
      router.push({
        pathname: "/(app)/coach/insight/[insightId]",
        params: { insightId },
      });
    },
    [router],
  );

  const openGoal = useCallback(
    (goalId: string) => {
      router.push({
        pathname: "/(app)/coach/insight/[insightId]",
        params: { insightId: goalId },
      });
    },
    [router],
  );

  const openRecommendation = useCallback(
    (recommendationId: string) => {
      router.push({
        pathname: "/(app)/coach/recommendation/[recommendationId]",
        params: { recommendationId },
      });
    },
    [router],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.contentInner,
            {
              maxWidth: isTablet ? 720 : undefined,
              paddingHorizontal: horizontalPadding,
              paddingBottom: 34 + tabBarHeight,
            },
          ]}
        >
          <CoachPageHeader
            isLoading={loadState === "loading" || !isUserLoaded}
            showSubtitle={false}
            onNewConversation={openNewConversation}
          />

          {loadState === "loading" || !isUserLoaded ? (
            <CoachSkeletons />
          ) : loadState === "error" ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>
                We couldn’t load your Wealth Coach insights.
              </Text>
              <Text style={styles.stateDescription}>
                Please check your connection and try again.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading Wealth Coach insights"
                onPress={() => void loadDashboard()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : loadState === "empty" || !dashboard ? (
            <View style={styles.stateCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sparkles-outline" size={27} color="#007E5D" />
              </View>
              <Text style={styles.stateTitle}>Your insights are getting ready</Text>
              <Text style={styles.stateDescription}>
                As you use your IDBI accounts, Wealth Coach will surface personalised
                observations and recommendations here.
              </Text>
              <AskCoachButton onPress={openChat} compact />
            </View>
          ) : (
            <>
              <FinancialSnapshotCard
                metrics={dashboard.metrics}
                onAskCoach={openChat}
              />

              <View style={styles.sectionGap}>
                <InsightsSection
                  insights={dashboard.insights}
                  retirementGoal={dashboard.goals.find((goal) => goal.id === "retirement-fund")}
                  onViewAll={() => router.push("/(app)/coach/insights")}
                  onInsightPress={openInsight}
                  onGoalPress={openGoal}
                />
              </View>

              <View style={styles.sectionGap}>
                <RecommendationsSection
                  recommendations={dashboard.recommendations}
                  onViewAll={() => router.push("/(app)/coach/recommendations")}
                  onRecommendationPress={openRecommendation}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type LoadState = "loading" | "ready" | "error" | "empty";

function isDashboardEmpty(dashboard: WealthCoachDashboard): boolean {
  return (
    dashboard.metrics.length === 0 &&
    dashboard.insights.length === 0 &&
    dashboard.goals.length === 0 &&
    dashboard.recommendations.length === 0
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  scrollContent: {
    width: "100%",
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 24,
  },
  sectionGap: {
    marginTop: 30,
  },
  stateCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EBEF",
  },
  stateTitle: {
    color: "#111827",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 320,
    marginTop: 8,
    color: "#687386",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#006647",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderRadius: 27,
    backgroundColor: "#E9F5F2",
  },
  pressed: {
    opacity: 0.78,
  },
});
