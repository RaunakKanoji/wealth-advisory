import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SectionHeader, Surface } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { WealthInsight } from "@/types/wealth-coach";

import {
  activityParamsForInsight,
  comparisonMetricForInsight,
  detailMetricForInsight,
  iconForInsight,
  questionForInsight,
  sourceLabelsForInsight,
  toneForInsight,
  type InsightMetricDisplay,
  type InsightTone,
} from "./insight-presentation";
import { useWealthCoachInsightsData } from "./use-wealth-coach-dashboard";

type InsightDetailScreenProps = {
  insightId: string;
};

export function InsightDetailScreen({ insightId }: InsightDetailScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    balanceVisible,
    insights,
    hasLoadError,
    hasRefreshError,
    isLoading,
    isRefreshing,
    retry,
  } = useWealthCoachInsightsData();
  const insight = useMemo(
    () => insights?.find((item) => item.id === insightId),
    [insightId, insights],
  );
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/coach/insights");
  }, [router]);

  const goToInsights = useCallback(() => {
    router.replace("/(app)/coach/insights");
  }, [router]);

  const askCoach = useCallback(() => {
    if (!insight) return;
    router.push({
      pathname: "/(app)/coach/new",
      params: { prompt: questionForInsight(insight, balanceVisible) },
    });
  }, [balanceVisible, insight, router]);

  const openRelatedActivity = useCallback(() => {
    if (!insight) return;
    const activityParams = activityParamsForInsight(insight);
    if (!activityParams) return;
    router.push({
      pathname: "/(app)/activity",
      params: {
        period: activityParams.period,
        source: "insights",
        insightId: insight.id,
        ...(activityParams.category ? { category: activityParams.category } : {}),
      },
    });
  }, [insight, router]);

  return (
    <ScreenContainer backgroundColor={appColors.background} edges={["top", "bottom"]}>
      <View style={styles.shell}>
        <View style={[styles.pageHeader, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.pageTitle}>Insight details</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? <InsightDetailSkeleton /> : null}

          {!isLoading && hasLoadError ? (
            <StatePanel
              actionLabel="Try again"
              description="We couldn’t load this insight. Check your connection and try again."
              iconName="cloud-offline-outline"
              loading={isRefreshing}
              onAction={retry}
              title="Insight unavailable"
            />
          ) : null}

          {!isLoading && !hasLoadError && !insight ? (
            <StatePanel
              actionLabel="Back to insights"
              description="This insight could not be found. It may have expired or belong to a different profile."
              iconName="search-outline"
              onAction={goToInsights}
              title="Insight not found"
            />
          ) : null}

          {!isLoading && insight ? (
            <>
              {hasRefreshError ? (
                <View style={styles.statusSpacing}>
                  <StatusBanner
                    actionLabel="Retry"
                    actionAccessibilityLabel="Retry refreshing this financial insight"
                    iconName="refresh-outline"
                    message="Showing the last available insight information."
                    onAction={retry}
                    title="Couldn’t refresh"
                    tone="warning"
                  />
                </View>
              ) : null}
              <InsightDetail
                balanceVisible={balanceVisible}
                insight={insight}
                onAskCoach={askCoach}
                onOpenActivity={openRelatedActivity}
              />
            </>
          ) : null}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function InsightDetail({ balanceVisible, insight, onAskCoach, onOpenActivity }: { balanceVisible: boolean; insight: WealthInsight; onAskCoach: () => void; onOpenActivity: () => void }) {
  const tone = toneForInsight(insight);
  const toneColors = insightToneColors[tone];
  const metric = balanceVisible ? detailMetricForInsight(insight) : null;
  const comparison = balanceVisible ? comparisonMetricForInsight(insight) : null;
  const sourceLabels = sourceLabelsForInsight(insight, balanceVisible);
  const activityParams = activityParamsForInsight(insight);
  const title = balanceVisible
    ? insight.title
    : privacySafeFinancialText(insight.title, "Financial insight");
  const summary = balanceVisible
    ? insight.summary?.trim() || insight.description.trim()
    : "This insight is based on your latest available financial activity.";

  return (
    <>
      <Surface style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={[styles.heroIcon, { backgroundColor: toneColors.soft }]}>
            <Ionicons name={iconForInsight(insight.type)} size={24} color={toneColors.strong} />
          </View>
          <View style={[styles.toneBadge, { backgroundColor: toneColors.soft }]}>
            <Text style={[styles.toneBadgeText, { color: toneColors.strong }]}>{toneLabel(tone)}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightSummary}>{summary}</Text>

        {metric || comparison ? (
          <View style={styles.metricsRow}>
            {metric ? <DetailMetric metric={metric} tone={tone} /> : null}
            {metric && comparison ? <View style={styles.metricDivider} /> : null}
            {comparison ? <DetailMetric metric={comparison} tone={tone} /> : null}
          </View>
        ) : null}
      </Surface>

      <View style={styles.section}>
        <SectionHeader title="Based on" />
        {sourceLabels.length > 0 ? (
          <View style={styles.sourceChips}>
            {sourceLabels.map((label) => (
              <View key={label} style={styles.sourceChip}>
                <Ionicons name="document-text-outline" size={15} color={appColors.primaryPressed} />
                <Text style={styles.sourceChipText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Surface variant="subtle" style={styles.noSourcePanel}>
            <Ionicons name="information-circle-outline" size={19} color={appColors.textSecondary} />
            <Text style={styles.noSourceText}>No supporting source details were supplied with this insight.</Text>
          </Surface>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Next steps" />
        <View style={styles.actions}>
          {activityParams ? (
            <DetailAction
              iconName="receipt-outline"
              label="View related activity"
              onPress={onOpenActivity}
            />
          ) : null}
          <DetailAction
            iconName="sparkles-outline"
            label="Ask Coach"
            onPress={onAskCoach}
            primary
          />
        </View>
      </View>
    </>
  );
}

function DetailMetric({ metric, tone }: { metric: InsightMetricDisplay; tone: InsightTone }) {
  const colors = insightToneColors[tone];
  return (
    <View accessible accessibilityLabel={metric.accessibilityLabel} style={styles.detailMetric}>
      <Text style={[styles.detailMetricValue, { color: colors.strong }]}>{metric.value}</Text>
      <Text style={styles.detailMetricLabel}>{metric.label}</Text>
    </View>
  );
}

function DetailAction({ iconName, label, onPress, primary = false }: { iconName: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "Ask Coach" ? "Ask Coach about this insight" : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailAction,
        primary && styles.primaryAction,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={iconName} size={20} color={primary ? appColors.surface : appColors.primaryPressed} />
      <Text style={[styles.detailActionText, primary && styles.primaryActionText]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={primary ? appColors.surface : appColors.primaryPressed} />
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

function InsightDetailSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <View accessibilityLabel="Loading insight details" accessibilityState={{ busy: true }}>
      <Surface style={styles.skeletonCard}>
        <View style={styles.skeletonTopRow}>
          <Skeleton opacity={opacity} style={styles.skeletonIcon} />
          <Skeleton opacity={opacity} style={styles.skeletonBadge} />
        </View>
        <Skeleton opacity={opacity} style={styles.skeletonTitle} />
        <Skeleton opacity={opacity} style={styles.skeletonSummary} />
        <Skeleton opacity={opacity} style={styles.skeletonSummaryShort} />
        <View style={styles.skeletonMetrics}>
          <Skeleton opacity={opacity} style={styles.skeletonMetric} />
          <Skeleton opacity={opacity} style={styles.skeletonMetric} />
        </View>
      </Surface>
      <Skeleton opacity={opacity} style={styles.skeletonSectionTitle} />
      <View style={styles.skeletonChips}>
        <Skeleton opacity={opacity} style={styles.skeletonChip} />
        <Skeleton opacity={opacity} style={styles.skeletonChipWide} />
      </View>
    </View>
  );
}

function toneLabel(tone: InsightTone): string {
  if (tone === "attention") return "Needs attention";
  if (tone === "positive") return "Positive progress";
  return "For your review";
}

const insightToneColors: Record<InsightTone, { soft: string; strong: string }> = {
  attention: { soft: appColors.warningSoft, strong: appColors.orangeText },
  positive: { soft: appColors.successSoft, strong: appColors.success },
  neutral: { soft: appColors.surfaceMuted, strong: appColors.textBody },
};

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
  content: {
    paddingTop: appSpacing.xl,
    paddingBottom: appSpacing.xxxl,
  },
  statusSpacing: {
    marginBottom: appSpacing.lg,
  },
  summaryCard: {
    padding: appSpacing.xl,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
  },
  toneBadge: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: appSpacing.md,
    borderRadius: appRadii.round,
  },
  toneBadgeText: {
    ...appTypography.metadata,
    fontWeight: "700",
  },
  insightTitle: {
    marginTop: appSpacing.lg,
    color: appColors.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
  },
  insightSummary: {
    marginTop: appSpacing.sm,
    color: appColors.textBody,
    ...appTypography.body,
  },
  metricsRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: appSpacing.xl,
    paddingTop: appSpacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.divider,
  },
  detailMetric: {
    flex: 1,
    justifyContent: "center",
  },
  detailMetricValue: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
  },
  detailMetricLabel: {
    marginTop: appSpacing.xs,
    color: appColors.textSecondary,
    ...appTypography.metadata,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: appSpacing.lg,
    backgroundColor: appColors.divider,
  },
  section: {
    marginTop: appSpacing.xxl,
  },
  sourceChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.sm,
    marginTop: appSpacing.sm,
  },
  sourceChip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    columnGap: 6,
    paddingHorizontal: appSpacing.md,
    paddingVertical: appSpacing.sm,
    borderRadius: appRadii.round,
    backgroundColor: appColors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.primaryBorder,
  },
  sourceChipText: {
    flexShrink: 1,
    color: appColors.primaryPressed,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  noSourcePanel: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    columnGap: appSpacing.sm,
    marginTop: appSpacing.sm,
    padding: appSpacing.md,
    borderRadius: appRadii.medium,
  },
  noSourceText: {
    flex: 1,
    color: appColors.textSecondary,
    ...appTypography.supporting,
  },
  actions: {
    rowGap: appSpacing.md,
    marginTop: appSpacing.sm,
  },
  detailAction: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: appSpacing.lg,
    borderRadius: appRadii.control,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.primaryBorder,
  },
  primaryAction: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  detailActionText: {
    flex: 1,
    marginHorizontal: appSpacing.sm,
    color: appColors.primaryPressed,
    ...appTypography.button,
    fontSize: 15,
  },
  primaryActionText: {
    color: appColors.surface,
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
    padding: appSpacing.xl,
  },
  skeletonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: appRadii.round,
  },
  skeletonBadge: {
    width: 112,
    height: 28,
    borderRadius: appRadii.round,
  },
  skeletonTitle: {
    width: "72%",
    height: 23,
    marginTop: appSpacing.lg,
    borderRadius: appRadii.small,
  },
  skeletonSummary: {
    width: "100%",
    height: 14,
    marginTop: appSpacing.md,
    borderRadius: appRadii.small,
  },
  skeletonSummaryShort: {
    width: "68%",
    height: 14,
    marginTop: appSpacing.sm,
    borderRadius: appRadii.small,
  },
  skeletonMetrics: {
    flexDirection: "row",
    columnGap: appSpacing.xl,
    marginTop: appSpacing.xl,
    paddingTop: appSpacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.divider,
  },
  skeletonMetric: {
    width: "38%",
    height: 42,
    borderRadius: appRadii.small,
  },
  skeletonSectionTitle: {
    width: 104,
    height: 18,
    marginTop: appSpacing.xxxl,
    borderRadius: appRadii.small,
  },
  skeletonChips: {
    flexDirection: "row",
    columnGap: appSpacing.sm,
    marginTop: appSpacing.md,
  },
  skeletonChip: {
    width: 118,
    height: 38,
    borderRadius: appRadii.round,
  },
  skeletonChipWide: {
    width: 164,
    height: 38,
    borderRadius: appRadii.round,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.62,
  },
});
