import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Surface } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import type { FinancialGoal } from "@/types/wealth-coach";

import { GoalProgressCard } from "./goal-progress-card";
import { useWealthCoachGoalsData } from "./use-wealth-coach-goals";

const CREATE_GOAL_PROMPT = "Help me create a financial goal.";

export function CoachGoalsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    balanceVisible,
    goals: availableGoals,
    hasLoadError,
    hasRefreshError,
    isLoading: isPageLoading,
    isRefreshing: isRetrying,
    retry,
  } = useWealthCoachGoalsData();
  const goals = availableGoals ?? [];
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;

  const goBackToCoach = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)/coach");
  }, [router]);

  const createGoal = useCallback(() => {
    router.push({
      pathname: "/(app)/coach/new",
      params: { prompt: CREATE_GOAL_PROMPT },
    });
  }, [router]);

  const openGoal = useCallback((goalId: string) => {
    router.push({
      pathname: "/(app)/coach/goal/[goalId]",
      params: { goalId },
    });
  }, [router]);

  const renderGoal = useCallback(({ item }: ListRenderItemInfo<FinancialGoal>) => (
    <GoalProgressCard balanceVisible={balanceVisible} goal={item} onPress={() => openGoal(item.id)} />
  ), [balanceVisible, openGoal]);

  return (
    <ScreenContainer backgroundColor={appColors.background} edges={["top", "bottom"]}>
      <View style={styles.shell}>
        <View style={[styles.pageHeader, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Wealth Coach"
            accessibilityHint="Returns to the Wealth Coach overview"
            onPress={goBackToCoach}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
            <Text style={styles.backText}>Back to Coach</Text>
          </Pressable>

          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text accessibilityRole="header" style={styles.pageTitle}>Your goals</Text>
              <Text style={styles.pageDescription}>Track every financial target in one place.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a financial goal"
              onPress={createGoal}
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={appColors.primaryPressed} />
              <Text style={styles.createButtonText}>Create goal</Text>
            </Pressable>
          </View>
        </View>

        {isPageLoading ? (
          <View style={[styles.stateContent, { paddingHorizontal: horizontalPadding }]}>
            <GoalsSkeleton />
          </View>
        ) : null}

        {!isPageLoading && hasLoadError ? (
          <View style={[styles.stateContent, { paddingHorizontal: horizontalPadding }]}>
            <StatePanel
              actionLabel="Try again"
              description="We couldn’t load your goals right now. Check your connection and try again."
              iconName="cloud-offline-outline"
              loading={isRetrying}
              onAction={retry}
              title="Goals unavailable"
            />
          </View>
        ) : null}

        {!isPageLoading && !hasLoadError && availableGoals ? (
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: horizontalPadding },
              goals.length === 0 && styles.emptyListContent,
            ]}
            data={goals}
            ItemSeparatorComponent={GoalSeparator}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<GoalsEmptyState onCreateGoal={createGoal} />}
            ListHeaderComponent={hasRefreshError ? (
              <View style={styles.listHeader}>
                <StatusBanner
                  actionLabel="Retry"
                  actionAccessibilityLabel="Retry refreshing goals"
                  iconName="refresh-outline"
                  message="Showing the last available goal information."
                  onAction={retry}
                  title="Couldn’t refresh"
                  tone="warning"
                />
              </View>
            ) : null}
            renderItem={renderGoal}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function GoalSeparator() {
  return <View style={styles.goalSeparator} />;
}

function GoalsEmptyState({ onCreateGoal }: { onCreateGoal: () => void }) {
  return (
    <Surface style={styles.emptyState}>
      <View style={styles.stateIcon}>
        <Ionicons name="flag-outline" size={25} color={appColors.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>No goals saved yet</Text>
      <Text style={styles.stateDescription}>Create a target and let your Wealth Coach help you build a plan.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a financial goal"
        onPress={onCreateGoal}
        style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={19} color={appColors.surface} />
        <Text style={styles.stateActionLabel}>Create goal</Text>
      </Pressable>
    </Surface>
  );
}

type StatePanelProps = {
  actionLabel: string;
  description: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  onAction: () => void;
  title: string;
};

function StatePanel({ actionLabel, description, iconName, loading = false, onAction, title }: StatePanelProps) {
  return (
    <Surface style={styles.statePanel}>
      <View style={styles.stateIcon}>
        <Ionicons name={iconName} size={25} color={appColors.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={onAction}
        style={({ pressed }) => [styles.stateAction, pressed && !loading && styles.pressed, loading && styles.disabled]}
      >
        {loading ? <ActivityIndicator color={appColors.surface} size="small" /> : null}
        <Text style={styles.stateActionLabel}>{actionLabel}</Text>
      </Pressable>
    </Surface>
  );
}

function GoalsSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <View accessibilityLabel="Loading financial goals" accessibilityState={{ busy: true }}>
      {[0, 1, 2].map((item) => (
        <Surface key={item} style={[styles.skeletonCard, item > 0 && styles.skeletonCardSpacing]}>
          <View style={styles.skeletonHeader}>
            <Skeleton opacity={opacity} style={styles.skeletonIcon} />
            <View style={styles.skeletonCopy}>
              <Skeleton opacity={opacity} style={styles.skeletonTitle} />
              <Skeleton opacity={opacity} style={styles.skeletonSubtitle} />
            </View>
            <Skeleton opacity={opacity} style={styles.skeletonPercentage} />
          </View>
          <Skeleton opacity={opacity} style={styles.skeletonTrack} />
          <Skeleton opacity={opacity} style={styles.skeletonRemaining} />
        </Surface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  pageHeader: {
    paddingTop: appSpacing.sm,
    paddingBottom: appSpacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.divider,
  },
  backButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingRight: appSpacing.sm,
  },
  backText: {
    marginLeft: appSpacing.xs,
    color: appColors.textPrimary,
    ...appTypography.supporting,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: appSpacing.xs,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: appSpacing.md,
  },
  pageTitle: {
    color: appColors.textPrimary,
    ...appTypography.pageTitle,
  },
  pageDescription: {
    marginTop: 2,
    color: appColors.textSecondary,
    ...appTypography.supporting,
  },
  createButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.md,
    borderRadius: appRadii.control,
    backgroundColor: appColors.primarySoft,
  },
  createButtonText: {
    marginLeft: appSpacing.xs,
    color: appColors.primaryPressed,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  stateContent: {
    flex: 1,
    paddingTop: appSpacing.xl,
    paddingBottom: appSpacing.xxxl,
  },
  listContent: {
    paddingTop: appSpacing.xl,
    paddingBottom: appSpacing.xxxl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: appSpacing.lg,
  },
  goalSeparator: {
    height: appSpacing.md,
  },
  emptyState: {
    alignItems: "center",
    padding: appSpacing.xxl,
  },
  statePanel: {
    alignItems: "center",
    padding: appSpacing.xxl,
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  stateTitle: {
    marginTop: appSpacing.lg,
    color: appColors.textPrimary,
    ...appTypography.cardTitle,
    fontWeight: "700",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 420,
    marginTop: appSpacing.sm,
    color: appColors.textSecondary,
    ...appTypography.supporting,
    textAlign: "center",
  },
  stateAction: {
    minWidth: 132,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: appSpacing.sm,
    marginTop: appSpacing.xl,
    paddingHorizontal: appSpacing.xl,
    borderRadius: appRadii.control,
    backgroundColor: appColors.primary,
  },
  stateActionLabel: {
    color: appColors.surface,
    ...appTypography.button,
    fontSize: 15,
  },
  skeletonCard: {
    padding: appSpacing.lg,
  },
  skeletonCardSpacing: {
    marginTop: appSpacing.md,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: appRadii.round,
  },
  skeletonCopy: {
    flex: 1,
    marginHorizontal: appSpacing.md,
  },
  skeletonTitle: {
    width: "62%",
    height: 17,
    borderRadius: appRadii.small,
  },
  skeletonSubtitle: {
    width: "82%",
    height: 12,
    marginTop: appSpacing.sm,
    borderRadius: appRadii.small,
  },
  skeletonPercentage: {
    width: 42,
    height: 24,
    borderRadius: appRadii.small,
  },
  skeletonTrack: {
    width: "100%",
    height: 8,
    marginTop: appSpacing.lg,
    borderRadius: appRadii.round,
  },
  skeletonRemaining: {
    width: "38%",
    height: 12,
    marginTop: appSpacing.sm,
    marginLeft: "auto",
    borderRadius: appRadii.small,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.62,
  },
});
