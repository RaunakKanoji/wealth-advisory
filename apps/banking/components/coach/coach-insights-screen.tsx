import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/app-header";
import { ProgressBar, SectionHeader, Surface } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { formatINR } from "@/lib/currency";
import { formatPercentage } from "@/lib/percentage";
import {
  activityParamsForInsight,
  iconForInsight,
  listMetricForInsight,
  questionForInsight,
  toneForInsight,
} from "./insight-presentation";
import {
  categoryTrendForInsight,
  featuredInsight,
  filterInsights,
  goalProgress,
  rankInsights,
  type InsightsFilter,
  type MonthlyTrendPoint,
} from "@/lib/insights-dashboard";
import { privacySafeFinancialText } from "@/lib/privacy";
import type { FinancialGoal, WealthInsight } from "@/types/wealth-coach";
import { useWealthCoachInsightsData } from "./use-wealth-coach-dashboard";

const FILTERS: { value: InsightsFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spending", label: "Spending" },
  { value: "saving", label: "Saving" },
  { value: "goals", label: "Goals" },
  { value: "bills", label: "Bills" },
];

export function CoachInsightsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<InsightsFilter>("all");
  const {
    balanceVisible,
    dashboard,
    hasLoadError,
    hasRefreshError,
    insights: availableInsights,
    isLoading,
    isRefreshing,
    retry,
  } = useWealthCoachInsightsData();
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;
  const ranked = useMemo(() => rankInsights(availableInsights ?? []), [availableInsights]);
  const featured = useMemo(() => featuredInsight(ranked), [ranked]);
  const filteredInsights = useMemo(() => filterInsights(ranked, filter), [filter, ranked]);
  const currentMonth = dashboard?.snapshot?.month?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const trend = useMemo(
    () => categoryTrendForInsight(featured, dashboard?.transactionsByMonth ?? {}, currentMonth),
    [currentMonth, dashboard?.transactionsByMonth, featured],
  );
  const primaryGoal = dashboard?.goals[0];

  const goBackToCoach = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)/coach");
  }, [router]);

  const openInsight = useCallback((insight: WealthInsight) => {
    router.push({ pathname: "/(app)/coach/insight/[insightId]", params: { insightId: insight.id } });
  }, [router]);

  const viewSpending = useCallback((insight: WealthInsight) => {
    const params = activityParamsForInsight(insight);
    if (!params) {
      openInsight(insight);
      return;
    }
    router.push({ pathname: "/(app)/activity", params: { ...params, source: "insights" } });
  }, [openInsight, router]);

  const askCoach = useCallback((insight: WealthInsight) => {
    const activity = activityParamsForInsight(insight);
    router.push({
      pathname: "/(app)/coach/chat",
      params: {
        prompt: questionForInsight(insight, balanceVisible),
        ...(activity?.category ? { category: activity.category } : {}),
        ...(activity?.period ? { period: activity.period } : {}),
      },
    });
  }, [balanceVisible, router]);

  if (isLoading) {
    return <InsightsLoadingScreen />;
  }

  return (
    <ScreenContainer edges={["bottom"]}>
      <AppHeader sourceRoute="coach" />
      {hasLoadError ? (
        <StatePanel loading={isRefreshing} onAction={retry} />
      ) : !dashboard?.hasActivity ? (
        <InsightsEmptyState onBack={goBackToCoach} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          refreshControl={<RefreshControl tintColor={appColors.primary} onRefresh={retry} refreshing={isRefreshing} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Wealth Coach"
              onPress={goBackToCoach}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={appColors.textPrimary} />
              <Text style={styles.backText}>Back to Coach</Text>
            </Pressable>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text accessibilityRole="header" style={styles.pageTitle}>Insights</Text>
                <Text style={styles.pageDescription}>Personalised from your accounts and spending</Text>
              </View>
              <View style={styles.titleIcon}>
                <Ionicons name="options-outline" size={21} color={appColors.primary} />
              </View>
            </View>
          </View>

          {hasRefreshError ? (
            <StatusBanner
              actionLabel="Retry"
              actionAccessibilityLabel="Retry refreshing insights"
              iconName="refresh-outline"
              message="Showing your latest available insights."
              onAction={retry}
              title="Couldn’t refresh"
              tone="warning"
            />
          ) : null}

          <SectionHeader title="Financial snapshot" style={styles.sectionHeader} />
          <SnapshotCard balanceVisible={balanceVisible} snapshot={dashboard.snapshot} />

          {featured ? (
            <>
              <SectionHeader title="Featured insight" style={styles.sectionHeader} />
              <FeaturedInsightCard
                balanceVisible={balanceVisible}
                insight={featured}
                onAskCoach={() => askCoach(featured)}
                onOpen={() => openInsight(featured)}
                onViewSpending={() => viewSpending(featured)}
                trend={trend}
              />
            </>
          ) : null}

          <SectionHeader title="Your money this month" style={styles.sectionHeader} />
          <MoneyThisMonth snapshot={dashboard.snapshot} balanceVisible={balanceVisible} />

          {primaryGoal ? (
            <>
              <SectionHeader
                actionLabel="View all"
                onActionPress={() => router.push("/(app)/coach/goals")}
                title="Goals"
                style={styles.sectionHeader}
              />
              <GoalCard balanceVisible={balanceVisible} goal={primaryGoal} onPress={() => router.push({ pathname: "/(app)/coach/goal/[goalId]", params: { goalId: primaryGoal.id } })} />
            </>
          ) : null}

          <SectionHeader title="Recent insights" style={styles.sectionHeader} />
          <ScrollView horizontal contentContainerStyle={styles.filterContent} showsHorizontalScrollIndicator={false}>
            {FILTERS.map((item) => {
              const selected = filter === item.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Filter insights by ${item.label}`}
                  accessibilityState={{ selected }}
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.insightList}>
            {filteredInsights.length ? filteredInsights.map((insight) => (
              <InsightRow
                balanceVisible={balanceVisible}
                insight={insight}
                key={insight.id}
                onPress={() => openInsight(insight)}
              />
            )) : <Text style={styles.noResults}>No insights match this filter yet.</Text>}
          </View>

          <CoachCta onPress={() => router.push({ pathname: "/(app)/coach/new", params: { prompt: "Help me understand my money this month." } })} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function SnapshotCard({ balanceVisible, snapshot }: { balanceVisible: boolean; snapshot: InsightsDashboardSnapshot }) {
  const items = [
    { icon: "wallet-outline" as const, label: "Spent this month", value: snapshot?.expenses, format: "money" as const },
    { icon: "wallet-outline" as const, label: "Saved this month", value: snapshot?.savings, format: "money" as const },
    { icon: "pie-chart-outline" as const, label: "Savings rate", value: snapshot?.savingsRate, format: "percent" as const },
  ];
  return (
    <Surface style={styles.snapshotCard}>
      <View style={styles.snapshotHeading}>
        <Text style={styles.snapshotPeriod}>{snapshot?.periodLabel ? periodLabel(snapshot.periodLabel) : "Current period"}</Text>
        {snapshot?.scopeLabel ? <Text style={styles.snapshotScope}>{snapshot.scopeLabel}</Text> : null}
      </View>
      <View style={styles.snapshotMetrics}>
        {items.map((item) => (
          <View key={item.label} style={styles.snapshotMetric}>
            <View style={styles.metricIcon}><Ionicons name={item.icon} size={19} color={appColors.primary} /></View>
            <Text style={styles.metricValue}>{item.value === null || item.value === undefined ? "Not available" : !balanceVisible ? item.format === "percent" ? "Hidden" : "Hidden amount" : item.format === "percent" ? formatPercentage(item.value) : formatINR(item.value)}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

type InsightsDashboardSnapshot = ReturnType<typeof useWealthCoachInsightsData>["dashboard"] extends infer Dashboard
  ? Dashboard extends { snapshot: infer Snapshot } ? Snapshot : never
  : never;

function FeaturedInsightCard({ balanceVisible, insight, onAskCoach, onOpen, onViewSpending, trend }: { balanceVisible: boolean; insight: WealthInsight; onAskCoach: () => void; onOpen: () => void; onViewSpending: () => void; trend: MonthlyTrendPoint[] }) {
  const tone = toneForInsight(insight);
  const toneColor = tone === "attention" ? appColors.orangeText : tone === "positive" ? appColors.success : appColors.primary;
  const toneBackground = tone === "attention" ? appColors.warningSoft : tone === "positive" ? appColors.successSoft : appColors.infoSoft;
  const title = balanceVisible ? insight.title : privacySafeFinancialText(insight.title, "Your latest financial insight");
  const summary = balanceVisible ? insight.summary?.trim() || insight.description : "Open this insight to review the latest account observation.";
  const metric = balanceVisible ? listMetricForInsight(insight) : null;
  const isSpending = insight.type === "spending";

  return (
    <Surface style={[styles.featuredCard, { backgroundColor: toneBackground, borderColor: tone === "attention" ? "#F5D8B1" : appColors.primaryBorder }]}>
      <View style={styles.featuredTopline}>
        <View style={[styles.featuredIcon, { backgroundColor: appColors.surface }]}><Ionicons name={iconForInsight(insight.type)} size={23} color={toneColor} /></View>
        <View style={styles.featuredEyebrow}><Text style={[styles.featuredEyebrowText, { color: toneColor }]}>{isSpending ? "Spending insight" : "Financial insight"}</Text><Text style={styles.featuredMeta}>Based on available posted activity</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onOpen} style={({ pressed }) => [pressed && styles.pressed]}>
        <Text style={styles.featuredTitle}>{title}</Text>
        <Text style={styles.featuredSummary}>{summary}</Text>
      </Pressable>
      {metric ? <View style={styles.featuredMetric}><Text style={[styles.featuredMetricValue, { color: toneColor }]}>{metric.value}</Text><Text style={styles.featuredMetricLabel}>{metric.label}{insight.comparisonPeriod ? ` · ${insight.comparisonPeriod}` : ""}</Text></View> : null}
      {trend.length ? <MiniBarChart points={trend} color={toneColor} /> : null}
      <View style={styles.featuredActions}>
        {isSpending ? <Pressable accessibilityRole="button" accessibilityLabel="View spending behind this insight" onPress={onViewSpending} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>View spending</Text><Ionicons name="arrow-forward" size={17} color={appColors.surface} /></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="View this insight" onPress={onOpen} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>View insight</Text><Ionicons name="arrow-forward" size={17} color={appColors.surface} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Ask Wealth Coach about this insight" onPress={onAskCoach} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons name="sparkles-outline" size={17} color={toneColor} /><Text style={[styles.secondaryActionText, { color: toneColor }]}>Ask Coach</Text></Pressable>
      </View>
    </Surface>
  );
}

function MiniBarChart({ color, points }: { color: string; points: MonthlyTrendPoint[] }) {
  const max = Math.max(...points.map((point) => point.amount), 1);
  return (
    <View accessibilityLabel="Recent category spending trend" style={styles.chart}>
      {points.map((point) => <View key={point.month} style={styles.chartColumn}><View style={styles.chartTrack}><View style={[styles.chartBar, { backgroundColor: point.isCurrent ? color : `${color}66`, height: `${Math.max(8, (point.amount / max) * 100)}%` }]} /></View><Text style={[styles.chartLabel, point.isCurrent && { color }]}>{point.label}</Text></View>)}
    </View>
  );
}

function MoneyThisMonth({ balanceVisible, snapshot }: { balanceVisible: boolean; snapshot: InsightsDashboardSnapshot }) {
  const savingsRate = snapshot?.savingsRate;
  const cashFlow = snapshot?.savings;
  return (
    <View style={styles.moneyGrid}>
      <Surface style={styles.moneyCard}><View style={styles.moneyCardHeader}><View style={[styles.smallIcon, { backgroundColor: appColors.primarySoft }]}><Ionicons name="trending-up-outline" size={19} color={appColors.primary} /></View><Text style={styles.moneyCardLabel}>Savings rate</Text></View><Text style={styles.moneyCardValue}>{savingsRate === null || savingsRate === undefined ? "Not available" : !balanceVisible ? "Hidden" : formatPercentage(savingsRate)}</Text><Text style={styles.moneyCardSupport}>Current period</Text></Surface>
      <Surface style={styles.moneyCard}><View style={styles.moneyCardHeader}><View style={[styles.smallIcon, { backgroundColor: typeof cashFlow === "number" && cashFlow >= 0 ? appColors.successSoft : appColors.warningSoft }]}><Ionicons name="swap-vertical-outline" size={19} color={typeof cashFlow === "number" && cashFlow >= 0 ? appColors.success : appColors.warning} /></View><Text style={styles.moneyCardLabel}>Monthly cash flow</Text></View><Text style={styles.moneyCardValue}>{cashFlow === null || cashFlow === undefined ? "Not available" : !balanceVisible ? "Hidden amount" : signedINR(cashFlow)}</Text><Text style={styles.moneyCardSupport}>{cashFlow === null || cashFlow === undefined ? "Awaiting enough data" : cashFlow >= 0 ? "Income exceeded expenses" : "Expenses exceeded income"}</Text></Surface>
    </View>
  );
}

function GoalCard({ balanceVisible, goal, onPress }: { balanceVisible: boolean; goal: FinancialGoal; onPress: () => void }) {
  const progress = goalProgress(goal);
  return (
    <Surface style={styles.goalCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${goal.name} goal`} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        <View style={styles.goalHeading}><View style={styles.goalIcon}><Ionicons name="flag-outline" size={20} color={appColors.primary} /></View><View style={styles.goalCopy}><Text style={styles.goalTitle}>{balanceVisible ? goal.name : "Financial goal"}</Text><Text style={styles.goalAmount}>{balanceVisible ? `${formatINR(goal.currentAmount)} of ${formatINR(goal.targetAmount)}` : "Goal amounts hidden"}</Text></View><Ionicons name="chevron-forward" size={19} color={appColors.iconMuted} /></View>
        {balanceVisible ? <><View style={styles.goalProgressRow}><ProgressBar accessibilityLabel={`${goal.name} progress`} max={100} value={progress.percentage} style={styles.goalProgress} /><Text style={styles.goalPercent}>{progress.percentage}%</Text></View><Text style={styles.goalRemaining}>{progress.completed ? "Goal completed" : `${formatINR(progress.remaining)} remaining`}</Text></> : <Text style={styles.goalRemaining}>Open to review goal progress</Text>}
      </Pressable>
    </Surface>
  );
}

function InsightRow({ balanceVisible, insight, onPress }: { balanceVisible: boolean; insight: WealthInsight; onPress: () => void }) {
  const tone = toneForInsight(insight);
  const color = tone === "attention" ? appColors.orangeText : tone === "positive" ? appColors.success : appColors.primary;
  const title = balanceVisible ? insight.title : privacySafeFinancialText(insight.title, "Financial insight");
  const summary = balanceVisible ? insight.summary?.trim() || insight.description : "Open this insight to review the latest account observation.";
  const metric = balanceVisible ? listMetricForInsight(insight) : null;
  return (
    <Surface style={styles.insightRowSurface}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} style={({ pressed }) => [styles.insightRow, pressed && styles.pressed]}>
        <View style={[styles.rowIcon, { backgroundColor: tone === "attention" ? appColors.warningSoft : tone === "positive" ? appColors.successSoft : appColors.primarySoft }]}><Ionicons name={iconForInsight(insight.type)} size={19} color={color} /></View>
        <View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{title}</Text><Text numberOfLines={2} style={styles.rowSummary}>{summary}</Text></View>
        <View style={styles.rowEnd}>{metric ? <Text style={[styles.rowMetric, { color }]}>{metric.value}</Text> : null}<Ionicons name="chevron-forward" size={18} color={appColors.iconMuted} /></View>
      </Pressable>
    </Surface>
  );
}

function CoachCta({ onPress }: { onPress: () => void }) {
  return <Surface style={styles.coachCta}><View style={styles.coachCtaIcon}><Ionicons name="sparkles-outline" size={23} color={appColors.primary} /></View><Text style={styles.coachCtaTitle}>Want to understand your money better?</Text><Text style={styles.coachCtaBody}>Ask about your spending, savings, investments or financial goals.</Text><Pressable accessibilityRole="button" accessibilityLabel="Ask your Wealth Coach" onPress={onPress} style={({ pressed }) => [styles.coachCtaButton, pressed && styles.pressed]}><Text style={styles.coachCtaButtonText}>Ask your Wealth Coach</Text><Ionicons name="arrow-forward" size={17} color={appColors.primary} /></Pressable></Surface>;
}

function InsightsLoadingScreen() {
  const opacity = useSkeletonPulse();
  return <ScreenContainer edges={["bottom"]}><AppHeader sourceRoute="coach" /><ScrollView contentContainerStyle={styles.loadingContent}><Skeleton opacity={opacity} style={styles.loadingBack} /><Skeleton opacity={opacity} style={styles.loadingTitle} /><Skeleton opacity={opacity} style={styles.loadingSubtitle} /><Skeleton opacity={opacity} style={styles.loadingSnapshot} /><Skeleton opacity={opacity} style={styles.loadingFeatured} /><View style={styles.loadingGrid}><Skeleton opacity={opacity} style={styles.loadingSmallCard} /><Skeleton opacity={opacity} style={styles.loadingSmallCard} /></View>{[0, 1, 2, 3].map((item) => <Skeleton key={item} opacity={opacity} style={styles.loadingRow} />)}</ScrollView></ScreenContainer>;
}

function StatePanel({ loading, onAction }: { loading: boolean; onAction: () => void }) {
  return <View style={styles.stateWrap}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={25} color={appColors.primary} /></View><Text accessibilityRole="header" style={styles.stateTitle}>We couldn’t load your insights</Text><Text style={styles.stateDescription}>Your financial data is temporarily unavailable. Please try again.</Text><Pressable accessibilityRole="button" accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={onAction} style={({ pressed }) => [styles.stateButton, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={appColors.surface} size="small" /> : null}<Text style={styles.stateButtonText}>Try again</Text></Pressable></View>;
}

function InsightsEmptyState({ onBack }: { onBack: () => void }) {
  return <View style={styles.stateWrap}><View style={styles.stateIcon}><Ionicons name="sparkles-outline" size={25} color={appColors.primary} /></View><Text accessibilityRole="header" style={styles.stateTitle}>Your insights are being prepared</Text><Text style={styles.stateDescription}>As more account activity becomes available, we’ll identify spending patterns, savings opportunities and financial trends for you.</Text><Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.stateButtonSecondary, pressed && styles.pressed]}><Text style={styles.stateButtonSecondaryText}>Back to Coach</Text></Pressable></View>;
}

function signedINR(value: number): string {
  if (value > 0) return `+${formatINR(value)}`;
  return formatINR(value);
}

function periodLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

const styles = StyleSheet.create({
  content: { paddingTop: appSpacing.sm, paddingBottom: appSpacing.display, maxWidth: 760, alignSelf: "center", width: "100%" },
  pageHeader: { paddingBottom: appSpacing.lg },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingRight: appSpacing.sm },
  backText: { marginLeft: 2, color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: appSpacing.xs },
  titleCopy: { flex: 1 },
  pageTitle: { color: appColors.textPrimary, ...appTypography.pageTitle },
  pageDescription: { marginTop: 2, color: appColors.textSecondary, ...appTypography.supporting },
  titleIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: appColors.primarySoft },
  sectionHeader: { marginTop: appSpacing.lg },
  snapshotCard: { padding: appSpacing.lg },
  snapshotHeading: { marginBottom: appSpacing.md },
  snapshotPeriod: { color: appColors.textPrimary, ...appTypography.cardTitle },
  snapshotScope: { marginTop: 2, color: appColors.textSecondary, ...appTypography.metadata },
  snapshotMetrics: { flexDirection: "row", gap: appSpacing.sm },
  snapshotMetric: { flex: 1, minWidth: 0 },
  metricIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: appColors.primarySoft, marginBottom: appSpacing.sm },
  metricValue: { color: appColors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  metricLabel: { marginTop: 2, color: appColors.textSecondary, ...appTypography.metadata },
  featuredCard: { padding: appSpacing.lg, marginBottom: appSpacing.xs },
  featuredTopline: { flexDirection: "row", alignItems: "center", marginBottom: appSpacing.md },
  featuredIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  featuredEyebrow: { marginLeft: appSpacing.md },
  featuredEyebrowText: { ...appTypography.supporting, fontWeight: "700" },
  featuredMeta: { marginTop: 2, color: appColors.textSecondary, ...appTypography.metadata },
  featuredTitle: { color: appColors.textPrimary, ...appTypography.cardTitle, fontSize: 21, lineHeight: 28 },
  featuredSummary: { marginTop: appSpacing.sm, color: appColors.textBody, ...appTypography.body },
  featuredMetric: { flexDirection: "row", alignItems: "baseline", marginTop: appSpacing.md },
  featuredMetricValue: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  featuredMetricLabel: { marginLeft: appSpacing.sm, color: appColors.textSecondary, ...appTypography.metadata },
  chart: { height: 88, flexDirection: "row", alignItems: "flex-end", gap: appSpacing.md, marginTop: appSpacing.lg, paddingHorizontal: appSpacing.sm },
  chartColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  chartTrack: { width: "100%", height: 62, justifyContent: "flex-end", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.border },
  chartBar: { width: "62%", alignSelf: "center", minHeight: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  chartLabel: { marginTop: 5, color: appColors.textMuted, ...appTypography.metadata },
  featuredActions: { flexDirection: "row", gap: appSpacing.sm, marginTop: appSpacing.lg },
  primaryAction: { minHeight: 44, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: appSpacing.sm, paddingHorizontal: appSpacing.md, borderRadius: appRadii.control, backgroundColor: appColors.primary },
  primaryActionText: { color: appColors.surface, ...appTypography.supporting, fontWeight: "700" },
  secondaryAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: appSpacing.xs, paddingHorizontal: appSpacing.md, borderRadius: appRadii.control, backgroundColor: appColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.primaryBorder },
  secondaryActionText: { ...appTypography.supporting, fontWeight: "700" },
  moneyGrid: { flexDirection: "row", gap: appSpacing.md },
  moneyCard: { flex: 1, padding: appSpacing.lg },
  moneyCardHeader: { flexDirection: "row", alignItems: "center" },
  smallIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, marginRight: appSpacing.sm },
  moneyCardLabel: { flex: 1, color: appColors.textSecondary, ...appTypography.metadata },
  moneyCardValue: { marginTop: appSpacing.md, color: appColors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  moneyCardSupport: { marginTop: 3, color: appColors.textSecondary, ...appTypography.metadata },
  goalCard: { padding: appSpacing.lg },
  goalHeading: { flexDirection: "row", alignItems: "center" },
  goalIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: appColors.primarySoft },
  goalCopy: { flex: 1, marginLeft: appSpacing.md },
  goalTitle: { color: appColors.textPrimary, ...appTypography.cardTitle },
  goalAmount: { marginTop: 2, color: appColors.textSecondary, ...appTypography.supporting },
  goalProgressRow: { flexDirection: "row", alignItems: "center", marginTop: appSpacing.lg },
  goalProgress: { flex: 1 },
  goalPercent: { width: 42, marginLeft: appSpacing.sm, color: appColors.primary, textAlign: "right", ...appTypography.supporting, fontWeight: "700" },
  goalRemaining: { marginTop: appSpacing.sm, color: appColors.textSecondary, ...appTypography.metadata },
  filterContent: { gap: appSpacing.sm, paddingVertical: appSpacing.xs },
  filterChip: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: appSpacing.lg, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border, backgroundColor: appColors.surface },
  filterChipSelected: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  filterText: { color: appColors.textSecondary, ...appTypography.supporting, fontWeight: "600" },
  filterTextSelected: { color: appColors.surface },
  insightList: { gap: appSpacing.sm, marginTop: appSpacing.sm },
  insightRowSurface: { padding: 0 },
  insightRow: { minHeight: 88, flexDirection: "row", alignItems: "center", padding: appSpacing.md },
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  rowCopy: { flex: 1, minWidth: 0, marginLeft: appSpacing.md, marginRight: appSpacing.sm },
  rowTitle: { color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "700" },
  rowSummary: { marginTop: 2, color: appColors.textSecondary, ...appTypography.metadata },
  rowEnd: { alignItems: "flex-end", gap: appSpacing.xs },
  rowMetric: { ...appTypography.metadata, fontWeight: "700" },
  noResults: { paddingVertical: appSpacing.lg, color: appColors.textSecondary, textAlign: "center", ...appTypography.supporting },
  coachCta: { marginTop: appSpacing.xxl, padding: appSpacing.xl, backgroundColor: appColors.primarySoft, borderColor: appColors.primaryBorder },
  coachCtaIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: appColors.surface },
  coachCtaTitle: { marginTop: appSpacing.md, color: appColors.textPrimary, ...appTypography.cardTitle },
  coachCtaBody: { marginTop: appSpacing.xs, color: appColors.textBody, ...appTypography.supporting },
  coachCtaButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: appSpacing.sm, alignSelf: "flex-start", marginTop: appSpacing.md, paddingHorizontal: appSpacing.md, borderRadius: appRadii.control, backgroundColor: appColors.surface },
  coachCtaButtonText: { color: appColors.primaryPressed, ...appTypography.supporting, fontWeight: "700" },
  loadingContent: { padding: appSpacing.xl, paddingBottom: appSpacing.display },
  loadingBack: { width: 120, height: 22, borderRadius: 10, marginBottom: appSpacing.lg },
  loadingTitle: { width: 150, height: 34, borderRadius: 8 },
  loadingSubtitle: { width: 270, height: 18, borderRadius: 8, marginTop: appSpacing.sm },
  loadingSnapshot: { height: 150, borderRadius: appRadii.card, marginTop: appSpacing.xxl },
  loadingFeatured: { height: 260, borderRadius: appRadii.card, marginTop: appSpacing.xxl },
  loadingGrid: { flexDirection: "row", gap: appSpacing.md, marginTop: appSpacing.xxl },
  loadingSmallCard: { flex: 1, height: 140, borderRadius: appRadii.card },
  loadingRow: { height: 88, borderRadius: appRadii.card, marginTop: appSpacing.md },
  stateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: appSpacing.xxl },
  stateIcon: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: appColors.primarySoft },
  stateTitle: { marginTop: appSpacing.lg, color: appColors.textPrimary, textAlign: "center", ...appTypography.cardTitle },
  stateDescription: { maxWidth: 360, marginTop: appSpacing.sm, color: appColors.textSecondary, textAlign: "center", ...appTypography.supporting },
  stateButton: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: appSpacing.sm, marginTop: appSpacing.xl, paddingHorizontal: appSpacing.xl, borderRadius: appRadii.control, backgroundColor: appColors.primary },
  stateButtonText: { color: appColors.surface, ...appTypography.button },
  stateButtonSecondary: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: appSpacing.xl, paddingHorizontal: appSpacing.xl, borderRadius: appRadii.control, borderWidth: 1, borderColor: appColors.primaryBorder },
  stateButtonSecondaryText: { color: appColors.primaryPressed, ...appTypography.button },
  pressed: { opacity: 0.72 },
});
