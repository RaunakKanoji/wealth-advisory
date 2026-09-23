import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { RecommendationCard } from "@/components/coach/recommendation-card";
import { AppHeader } from "@/components/navigation/app-header";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appSpacing } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { useWealthSummary } from "@/lib/api/hooks";
import { apiRecommendationToCoachRecommendation } from "@/lib/api/view-models";

export default function CoachRecommendationsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const { balanceVisible } = useBalanceVisibility(customerId, true);
  const summary = useWealthSummary();
  const recommendations = useMemo(
    () => (summary.data?.recommendations ?? []).map(apiRecommendationToCoachRecommendation).filter((item) => item.isEligible).sort((left, right) => left.priority - right.priority),
    [summary.data],
  );
  const opacity = useSkeletonPulse();

  return (
    <ScreenContainer edges={["bottom"]}>
      <AppHeader sourceRoute="coach" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={appColors.primary} refreshing={summary.isFetching} onRefresh={() => void summary.refetch()} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Wealth Coach" onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/coach")} style={styles.back}>
          <Text style={styles.backText}>‹  Back to Coach</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>Recommended for you</Text>
          <Text style={styles.subtitle}>Actionable next steps selected from your latest linked-account activity.</Text>
        </View>

        {summary.isPending ? (
          <View accessibilityLabel="Loading recommendations" style={styles.skeletons}>
            <Skeleton opacity={opacity} style={styles.skeletonCard} />
            <Skeleton opacity={opacity} style={styles.skeletonCard} />
          </View>
        ) : summary.isError ? (
          <StatusBanner actionLabel="Retry" message="We couldn’t load recommendations right now." onAction={() => void summary.refetch()} title="Recommendations unavailable" tone="warning" />
        ) : recommendations.length ? (
          recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={balanceVisible ? recommendation : { ...recommendation, title: "A recommendation for your goals", description: "Your Wealth Coach has a next step based on your available financial context.", reason: "Open to review the supporting context." }}
              onPress={() => {
                if (recommendation.category === "emergency-fund") {
                  const goalId = recommendation.route.split("/").pop();
                  if (goalId) {
                    router.push({ pathname: "/(app)/coach/goal/[goalId]", params: { goalId } });
                    return;
                  }
                }
                router.push({ pathname: "/(app)/coach/recommendation/[recommendationId]", params: { recommendationId: recommendation.id } });
              }}
            />
          ))
        ) : (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No recommendations right now</Text><Text style={styles.emptyBody}>Your Coach will surface a next step when your financial context supports it.</Text></View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: appSpacing.xl, paddingBottom: 40 },
  back: { minHeight: 44, justifyContent: "center" },
  backText: { color: appColors.textPrimary, fontSize: 17, fontWeight: "600" },
  heading: { marginTop: 22 },
  title: { color: appColors.textPrimary, fontSize: 28, lineHeight: 36, fontWeight: "700" },
  subtitle: { marginTop: 8, color: appColors.textSecondary, fontSize: 15, lineHeight: 21 },
  skeletons: { rowGap: 12, marginTop: 20 },
  skeletonCard: { height: 106, borderRadius: 22 },
  empty: { marginTop: 18, padding: 18, borderRadius: 20, backgroundColor: appColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border },
  emptyTitle: { color: appColors.textPrimary, fontSize: 16, fontWeight: "700" },
  emptyBody: { marginTop: 5, color: appColors.textSecondary, fontSize: 14, lineHeight: 19 },
});
