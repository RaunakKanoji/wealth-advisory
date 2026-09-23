import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  AccountsBalanceCard,
  AccountsListCard,
  AccountsScreenHeader,
  AccountsSkeletons,
} from "@/components/accounts";
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { accountColors } from "@/components/accounts/tokens";
import { StateCard } from "@/components/design-system";
import { StatusBanner } from "@/components/status-banner";
import { appMotion, appRadii, appSpacing } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { useFinancialData } from "@/lib/api/hooks";
import { isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useLoadingTimeout } from "@/lib/use-loading-timeout";
import { useDemoSession } from "@/lib/demo-session";
import {
  getAccountsOverview,
  updateBalanceVisibility,
} from "@/services/accounts-service";
import type { AccountListFilter } from "@/services/accounts-service";
import type {
  AccountOverviewAction,
  AccountOverviewItem,
  AccountsOverview,
  BankAccount,
} from "@/types/banking";

const accountFilters: { key: AccountListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "savings", label: "Savings" },
  { key: "current", label: "Current" },
  { key: "deposits", label: "Deposits" },
];

function mapAccountError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "We couldn’t reach the banking service.";
    if (error.status === 401 || error.status === 403) return "Your session needs to be refreshed.";
    if (error.status === 503) return "Account information is temporarily unavailable.";
  }
  return apiErrorMessage(error, "account information");
}

function matchesFilter(account: AccountOverviewItem, filter: AccountListFilter): boolean {
  if (filter === "all") return true;
  if (filter === "deposits") return account.productKind !== "transaction";
  if (filter === "savings") return account.type === "savings" || account.type === "salary";
  return account.type === "current";
}

function accountSource(): "demo" | "remote" {
  // Remote seed data is still authenticated API data; adapter selection must
  // never depend on a provider-facing display label.
  return isRemoteDataEnabled ? "remote" : "demo";
}

export default function AccountsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const remoteQuery = useFinancialData();
  const {
    overview: remoteOverview,
    error: remoteError,
    isFetching: remoteIsFetching,
    isLoading: remoteIsLoading,
    refetch: refetchRemoteOverview,
  } = remoteQuery;
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const remoteAuthReady = isFinancialAuthReady(isAuthLoaded, isSignedIn);

  const [localOverview, setLocalOverview] = useState<AccountsOverview | null>(null);
  const [localCustomerId, setLocalCustomerId] = useState(customerId);
  const [localIsLoading, setLocalIsLoading] = useState(!isRemoteDataEnabled);
  const [localIsRefreshing, setLocalIsRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AccountListFilter>("all");
  const activeCustomerId = useRef(customerId);
  const localRequestId = useRef(0);
  const localOverviewRef = useRef<AccountsOverview | null>(localOverview);
  activeCustomerId.current = customerId;
  localOverviewRef.current = localOverview;

  const {
    balanceVisible,
    isBalanceVisibilityHydrated,
  } = useBalanceVisibility(customerId, isDemoUserReady);
  const effectiveBalanceVisible = isBalanceVisibilityHydrated && balanceVisible;

  const loadLocalOverview = useCallback(async (initialLoad = false) => {
    if (isRemoteDataEnabled || !isDemoUserReady) return;

    const requestedCustomerId = customerId;
    const requestId = ++localRequestId.current;
    if (initialLoad) {
      setLocalIsLoading(true);
      setLocalOverview(null);
      localOverviewRef.current = null;
    } else {
      setLocalIsRefreshing(true);
    }
    setLocalError(null);

    try {
      const nextOverview = await getAccountsOverview({ customerId: requestedCustomerId });
      if (activeCustomerId.current !== requestedCustomerId || localRequestId.current !== requestId) return;
      setLocalOverview(nextOverview);
      localOverviewRef.current = nextOverview;
      setLocalCustomerId(requestedCustomerId);
    } catch {
      if (activeCustomerId.current !== requestedCustomerId || localRequestId.current !== requestId) return;
      setLocalCustomerId(requestedCustomerId);
      setLocalError("Account information is temporarily unavailable.");
    } finally {
      if (activeCustomerId.current !== requestedCustomerId || localRequestId.current !== requestId) return;
      setLocalIsLoading(false);
      setLocalIsRefreshing(false);
    }
  }, [customerId, isDemoUserReady]);

  useEffect(() => {
    if (!isRemoteDataEnabled) void loadLocalOverview(true);
  }, [loadLocalOverview]);

  const isCurrentLocalCustomer = localCustomerId === customerId;
  const overview = isRemoteDataEnabled
    ? remoteOverview ?? null
    : isCurrentLocalCustomer
      ? localOverview
      : null;
  const visibleError = isRemoteDataEnabled
    ? !remoteAuthReady && isAuthLoaded
      ? "Your session needs to be refreshed."
      : remoteError
        ? mapAccountError(remoteError)
        : null
    : isCurrentLocalCustomer
      ? localError
      : null;
  const isInitialLoading = !isDemoUserReady || (isRemoteDataEnabled
    ? !isAuthLoaded || (remoteAuthReady && !remoteOverview && (remoteIsLoading || remoteIsFetching))
    : !isCurrentLocalCustomer || (localIsLoading && !localOverview));
  const { timedOut: loadingTimedOut, reset: resetLoadingTimeout } = useLoadingTimeout(isInitialLoading);
  const isRefreshing = isRemoteDataEnabled
    ? remoteIsFetching && Boolean(remoteOverview)
    : localIsRefreshing;

  const refreshAccounts = useCallback(() => {
    resetLoadingTimeout();
    if (isRemoteDataEnabled) {
      if (remoteAuthReady) void refetchRemoteOverview();
      return;
    }
    void loadLocalOverview(false);
  }, [loadLocalOverview, refetchRemoteOverview, remoteAuthReady, resetLoadingTimeout]);

  // Tabs stay mounted. Refresh only after the first focus so cached content is
  // shown immediately and subsequent visits reconcile quietly in the background.
  const hasHandledInitialFocus = useRef(false);
  const refreshOnFocusRef = useRef(refreshAccounts);
  refreshOnFocusRef.current = refreshAccounts;
  useFocusEffect(
    useCallback(() => {
      if (!hasHandledInitialFocus.current) {
        hasHandledInitialFocus.current = true;
        return;
      }
      refreshOnFocusRef.current();
    }, []),
  );

  const filteredAccounts = useMemo(
    () => overview?.accounts.filter((account) => matchesFilter(account, filter)) ?? [],
    [filter, overview],
  );

  const selectFilter = (nextFilter: AccountListFilter) => {
    if (nextFilter === filter) return;
    LayoutAnimation.configureNext({
      duration: appMotion.standard,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setFilter(nextFilter);
  };

  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;
  const isTablet = width >= 768;

  const openAccount = (account: BankAccount) => {
    const isDeposit = account.type === "fixed-deposit" || account.type === "recurring-deposit";
    router.push({
      pathname: "/(app)/accounts/[accountId]",
      params: {
        accountId: account.id,
        section: isDeposit ? "details" : "transactions",
        source: accountSource(),
      },
    });
  };

  const openAccountAction = (account: BankAccount, action: AccountOverviewAction) => {
    if (action === "transfer") {
      router.push({ pathname: "/(app)/transfer", params: { fromAccountId: account.id } });
      return;
    }
    if (action === "statement") {
      router.push({ pathname: "/(app)/accounts/statements", params: { accountId: account.id } });
      return;
    }
    router.push({
      pathname: "/(app)/accounts/[accountId]",
      params: {
        accountId: account.id,
        section: "details",
        source: accountSource(),
      },
    });
  };

  const toggleBalanceVisibility = () => {
    if (!isBalanceVisibilityHydrated) return;
    void updateBalanceVisibility(undefined, !balanceVisible, { customerId }).catch((caught) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[BALANCE_VISIBILITY] sync failed", caught);
      }
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + appSpacing.xxxl }]}
      >
        <View
          style={[
            styles.contentInner,
            {
              maxWidth: isTablet ? 760 : undefined,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          {isInitialLoading && !loadingTimedOut ? (
            <AccountsSkeletons />
          ) : isInitialLoading && loadingTimedOut ? (
            <StateCard
              actionLabel="Retry"
              description="The banking service did not finish loading. Check your connection and try again."
              iconName="cloud-offline-outline"
              onAction={refreshAccounts}
              title="Accounts data is taking too long"
            />
          ) : (
            <>
              <AccountsScreenHeader
                isRefreshing={isRefreshing}
                onRefresh={refreshAccounts}
              />

              {visibleError && !overview ? (
                <StateCard
                  actionLabel="Retry"
                  description={visibleError}
                  iconName="cloud-offline-outline"
                  onAction={refreshAccounts}
                  title="Couldn’t load your accounts"
                />
              ) : overview && overview.accounts.length === 0 ? (
                <StateCard
                  actionAccessibilityLabel="Link a bank account"
                  actionLabel="Link account"
                  description="Link a bank account to view balances, transactions and financial insights."
                  iconName="add-circle-outline"
                  onAction={() => router.push("/(app)/accounts/add")}
                  title="No linked accounts yet"
                />
              ) : overview ? (
                <>
                  <AccountsBalanceCard
                    availableToSpendMinorUnits={overview.summary.availableToSpendMinorUnits}
                    depositBalanceMinorUnits={overview.summary.depositBalanceMinorUnits}
                    isVisibilityReady={isBalanceVisibilityHydrated}
                    isVisible={effectiveBalanceVisible}
                    onToggleVisibility={toggleBalanceVisibility}
                    totalBalanceMinorUnits={overview.summary.totalBalanceMinorUnits}
                  />

                  {visibleError ? (
                    <View style={styles.staleBanner}>
                      <StatusBanner
                        actionLabel="Retry"
                        iconName="cloud-offline-outline"
                        message={`${visibleError} Showing your latest available information.`}
                        onAction={refreshAccounts}
                        title="Couldn’t refresh your accounts."
                        tone="warning"
                      />
                    </View>
                  ) : null}

                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.filterContent}
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                  >
                    {accountFilters.map((item) => {
                      const selected = item.key === filter;
                      return (
                        <Pressable
                          key={item.key}
                          accessibilityLabel={`Show ${item.label.toLowerCase()} accounts`}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          hitSlop={2}
                          onPress={() => selectFilter(item.key)}
                          style={({ pressed }) => [
                            styles.filterChip,
                            selected && styles.filterChipSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.listSection}>
                    <AccountsListCard
                      accounts={filteredAccounts}
                      isBalanceVisible={effectiveBalanceVisible}
                      onAccountPress={openAccount}
                      onActionPress={openAccountAction}
                      title="Your accounts"
                    />
                    {filteredAccounts.length === 0 ? (
                      <View style={styles.filteredEmptyState}>
                        <StateCard
                          compact
                          description={filter === "deposits"
                            ? "Your fixed and recurring deposits will appear here."
                            : `No ${accountFilters.find((item) => item.key === filter)?.label.toLowerCase() ?? "matching"} accounts are linked.`}
                          title="No accounts in this category"
                        />
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: accountColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: "100%",
    flexGrow: 1,
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
    paddingTop: appSpacing.xxl,
  },
  staleBanner: {
    marginTop: appSpacing.md,
  },
  filterScroll: {
    marginTop: appSpacing.lg,
    marginHorizontal: -appSpacing.xs,
  },
  filterContent: {
    columnGap: appSpacing.sm,
    paddingHorizontal: appSpacing.xs,
  },
  filterChip: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.lg,
    borderRadius: appRadii.round,
    backgroundColor: accountColors.surface,
    borderWidth: 1,
    borderColor: accountColors.border,
  },
  filterChipSelected: {
    backgroundColor: accountColors.brandGreenDark,
    borderColor: accountColors.brandGreenDark,
  },
  filterChipText: {
    color: accountColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: "#FFFFFF",
  },
  listSection: {
    marginTop: appSpacing.md,
  },
  filteredEmptyState: {
    marginTop: appSpacing.xs,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
