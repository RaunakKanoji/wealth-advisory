import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { TransactionActivityRow } from "@/components/transactions/transaction-activity-row";
import { appColors, appRadii, appShadows } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A, DEMO_SCENARIO_DATE } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import {
  activityTypeLabel,
  createActivityCsv,
  createRemoteActivityCsv,
  getTransactionExplorerPage,
  getRemoteTransactionExplorerPage,
  isActivityAbortError,
} from "@/services/transaction-explorer-service";
import { TRANSACTION_CATEGORIES, TRANSACTION_CHANNELS, TRANSACTION_STATUSES } from "@/services/accounts-service";
import { isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useStableGetToken } from "@/lib/api/use-stable-get-token";
import { ApiError } from "@/lib/api/client";
import type { PaymentChannel, TransactionCategory, TransactionDirection, TransactionStatus } from "@/types/banking";
import type { CardChannel } from "@/types/cards";
import type { ActivityCsv, ActivityPage, ActivityPeriodPreset, ActivityQueryInput, ActivitySort, ActivityTransactionType } from "@/types/transaction-explorer";

const colors = {
  background: appColors.background,
  surface: appColors.surface,
  text: appColors.textPrimary,
  secondary: appColors.textSecondary,
  muted: appColors.textMuted,
  green: appColors.primary,
  greenDark: appColors.primaryPressed,
  greenSoft: appColors.primarySoft,
  border: appColors.border,
  orange: appColors.orangeText,
  orangeSoft: appColors.warningSoft,
  danger: appColors.danger,
  dangerSoft: appColors.dangerSoft,
};

type LoadState = "loading" | "ready" | "error";
type Choice<T extends string> = { value: T; label: string };
type DirectionFilter = TransactionDirection | "all";
type StatusFilter = TransactionStatus | "all";

const periodChoices: Choice<ActivityPeriodPreset>[] = [
  { value: "all", label: "All" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
];
const validPeriodValues: ActivityPeriodPreset[] = ["all", "this-month", "last-month", "last-90-days", "custom"];
const directionChoices: Choice<DirectionFilter>[] = [
  { value: "all", label: "All directions" },
  { value: "credit", label: "Money in" },
  { value: "debit", label: "Money out" },
];
const statusChoices: Choice<StatusFilter>[] = [
  { value: "all", label: "All statuses" },
  ...TRANSACTION_STATUSES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
];
const activityTypeChoices: (ActivityTransactionType | "all")[] = ["all", "purchase", "cash-withdrawal", "refund", "reversal", "fee", "repayment", "authorisation", "declined", "transfer", "deposit", "salary", "interest", "other"];
const typeChoices: Choice<ActivityTransactionType | "all">[] = activityTypeChoices.map((value) => ({ value, label: value === "all" ? "All types" : activityTypeLabel(value) }));
const sortChoices: Choice<ActivitySort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];
const activityChannelChoices: Choice<PaymentChannel | CardChannel | "all">[] = [
  { value: "all", label: "All channels" },
  ...TRANSACTION_CHANNELS.map((value) => ({ value, label: value })),
  { value: "atm", label: "ATM" },
  { value: "in-store", label: "In-store" },
  { value: "online", label: "Online" },
  { value: "contactless", label: "Contactless" },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function label(value?: string): string {
  if (!value || value === "all") return "All";
  return value.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function displayGroupDate(date: string, remote = false): string {
  const today = remote ? new Date().toISOString().slice(0, 10) : DEMO_SCENARIO_DATE.slice(0, 10);
  if (date === today) return "Today";
  const yesterday = new Date(`${today}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return formatDate(date);
}

function minorUnits(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("The transaction request was cancelled");
      error.name = "AbortError";
      reject(error);
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      const error = new Error("The transaction request was cancelled");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });
}

async function retryTransactionRequest<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable || attempt >= 2) throw error;
      await waitForRetry(Math.min(500 * (2 ** attempt), 2_000) + Math.round(Math.random() * 150), signal);
    }
  }
}

function initialQuery(accountId?: string, cardId?: string, period?: string, category?: string): ActivityQueryInput {
  const validPeriod = validPeriodValues.includes(period as ActivityPeriodPreset) ? period as ActivityPeriodPreset : "all";
  const validCategory = TRANSACTION_CATEGORIES.includes(category as TransactionCategory) ? category as TransactionCategory : "all";
  return {
    scope: accountId ? { mode: "accounts", accountIds: [accountId], cardIds: [] } : cardId ? { mode: "cards", accountIds: [], cardIds: [cardId] } : { mode: "all", accountIds: [], cardIds: [] },
    period: validPeriod,
    category: validCategory,
    direction: "all",
    transactionType: "all",
    status: "all",
    channel: "all",
    currency: "INR",
    sort: "newest",
    page: 1,
    pageSize: 30,
  };
}

type TransactionExplorerScreenProps = {
  title?: string;
  subtitle?: string;
};

export function TransactionExplorerScreen({
  title = "All Transactions",
  subtitle = "Review activity across your connected accounts and cards.",
}: TransactionExplorerScreenProps = {}) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;

  if (!isUserLoaded) {
    return <TransactionExplorerLoadingScreen />;
  }

  return (
    <CustomerTransactionExplorerScreen
      key={customerId}
      customerId={customerId}
      isUserLoaded={isUserLoaded}
      subtitle={subtitle}
      title={title}
    />
  );
}

function CustomerTransactionExplorerScreen({
  customerId,
  isUserLoaded,
  subtitle,
  title,
}: {
  customerId: string;
  isUserLoaded: boolean;
  subtitle: string;
  title: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getToken: clerkGetToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);
  const params = useLocalSearchParams<{ accountId?: string | string[]; cardId?: string | string[]; period?: string | string[]; category?: string | string[] }>();
  const accountId = firstParam(params.accountId);
  const cardId = firstParam(params.cardId);
  const [filters, setFilters] = useState<ActivityQueryInput>(() => initialQuery(accountId, cardId, firstParam(params.period), firstParam(params.category)));
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState<ActivityPage | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<Awaited<ReturnType<typeof import("@/services/transaction-explorer-service").getTransactionExplorerResources>> | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [exportData, setExportData] = useState<ActivityCsv | null>(null);
  const [draftFilters, setDraftFilters] = useState<ActivityQueryInput>(filters);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const resourcesRequestRef = useRef<Promise<Awaited<ReturnType<typeof import("@/services/transaction-explorer-service").getTransactionExplorerResources>>> | null>(null);
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => current.search === searchText ? current : { ...current, search: searchText, page: 1 });
    }, 280);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (balanceVisible) return;
    setExportOpen(false);
    setExportState("idle");
    setExportData(null);
  }, [balanceVisible]);

  useEffect(() => {
    if (isRemoteDataEnabled && !isFinancialAuthReady(isAuthLoaded, isSignedIn)) return;
    let active = true;
    const loadResources = isRemoteDataEnabled
      ? import("@/services/transaction-explorer-service").then(({ getRemoteTransactionExplorerResources }) => getRemoteTransactionExplorerResources({ getToken }))
      : import("@/services/transaction-explorer-service").then(({ getTransactionExplorerResources }) => getTransactionExplorerResources({ customerId }));
    const resourceRequest = retryTransactionRequest(() => loadResources);
    resourcesRequestRef.current = resourceRequest;
    void resourceRequest.then((next) => {
      if (active) setResources(next);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (resourcesRequestRef.current === resourceRequest) resourcesRequestRef.current = null;
    };
  }, [customerId, getToken, isAuthLoaded, isSignedIn]);

  useEffect(() => {
    if (isRemoteDataEnabled && !isFinancialAuthReady(isAuthLoaded, isSignedIn)) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    const hadPage = Boolean(page);
    setLoadState((current) => hadPage ? "ready" : current);
    setIsRefreshing(hadPage);
    setError(null);
    const loadPage = isRemoteDataEnabled
      ? () => (resourcesRequestRef.current
        ? resourcesRequestRef.current.then((nextResources) => getRemoteTransactionExplorerPage(filters, { getToken, signal: controller.signal, resources: nextResources }))
        : getRemoteTransactionExplorerPage(filters, { getToken, signal: controller.signal }))
      : () => getTransactionExplorerPage(filters, { customerId, signal: controller.signal });
    void retryTransactionRequest(loadPage, controller.signal).then((next) => {
      if (!controller.signal.aborted) {
        setPage(next);
        setLoadState("ready");
        setIsRefreshing(false);
      }
    }).catch((reason: unknown) => {
      if (isActivityAbortError(reason)) return;
      setLoadState(hadPage ? "ready" : "error");
      setError(reason instanceof Error ? reason.message : "The transaction service is unavailable.");
      setIsRefreshing(false);
    });
    return () => controller.abort();
    // JSON is intentional: each filter is a query boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, getToken, isAuthLoaded, isSignedIn, queryKey, refreshVersion]);

  const updateFilters = (patch: Partial<ActivityQueryInput>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const retryPage = () => {
    if (isRefreshing) return;
    setRefreshVersion((current) => current + 1);
  };
  const openFilters = () => {
    setDraftFilters(filters);
    setMinAmount(filters.minAmountMinorUnits === undefined ? "" : (filters.minAmountMinorUnits / 100).toFixed(2));
    setMaxAmount(filters.maxAmountMinorUnits === undefined ? "" : (filters.maxAmountMinorUnits / 100).toFixed(2));
    setDraftError(null);
    setFiltersOpen(true);
  };
  const applyDraftFilters = () => {
    const min = minorUnits(minAmount);
    const max = minorUnits(maxAmount);
    if (minAmount.trim() && min === undefined) return setDraftError("Enter a valid minimum amount.");
    if (maxAmount.trim() && max === undefined) return setDraftError("Enter a valid maximum amount.");
    if (min !== undefined && max !== undefined && min > max) return setDraftError("Minimum amount must be below maximum amount.");
    setFilters({ ...draftFilters, minAmountMinorUnits: min, maxAmountMinorUnits: max, page: 1 });
    setFiltersOpen(false);
  };
  const chooseScope = (next: ActivityQueryInput["scope"]) => {
    setFilters((current) => ({ ...current, scope: next, page: 1 }));
    setScopeOpen(false);
  };
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)");
  const requestExport = async () => {
    if (!balanceVisible) {
      Alert.alert("Amounts are hidden", "Show amounts before exporting transaction values.");
      return;
    }
    setExportOpen(true);
    setExportState("loading");
    try {
      const result = isRemoteDataEnabled
        ? await createRemoteActivityCsv(filters, { getToken })
        : await createActivityCsv(filters, { customerId });
      setExportData(result);
      setExportState("ready");
    } catch {
      setExportState("error");
    }
  };
  const downloadExport = async () => {
    if (!balanceVisible || !exportData) return;
    try {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([exportData.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = exportData.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: exportData.filename, message: exportData.csv });
      }
      setExportOpen(false);
    } catch {
      Alert.alert("Export unavailable", "The file could not be shared. Please try again.");
    }
  };
  const askCoach = () => {
    const scope = filters.scope;
    const coachParams: Record<string, string> = { period: filters.period ?? "all", source: "activity-explorer" };
    if (filters.period === "custom" && filters.fromDate) coachParams.fromDate = filters.fromDate;
    if (filters.period === "custom" && filters.toDate) coachParams.toDate = filters.toDate;
    if (filters.category && filters.category !== "all") coachParams.category = filters.category;
    if (scope?.mode === "accounts" && scope.accountIds?.length === 1) coachParams.accountId = scope.accountIds[0];
    if (scope?.mode === "cards" && scope.cardIds?.length === 1) coachParams.cardId = scope.cardIds[0];
    router.push({ pathname: "/(app)/coach/chat", params: coachParams });
  };

  const activeFilterLabels = useMemo(() => {
    const values: { key: string; text: string; clear: () => void }[] = [];
    if (filters.search) values.push({ key: "search", text: `Search: ${filters.search}`, clear: () => { setSearchText(""); updateFilters({ search: "" }); } });
    if (filters.period && filters.period !== "all") values.push({ key: "period", text: filters.period === "custom" ? `Dates: ${filters.fromDate ?? "Start"}–${filters.toDate ?? "End"}` : label(filters.period), clear: () => updateFilters({ period: "all", fromDate: undefined, toDate: undefined }) });
    if (filters.direction && filters.direction !== "all") values.push({ key: "direction", text: label(filters.direction), clear: () => updateFilters({ direction: "all" }) });
    if (filters.transactionType && filters.transactionType !== "all") values.push({ key: "type", text: label(filters.transactionType), clear: () => updateFilters({ transactionType: "all" }) });
    if (filters.status && filters.status !== "all") values.push({ key: "status", text: label(filters.status), clear: () => updateFilters({ status: "all" }) });
    if (filters.category && filters.category !== "all") values.push({ key: "category", text: label(filters.category), clear: () => updateFilters({ category: "all" }) });
    if (filters.channel && filters.channel !== "all") values.push({ key: "channel", text: filters.channel, clear: () => updateFilters({ channel: "all" }) });
    if (filters.minAmountMinorUnits !== undefined || filters.maxAmountMinorUnits !== undefined) values.push({ key: "amount", text: balanceVisible ? `Amount ${filters.minAmountMinorUnits === undefined ? "0" : formatIndianMinorUnits(filters.minAmountMinorUnits)}–${filters.maxAmountMinorUnits === undefined ? "any" : formatIndianMinorUnits(filters.maxAmountMinorUnits)}` : "Amount filter applied", clear: () => updateFilters({ minAmountMinorUnits: undefined, maxAmountMinorUnits: undefined }) });
    return values;
  }, [balanceVisible, filters]);

  const horizontalPadding = width < 375 ? 16 : 20;
  const scopeLabel = page?.summary.scopeLabel ?? "All accounts & cards";
  const scopeAccountCount = page?.query.scope.accountIds.length ?? resources?.accounts.length ?? 0;
  const scopeCardCount = page?.query.scope.cardIds.length ?? resources?.cards.length ?? 0;
  const scopeMeta = `${scopeAccountCount} account${scopeAccountCount === 1 ? "" : "s"} · ${scopeCardCount} card${scopeCardCount === 1 ? "" : "s"}`;
  const syncLabel = isRefreshing ? "Updating…" : page?.coverage.lastSuccessfulUpdate ? "Updated recently" : "Connected";
  const hasFilter = activeFilterLabels.length > 0 || filters.period !== "all";
  const advancedFilterCount = activeFilterLabels.filter((item) => item.key !== "search" && item.key !== "period").length;
  const grouped = useMemo(() => {
    if (filters.sort === "amount-desc" || filters.sort === "amount-asc") return page?.items?.length ? [{ date: "", items: page.items }] : [];
    const groups: { date: string; items: NonNullable<ActivityPage>["items"] }[] = [];
    (page?.items ?? []).forEach((item) => {
      const group = groups.find((entry) => entry.date === item.transactionDate);
      if (group) group.items.push(item);
      else groups.push({ date: item.transactionDate, items: [item] });
    });
    return groups;
  }, [filters.sort, page]);

  if (!isBalanceVisibilityHydrated) {
    return <TransactionExplorerLoadingScreen />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 56 + insets.bottom }}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>
            <View style={styles.headerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh transactions" accessibilityState={{ busy: isRefreshing }} disabled={isRefreshing} onPress={retryPage} style={({ pressed }) => [styles.iconButton, isRefreshing && styles.disabled, pressed && styles.pressed]}><Ionicons name="refresh-outline" size={21} color={colors.greenDark} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Export transactions" onPress={() => void requestExport()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="download-outline" size={21} color={colors.greenDark} /></Pressable>
            </View>
          </View>
          <View style={styles.titleRow}><View style={styles.titleColumn}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View><View style={styles.syncStatus}><View style={[styles.syncDot, isRefreshing && styles.syncDotUpdating]} /><Text style={styles.syncText}>{syncLabel}</Text></View></View>

          <Pressable accessibilityRole="button" accessibilityLabel={`Transaction scope: ${scopeLabel}`} onPress={() => setScopeOpen(true)} style={({ pressed }) => [styles.scopeCard, pressed && styles.pressed]}><View style={styles.scopeIcon}><Ionicons name="layers-outline" size={21} color={colors.greenDark} /></View><View style={styles.scopeCopy}><Text numberOfLines={1} style={styles.scopeTitle}>{scopeLabel}</Text><Text numberOfLines={1} style={styles.scopeMeta}>{scopeMeta}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.secondary} /></Pressable>

          <View style={styles.searchCard}><View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.secondary} /><TextInput accessibilityLabel="Search all transactions" value={searchText} onChangeText={setSearchText} placeholder="Search transactions" placeholderTextColor={colors.muted} style={styles.searchInput} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{periodChoices.map((item) => <ChoiceChip key={item.value} label={item.label} selected={filters.period === item.value} onPress={() => updateFilters({ period: item.value, fromDate: undefined, toDate: undefined })} />)}<ChoiceChip label="Custom" selected={filters.period === "custom"} onPress={openFilters} /><Pressable accessibilityRole="button" onPress={openFilters} style={({ pressed }) => [styles.filterButton, hasFilter && styles.filterButtonActive, pressed && styles.pressed]}><Ionicons name="options-outline" size={16} color={hasFilter ? "#FFFFFF" : colors.greenDark} /><Text style={[styles.filterButtonText, hasFilter && styles.filterButtonTextActive]}>{advancedFilterCount ? `Filters · ${advancedFilterCount}` : "Filters"}</Text></Pressable></ScrollView>{activeFilterLabels.length ? <View style={styles.appliedRow}>{activeFilterLabels.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`Remove ${item.text} filter`} onPress={item.clear} style={styles.appliedChip}><Text numberOfLines={1} style={styles.appliedText}>{item.text}</Text><Ionicons name="close" size={14} color={colors.greenDark} /></Pressable>)}</View> : null}</View>

          {page ? <SummaryCard balanceVisible={balanceVisible} page={page} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Ask Wealth Coach about this activity" onPress={askCoach} style={({ pressed }) => [styles.coachButton, pressed && styles.pressed]}><Ionicons name="sparkles-outline" size={19} color={colors.greenDark} /><View style={styles.coachCopy}><Text style={styles.coachTitle}>Ask Wealth Coach</Text><Text style={styles.coachText}>Understand this activity or get help with your spending.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.greenDark} /></Pressable>

          {loadState === "loading" && !page ? <LoadingState /> : loadState === "error" && !page ? <StateCard title="Transactions unavailable" description={error ?? "The transaction service is unavailable."} actionLabel="Try again" onAction={retryPage} /> : !page || page.totalItems === 0 ? <StateCard title={hasFilter ? "No matching transactions" : "No transactions yet"} description={hasFilter ? "Try changing the search or filters." : "Transactions will appear here when records are available from the connected data sources."} /> : <View style={styles.resultsCard}><View style={styles.resultsHeader}><View><Text style={styles.resultsTitle}>Transactions</Text><Text style={styles.resultsMeta}>{page.totalItems} transactions · page {page.page} of {page.totalPages}</Text></View>{isRefreshing ? <ActivityIndicator color={colors.green} /> : null}</View>{error ? <Text style={styles.refreshError} accessibilityRole="alert">{error} Showing the last successful data.</Text> : null}{grouped.map((group) => <View key={group.date}><Text style={styles.dateHeading}>{group.date ? displayGroupDate(group.date, isRemoteDataEnabled) : "Sorted by amount"}</Text>{group.items.map((item) => <TransactionActivityRow key={item.id} activity={item} isBalanceVisible={balanceVisible} onPress={() => router.push({ pathname: "/(app)/activity/[transactionId]", params: { activityId: item.id, transactionId: item.id } })} />)}</View>)}<View style={styles.paginationRow}><Text style={styles.paginationText}>Showing {page.items.length} of {page.totalItems}</Text><View style={styles.paginationButtons}><Pressable accessibilityRole="button" accessibilityLabel="Previous transaction page" disabled={page.page <= 1 || isRefreshing} onPress={() => updateFilters({ page: Math.max(1, page.page - 1) })} style={({ pressed }) => [styles.pageButton, (page.page <= 1 || isRefreshing) && styles.disabled, pressed && styles.pressed]}><Ionicons name="chevron-back" size={18} color={page.page <= 1 ? colors.muted : colors.greenDark} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next transaction page" disabled={page.page >= page.totalPages || isRefreshing} onPress={() => updateFilters({ page: Math.min(page.totalPages, page.page + 1) })} style={({ pressed }) => [styles.pageButton, (page.page >= page.totalPages || isRefreshing) && styles.disabled, pressed && styles.pressed]}><Ionicons name="chevron-forward" size={18} color={page.page >= page.totalPages ? colors.muted : colors.greenDark} /></Pressable></View></View></View>}
          {page?.coverage ? <View style={styles.coverageCard}><Ionicons name="information-circle-outline" size={18} color={colors.secondary} /><View style={styles.coverageCopy}><Text style={styles.coverageTitle}>Data coverage</Text><Text style={styles.coverageText}>{page.coverage.note}</Text><Text style={styles.coverageText}>Available {page.coverage.availableFrom ? formatDate(page.coverage.availableFrom) : "date unavailable"} to {page.coverage.availableTo ? formatDate(page.coverage.availableTo) : "date unavailable"} · Source: {page.coverage.sourceEnvironment}</Text><Text style={styles.coverageText}>Last updated {page.coverage.lastSuccessfulUpdate ? formatDate(page.coverage.lastSuccessfulUpdate) : "not supplied"}</Text></View></View> : null}
        </View>
      </ScrollView>

      <Modal visible={scopeOpen} transparent animationType="slide" onRequestClose={() => setScopeOpen(false)}><ModalShell title="Choose activity scope" onClose={() => setScopeOpen(false)}><ScopeChoice label="All accounts and cards" selected={filters.scope?.mode === "all"} onPress={() => chooseScope({ mode: "all", accountIds: [], cardIds: [] })} />{resources?.accounts.map((item) => <ScopeChoice key={item.id} label={`${item.nickname ?? item.name} · •••• ${item.lastFour}`} detail="Account" selected={filters.scope?.mode === "accounts" && filters.scope.accountIds?.includes(item.id)} onPress={() => chooseScope({ mode: "accounts", accountIds: [item.id], cardIds: [] })} />)}{resources?.cards.map((item) => <ScopeChoice key={item.id} label={`${item.nickname ?? item.productName} · •••• ${item.lastFour}`} detail="Card" selected={filters.scope?.mode === "cards" && filters.scope.cardIds?.includes(item.id)} onPress={() => chooseScope({ mode: "cards", accountIds: [], cardIds: [item.id] })} />)}</ModalShell></Modal>

      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}><ModalShell title="Filter transactions" onClose={() => setFiltersOpen(false)}><ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}><FilterGroup label="Direction"><ChoiceGrid choices={directionChoices} value={draftFilters.direction ?? "all"} onChange={(value) => setDraftFilters((current) => ({ ...current, direction: value }))} /></FilterGroup><FilterGroup label="Status"><ChoiceGrid choices={statusChoices} value={draftFilters.status ?? "all"} onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))} /></FilterGroup><FilterGroup label="Transaction type"><ChoiceGrid choices={typeChoices} value={draftFilters.transactionType ?? "all"} onChange={(value) => setDraftFilters((current) => ({ ...current, transactionType: value }))} /></FilterGroup><FilterGroup label="Category"><ChoiceGrid choices={[{ value: "all", label: "All categories" }, ...TRANSACTION_CATEGORIES.map((value) => ({ value, label: label(value) }))]} value={draftFilters.category ?? "all"} onChange={(value) => setDraftFilters((current) => ({ ...current, category: value as ActivityQueryInput["category"] }))} /></FilterGroup><FilterGroup label="Channel"><ChoiceGrid choices={activityChannelChoices} value={draftFilters.channel ?? "all"} onChange={(value) => setDraftFilters((current) => ({ ...current, channel: value as ActivityQueryInput["channel"] }))} /></FilterGroup><FilterGroup label="Sort"><ChoiceGrid choices={sortChoices} value={draftFilters.sort ?? "newest"} onChange={(value) => setDraftFilters((current) => ({ ...current, sort: value }))} /></FilterGroup><Text style={styles.fieldLabel}>Custom date range (YYYY-MM-DD)</Text><View style={styles.dateInputs}><TextInput accessibilityLabel="Start date" value={draftFilters.fromDate ?? ""} onChangeText={(value) => setDraftFilters((current) => ({ ...current, period: "custom", fromDate: value }))} placeholder="Start date" placeholderTextColor={colors.muted} style={styles.dateInput} /><TextInput accessibilityLabel="End date" value={draftFilters.toDate ?? ""} onChangeText={(value) => setDraftFilters((current) => ({ ...current, period: "custom", toDate: value }))} placeholder="End date" placeholderTextColor={colors.muted} style={styles.dateInput} /></View><Text style={styles.fieldLabel}>Amount range in INR</Text>{balanceVisible ? <View style={styles.dateInputs}><TextInput accessibilityLabel="Minimum amount" value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" placeholder="Minimum" placeholderTextColor={colors.muted} style={styles.dateInput} /><TextInput accessibilityLabel="Maximum amount" value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" placeholder="Maximum" placeholderTextColor={colors.muted} style={styles.dateInput} /></View> : <View style={styles.hiddenAmountNotice}><Ionicons name="eye-off-outline" size={17} color={colors.secondary} /><Text style={styles.hiddenAmountText}>Amount values are hidden. Show amounts to review or change this range.</Text></View>}{draftError ? <Text style={styles.formError} accessibilityRole="alert">{draftError}</Text> : null}<Pressable accessibilityRole="button" onPress={applyDraftFilters} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Apply filters</Text></Pressable></ScrollView></ModalShell></Modal>

      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}><ModalShell title="Review export" onClose={() => setExportOpen(false)}>{exportState === "loading" ? <View style={styles.modalLoading}><ActivityIndicator color={colors.green} /><Text style={styles.modalBody}>Preparing the complete matching dataset…</Text></View> : exportState === "error" ? <StateCard title="Export unavailable" description="The export could not be prepared." actionLabel="Close" onAction={() => setExportOpen(false)} /> : exportData ? <><Text style={styles.modalLead}>CSV summary</Text><ReviewRow label="Scope" value={exportData.scopeLabel} /><ReviewRow label="Period" value={exportData.periodLabel} /><ReviewRow label="Filters" value={exportData.filterLabel} /><ReviewRow label="Statuses" value={exportData.includedStatuses} /><ReviewRow label="Records" value={String(exportData.rowCount)} /><View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color={colors.greenDark} /><Text style={styles.noticeText}>Personal notes are excluded. {isRemoteDataEnabled ? "Records are from the owner-scoped banking API. They are not an official bank statement." : "This is demo data and not an official bank statement."}</Text></View><Pressable accessibilityRole="button" onPress={() => void downloadExport()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Ionicons name="download-outline" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Export CSV</Text></Pressable></> : null}</ModalShell></Modal>
    </View>
  );
}

function SummaryCard({ balanceVisible, page }: { balanceVisible: boolean; page: ActivityPage }) {
  const { summary } = page;
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.eyebrow}>Matching summary</Text>
      <Text style={styles.summaryScope}>{summary.scopeLabel} · {page.totalItems} transactions</Text>
      {summary.includedPostedCount === 0 && (summary.pendingCount > 0 || summary.failedCount > 0) ? <Text style={styles.noPostedText}>No posted entries in this view.</Text> : null}
      <View style={styles.metricGrid}>
        <Metric balanceVisible={balanceVisible} label="Money in" value={summary.accountCreditsMinorUnits} color={colors.greenDark} />
        <Metric balanceVisible={balanceVisible} label="Money out" value={summary.accountDebitsMinorUnits} />
        <Metric balanceVisible={balanceVisible} label="Account net" value={summary.netAccountMovementMinorUnits} color={summary.netAccountMovementMinorUnits >= 0 ? colors.greenDark : colors.danger} />
        <Metric balanceVisible={balanceVisible} label="Card purchases" value={summary.cardPostedPurchasesMinorUnits} />
        <Metric balanceVisible={balanceVisible} label="Card refunds" value={summary.cardPostedRefundsMinorUnits} color={colors.greenDark} />
      </View>
      <View style={styles.statusSummary}>
        <Text style={styles.summaryMeta}>{summary.includedPostedCount} posted/reversed · {summary.pendingCount} pending · {summary.failedCount} failed</Text>
        <Text style={styles.summaryHint}>Amounts are calculated from posted activity in this view.</Text>
      </View>
    </View>
  );
}

function Metric({ balanceVisible, label: metricLabel, value, color = colors.text }: { balanceVisible: boolean; label: string; value: number; color?: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{metricLabel}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} accessibilityLabel={`${metricLabel}, ${balanceVisible ? formatIndianMinorUnits(value) : "amount hidden"}`} style={[styles.metricValue, { color }]}>{balanceVisible ? formatIndianMinorUnits(value) : "Amount hidden"}</Text></View>; }

function TransactionExplorerLoadingScreen() {
  return <View style={styles.screenLoading}><ActivityIndicator color={colors.green} /><Text style={styles.loadingScreenText}>Loading transactions</Text></View>;
}

function LoadingState() {
  return <View style={styles.loadingCard} accessibilityLabel="Loading transactions"><View style={styles.loadingHeaderBlock} />{[0, 1, 2].map((item) => <View key={item} style={styles.loadingRow}><View style={styles.loadingIcon} /><View style={styles.loadingCopy}><View style={styles.loadingLine} /><View style={[styles.loadingLine, styles.loadingLineShort]} /></View><View style={styles.loadingAmount} /></View>)}</View>;
}

function StateCard({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) { return <View style={styles.stateCard}><Ionicons name="receipt-outline" size={27} color={colors.greenDark} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{description}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateAction}><Text style={styles.stateActionText}>{actionLabel}</Text></Pressable> : null}</View>; }

function ChoiceChip({ label: chipLabel, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.choiceChip, selected && styles.choiceChipSelected, pressed && styles.pressed]}><Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{chipLabel}</Text></Pressable>; }

function FilterGroup({ label: groupLabel, children }: { label: string; children: React.ReactNode }) { return <View><Text style={styles.fieldLabel}>{groupLabel}</Text>{children}</View>; }
function ChoiceGrid<T extends string>({ choices, value, onChange }: { choices: Choice<T>[]; value: T; onChange: (value: T) => void }) { return <View style={styles.choiceGrid}>{choices.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: value === item.value }} onPress={() => onChange(item.value)} style={[styles.choiceButton, value === item.value && styles.choiceButtonSelected]}><Text style={[styles.choiceText, value === item.value && styles.choiceTextSelected]}>{item.label}</Text></Pressable>)}</View>; }

function ScopeChoice({ label: choiceLabel, detail, selected, onPress }: { label: string; detail?: string; selected?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.scopeChoice, selected && styles.scopeChoiceSelected]}><View style={styles.scopeChoiceIcon}>{selected ? <Ionicons name="checkmark" size={17} color={colors.greenDark} /> : null}</View><View style={styles.scopeChoiceCopy}><Text style={styles.scopeChoiceLabel}>{choiceLabel}</Text>{detail ? <Text style={styles.scopeChoiceDetail}>{detail}</Text> : null}</View></Pressable>; }

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <View style={styles.modalBackdrop}><View style={styles.modal}><View style={styles.modalHeader}><Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View>{children}</View></View>; }
function ReviewRow({ label: rowLabel, value }: { label: string; value: string }) { return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{rowLabel}</Text><Text style={styles.reviewValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenLoading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loadingScreenText: { marginTop: 10, color: colors.secondary, fontSize: 14 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center" },
  headerRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "700" },
  headerActions: { flexDirection: "row", columnGap: 4 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12 },
  titleColumn: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: "800" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 14, lineHeight: 21 },
  syncStatus: { flexDirection: "row", alignItems: "center", marginTop: 8, marginLeft: 10 },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  syncDotUpdating: { backgroundColor: colors.orange },
  syncText: { marginLeft: 5, color: colors.secondary, fontSize: 11, fontWeight: "700" },
  scopeCard: { flexDirection: "row", alignItems: "center", marginTop: 19, padding: 13, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  scopeIcon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.greenSoft },
  scopeCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  eyebrow: { color: colors.secondary, fontSize: 11, lineHeight: 15, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  scopeTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  scopeMeta: { marginTop: 3, color: colors.secondary, fontSize: 11 },
  searchCard: { marginTop: 12, padding: 12, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.background },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 8, paddingVertical: 8, color: colors.text, fontSize: 13 },
  chipRow: { alignItems: "center", columnGap: 7, paddingTop: 10, paddingBottom: 2 },
  choiceChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: appRadii.tile, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  choiceChipSelected: { backgroundColor: colors.greenSoft, borderColor: "#B8DED5" },
  choiceChipText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  choiceChipTextSelected: { color: colors.greenDark },
  filterButton: { minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 5, paddingHorizontal: 12, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.greenDark },
  filterButtonActive: { backgroundColor: colors.greenDark },
  filterButtonText: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  filterButtonTextActive: { color: "#FFFFFF" },
  appliedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 9 },
  appliedChip: { maxWidth: "100%", minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 5, paddingHorizontal: 9, borderRadius: 22, backgroundColor: colors.greenSoft },
  appliedText: { maxWidth: 230, color: colors.greenDark, fontSize: 11, fontWeight: "700" },
  summaryCard: { marginTop: 15, padding: 16, borderRadius: appRadii.tile, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...appShadows.surface },
  summaryScope: { marginTop: 3, color: colors.secondary, fontSize: 12 },
  noPostedText: { marginTop: 15, color: colors.orange, fontSize: 13, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16, marginTop: 16 },
  metric: { width: "48%", minWidth: 0 },
  metricLabel: { color: colors.secondary, fontSize: 11, lineHeight: 16 },
  metricValue: { marginTop: 3, fontSize: 16, lineHeight: 21, fontWeight: "800" },
  statusSummary: { marginTop: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  summaryMeta: { color: colors.secondary, fontSize: 11, lineHeight: 16 },
  summaryHint: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 16 },
  coverageText: { marginTop: 4, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  coverageCard: { flexDirection: "row", alignItems: "flex-start", marginTop: 10, padding: 13, borderRadius: 15, backgroundColor: "#F0F3F5" },
  coverageCopy: { flex: 1, marginLeft: 8 },
  coverageTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  coachButton: { flexDirection: "row", alignItems: "center", marginTop: 11, padding: 13, borderRadius: 15, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: "#CBE6DE" },
  coachCopy: { flex: 1, marginLeft: 8 },
  coachTitle: { color: colors.greenDark, fontSize: 13, fontWeight: "800" },
  coachText: { marginTop: 2, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  resultsCard: { marginTop: 17, overflow: "hidden", borderRadius: appRadii.tile, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...appShadows.surface },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 11 },
  resultsTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  resultsMeta: { marginTop: 3, color: colors.secondary, fontSize: 11 },
  refreshError: { marginHorizontal: 16, marginBottom: 10, color: colors.orange, fontSize: 11, lineHeight: 16 },
  dateHeading: { paddingHorizontal: 13, paddingTop: 14, paddingBottom: 6, color: colors.greenDark, backgroundColor: "#FBFCFC", fontSize: 12, fontWeight: "800" },
  paginationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  paginationText: { color: colors.secondary, fontSize: 11 },
  paginationButtons: { flexDirection: "row", columnGap: 6 },
  pageButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.greenSoft },
  disabled: { opacity: 0.45 },
  loadingCard: { alignItems: "center", marginTop: 18, padding: 30, borderRadius: 18, backgroundColor: colors.surface },
  loadingHeaderBlock: { alignSelf: "flex-start", width: 150, height: 18, borderRadius: 9, backgroundColor: "#E9EEF0" },
  loadingRow: { width: "100%", minHeight: 66, flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  loadingIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E9EEF0" },
  loadingCopy: { flex: 1, marginHorizontal: 12 },
  loadingLine: { width: "78%", height: 12, borderRadius: 6, backgroundColor: "#E9EEF0" },
  loadingLineShort: { width: "48%", marginTop: 8 },
  loadingAmount: { width: 64, height: 15, borderRadius: 8, backgroundColor: "#E9EEF0" },
  stateCard: { alignItems: "center", marginTop: 18, padding: 27, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateTitle: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: "800" },
  stateText: { maxWidth: 450, marginTop: 6, color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  stateAction: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11, backgroundColor: colors.greenDark },
  stateActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.34)" },
  modal: { maxHeight: "92%", paddingHorizontal: 20, paddingTop: 17, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  modalScroll: { flexGrow: 0 },
  scopeChoice: { minHeight: 58, flexDirection: "row", alignItems: "center", marginTop: 8, padding: 11, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  scopeChoiceSelected: { backgroundColor: colors.greenSoft, borderColor: "#B8DED5" },
  scopeChoiceIcon: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.surface },
  scopeChoiceCopy: { flex: 1, marginLeft: 10 },
  scopeChoiceLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  scopeChoiceDetail: { marginTop: 2, color: colors.secondary, fontSize: 11 },
  fieldLabel: { marginTop: 16, marginBottom: 8, color: colors.secondary, fontSize: 12, fontWeight: "800" },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choiceButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 22, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  choiceButtonSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  choiceText: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  choiceTextSelected: { color: "#FFFFFF" },
  dateInputs: { flexDirection: "row", columnGap: 8 },
  dateInput: { flex: 1, minHeight: 44, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 13 },
  hiddenAmountNotice: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  hiddenAmountText: { flex: 1, marginLeft: 7, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  formError: { marginTop: 10, color: colors.danger, fontSize: 12 },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 18, borderRadius: 12, backgroundColor: colors.greenDark },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  modalLoading: { alignItems: "center", paddingVertical: 26 },
  modalBody: { marginTop: 12, color: colors.secondary, fontSize: 13, textAlign: "center" },
  modalLead: { color: colors.text, fontSize: 15, fontWeight: "700" },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", columnGap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewLabel: { flex: 1, color: colors.secondary, fontSize: 12 },
  reviewValue: { flex: 1.4, color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "right" },
  notice: { flexDirection: "row", alignItems: "flex-start", marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  noticeText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
