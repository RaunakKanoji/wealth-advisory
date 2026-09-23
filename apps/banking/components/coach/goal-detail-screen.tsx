import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { ProgressBar, SectionHeader, Surface } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { formatINR } from "@/lib/currency";
import { clampPercentage } from "@/lib/percentage";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { FinancialGoal } from "@/types/wealth-coach";

import { useWealthCoachGoalsData } from "./use-wealth-coach-goals";

type GoalDetailScreenProps = {
  goalId: string;
};

export function GoalDetailScreen({ goalId }: GoalDetailScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    balanceVisible,
    goals,
    hasLoadError,
    hasRefreshError,
    isLoading: isPageLoading,
    isRefreshing,
    retry,
  } = useWealthCoachGoalsData();
  const goal = goals?.find((item) => item.id === goalId);
  const coachGoalName = goal
    ? balanceVisible ? goal.name : privacySafeFinancialText(goal.name, "selected")
    : "selected";
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;

  const goBackToCoach = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)/coach");
  }, [router]);

  const openCoach = useCallback((prompt: string) => {
    router.push({
      pathname: "/(app)/coach/new",
      params: { goalId, prompt },
    });
  }, [goalId, router]);

  return (
    <ScreenContainer backgroundColor={appColors.background} edges={["top", "bottom"]}>
      <View style={styles.shell}>
        <View style={[styles.pageHeader, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBackToCoach}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.pageTitle}>Goal details</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {isPageLoading ? <GoalDetailSkeleton /> : null}

          {!isPageLoading && hasLoadError ? (
            <StatePanel
              actionLabel="Try again"
              description="We couldn’t load this goal right now. Check your connection and try again."
              iconName="cloud-offline-outline"
              loading={isRefreshing}
              onAction={retry}
              title="Goal unavailable"
            />
          ) : null}

          {!isPageLoading && !hasLoadError && !goal ? (
            <StatePanel
              actionLabel="Back to Coach"
              description="This goal could not be found. It may have been removed or belong to a different profile."
              iconName="flag-outline"
              onAction={goBackToCoach}
              title="Goal not found"
            />
          ) : null}

          {!isPageLoading && goal ? (
            <>
              {hasRefreshError ? (
                <StatusBanner
                  actionLabel="Retry"
                  actionAccessibilityLabel="Retry refreshing goal details"
                  iconName="refresh-outline"
                  message="Showing the last available goal information."
                  onAction={retry}
                  title="Couldn’t refresh"
                  tone="warning"
                />
              ) : null}

              <GoalSummary balanceVisible={balanceVisible} goal={goal} />

              <View style={styles.actionsSection}>
                <SectionHeader title="Manage goal" />
                <View style={styles.actions}>
                  <GoalAction
                    iconName="add-circle-outline"
                    label="Add money"
                    onPress={() => router.push("/(app)/transfers/new")}
                    variant="primary"
                  />
                  <GoalAction
                    iconName="create-outline"
                    label="Change target"
                    onPress={() => openCoach(`Help me review and change the target amount for my ${coachGoalName} goal.`)}
                  />
                  <GoalAction
                    iconName="calendar-outline"
                    label="Change target date"
                    onPress={() => openCoach(`Help me choose a new target date for my ${coachGoalName} goal.`)}
                  />
                  <GoalAction
                    iconName="chatbubble-ellipses-outline"
                    label="Ask Coach"
                    onPress={() => openCoach(`How can I reach my ${coachGoalName} target faster?`)}
                    variant="coach"
                  />
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function GoalSummary({ goal, balanceVisible }: { goal: FinancialGoal; balanceVisible: boolean }) {
  const targetAmount = finiteNonNegative(goal.targetAmount);
  const currentAmount = finiteNonNegative(goal.currentAmount);
  const remainingAmount = Math.max(targetAmount - currentAmount, 0);
  const calculatedProgress = targetAmount > 0
    ? (currentAmount / targetAmount) * 100
    : goal.progressPercentage;
  const progress = Math.round(clampPercentage(Number.isFinite(calculatedProgress) ? calculatedProgress : 0));
  const goalName = balanceVisible ? goal.name : privacySafeFinancialText(goal.name, "Financial goal");

  return (
    <Surface style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.goalIcon}>
          <Ionicons name="flag-outline" size={22} color={appColors.primary} />
        </View>
        <Text numberOfLines={2} style={styles.goalName}>{goalName}</Text>
        <View style={styles.percentagePill}>
          <Text style={styles.percentage}>{balanceVisible ? `${progress}%` : "Hidden"}</Text>
        </View>
      </View>

      <Text style={styles.amountLabel}>{balanceVisible ? "Saved so far" : "Goal amounts"}</Text>
      <Text style={styles.currentAmount}>{balanceVisible ? formatINR(currentAmount) : "Hidden"}</Text>
      <Text style={styles.targetAmount}>{balanceVisible ? `of ${formatINR(targetAmount)} target` : "Turn on balance visibility from Accounts to show amounts."}</Text>

      {balanceVisible ? (
        <ProgressBar
          accessibilityLabel={`${goalName} goal progress`}
          accessibilityValueText={`${progress}% complete`}
          style={styles.progressBar}
          value={progress}
        />
      ) : null}

      <View style={styles.goalMeta}>
        <View style={styles.metaItem}>
          <View style={styles.metaLabelRow}>
            <Ionicons name="wallet-outline" size={16} color={appColors.textSecondary} />
            <Text style={styles.metaLabel}>Remaining</Text>
          </View>
          <Text style={styles.metaValue}>
            {balanceVisible ? (remainingAmount > 0 ? formatINR(remainingAmount) : "Goal reached") : "Hidden"}
          </Text>
        </View>

        <View style={styles.metaDivider} />

        <View style={styles.metaItem}>
          <View style={styles.metaLabelRow}>
            <Ionicons name="calendar-outline" size={16} color={appColors.textSecondary} />
            <Text style={styles.metaLabel}>Target date</Text>
          </View>
          <Text style={styles.metaValue}>{formatTargetDate(goal.targetDate)}</Text>
        </View>
      </View>
    </Surface>
  );
}

type GoalActionProps = {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "coach";
};

function GoalAction({ iconName, label, onPress, variant = "secondary" }: GoalActionProps) {
  const isPrimary = variant === "primary";
  const iconColor = isPrimary ? appColors.surface : appColors.primaryPressed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "primary" && styles.primaryAction,
        variant === "coach" && styles.coachAction,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={iconName} size={21} color={iconColor} />
      <Text style={[styles.actionLabel, isPrimary && styles.primaryActionLabel]}>{label}</Text>
      <Ionicons name="chevron-forward" size={19} color={iconColor} />
    </Pressable>
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

function GoalDetailSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <Surface
      accessibilityLabel="Loading goal details"
      accessibilityState={{ busy: true }}
      style={styles.skeletonCard}
    >
      <View style={styles.skeletonHeader}>
        <Skeleton opacity={opacity} style={styles.skeletonIcon} />
        <Skeleton opacity={opacity} style={styles.skeletonTitle} />
        <Skeleton opacity={opacity} style={styles.skeletonPercentage} />
      </View>
      <Skeleton opacity={opacity} style={styles.skeletonLabel} />
      <Skeleton opacity={opacity} style={styles.skeletonAmount} />
      <Skeleton opacity={opacity} style={styles.skeletonTrack} />
      <View style={styles.skeletonMetaRow}>
        <Skeleton opacity={opacity} style={styles.skeletonMeta} />
        <Skeleton opacity={opacity} style={styles.skeletonMeta} />
      </View>
    </Surface>
  );
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatTargetDate(targetDate?: string): string {
  const value = targetDate?.trim();
  if (!value) return "Not set";
  if (/^\d{4}$/.test(value)) return value;

  const isoMonth = /^(\d{4})-(\d{2})$/.exec(value);
  if (isoMonth) {
    const date = new Date(Date.UTC(Number(isoMonth[1]), Number(isoMonth[2]) - 1, 1));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
    }
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDate) {
    const date = new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
  }

  return value;
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
  pageTitle: {
    marginTop: appSpacing.xs,
    color: appColors.textPrimary,
    ...appTypography.pageTitle,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: appSpacing.xl,
    paddingBottom: appSpacing.xxxl,
  },
  summaryCard: {
    marginTop: appSpacing.lg,
    padding: appSpacing.xl,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  goalIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  goalName: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: appSpacing.md,
    color: appColors.textPrimary,
    ...appTypography.cardTitle,
    fontWeight: "700",
  },
  percentagePill: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
  },
  percentage: {
    color: appColors.primaryPressed,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  amountLabel: {
    marginTop: appSpacing.xl,
    color: appColors.textSecondary,
    ...appTypography.metadata,
    fontWeight: "600",
  },
  currentAmount: {
    marginTop: 2,
    color: appColors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
  },
  targetAmount: {
    marginTop: 2,
    color: appColors.textSecondary,
    ...appTypography.supporting,
  },
  progressBar: {
    marginTop: appSpacing.lg,
  },
  goalMeta: {
    flexDirection: "row",
    marginTop: appSpacing.xl,
    paddingTop: appSpacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.divider,
  },
  metaItem: {
    flex: 1,
    minWidth: 0,
  },
  metaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    marginLeft: 6,
    color: appColors.textSecondary,
    ...appTypography.metadata,
    fontWeight: "600",
  },
  metaValue: {
    marginTop: 5,
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: appSpacing.lg,
    backgroundColor: appColors.divider,
  },
  actionsSection: {
    marginTop: appSpacing.xxl,
  },
  actions: {
    rowGap: 10,
    marginTop: appSpacing.sm,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: appSpacing.lg,
    borderRadius: appRadii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.primaryBorder,
    backgroundColor: appColors.surface,
  },
  primaryAction: {
    borderColor: appColors.primary,
    backgroundColor: appColors.primary,
  },
  coachAction: {
    backgroundColor: appColors.primarySoft,
  },
  actionLabel: {
    flex: 1,
    marginHorizontal: appSpacing.md,
    color: appColors.primaryPressed,
    ...appTypography.button,
    fontSize: 15,
  },
  primaryActionLabel: {
    color: appColors.surface,
  },
  statePanel: {
    alignItems: "center",
    marginTop: appSpacing.lg,
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
    marginTop: appSpacing.lg,
    padding: appSpacing.xl,
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
  skeletonTitle: {
    flex: 1,
    height: 20,
    marginHorizontal: appSpacing.md,
    borderRadius: appRadii.small,
  },
  skeletonPercentage: {
    width: 54,
    height: 32,
    borderRadius: appRadii.round,
  },
  skeletonLabel: {
    width: 74,
    height: 12,
    marginTop: appSpacing.xl,
    borderRadius: appRadii.small,
  },
  skeletonAmount: {
    width: 178,
    height: 34,
    marginTop: appSpacing.sm,
    borderRadius: appRadii.small,
  },
  skeletonTrack: {
    width: "100%",
    height: 8,
    marginTop: appSpacing.xl,
    borderRadius: appRadii.round,
  },
  skeletonMetaRow: {
    flexDirection: "row",
    columnGap: appSpacing.xl,
    marginTop: appSpacing.xxl,
  },
  skeletonMeta: {
    flex: 1,
    height: 38,
    borderRadius: appRadii.small,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.62,
  },
});
