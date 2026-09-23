import { useAuth, useUser } from "@clerk/expo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports from local modules
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { StateCard } from "@/components/design-system";
import AccountCarousel from "@/components/home/account-carousel";
import AccountPagination from "@/components/home/account-pagination";
import ActivityCard from "@/components/home/activity-card";
import HomeSkeletons from "@/components/home/home-skeletons";
import QuickActions from "@/components/home/quick-actions";
// import TotalBalanceCard from "@/components/home/total-balance-card";
import WealthCoachCard from "@/components/home/wealth-coach-card";
import { StatusBanner } from "@/components/status-banner";
import {
  demoInsight,
} from "@/data/home-demo-data";
import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import { apiErrorMessage } from "@/lib/api/client";
import { isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useDemoSession } from "@/lib/demo-session";
import { useFinancialData, useTransactions, useWealthSummary } from "@/lib/api/hooks";
import { apiInsightToWealthInsight, apiTransactionToBankingActivity } from "@/lib/api/view-models";
import { useLoadingTimeout } from "@/lib/use-loading-timeout";
import { getAccounts, getRecentActivities } from "@/services/accounts-service";
import type { BankAccount, BankingActivity, WealthInsight } from "@/types/banking";
import { appColors, appSpacing, appTypography } from "@/components/theme/tokens";

export default function HomeScreen() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const remoteAccounts = useFinancialData();
  const remoteTransactions = useTransactions({ limit: 4 });
  const remoteWealth = useWealthSummary();
  const { overview: remoteAccountsOverview, error: remoteAccountsError, isLoading: remoteAccountsLoading, refetch: refetchRemoteAccounts } = remoteAccounts;
  const { data: remoteTransactionsData, error: remoteTransactionsError, isLoading: remoteTransactionsLoading, refetch: refetchRemoteTransactions } = remoteTransactions;
  const { data: remoteWealthData, error: remoteWealthError, refetch: refetchRemoteWealth } = remoteWealth;
  const remoteAuthReady = isFinancialAuthReady(isAuthLoaded, isSignedIn);
  const remoteError = remoteAccountsError ?? remoteTransactionsError ?? remoteWealthError;

  // Screen State
  const [loading, setLoading] = useState(() => isRemoteDataEnabled ? !remoteAccountsOverview : true);
  const [error, setError] = useState(false);
  const [staleError, setStaleError] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [activities, setActivities] = useState<BankingActivity[]>(() => remoteTransactionsData?.items.map(apiTransactionToBankingActivity) ?? []);
  const [insight, setInsight] = useState<WealthInsight | null>(() => remoteWealthData?.insights[0] ? apiInsightToWealthInsight(remoteWealthData.insights[0]) : null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [dataSource, setDataSource] = useState<"remote" | "demo" | null>(() => remoteAccountsOverview ? "remote" : null);
  const [stateCustomerId, setStateCustomerId] = useState(customerId);
  const activeCustomerId = useRef(customerId);
  activeCustomerId.current = customerId;
  const {
    balanceVisible: isBalanceVisible,
    isBalanceVisibilityHydrated,
  } = useBalanceVisibility(customerId, isDemoUserReady);

  // Time-aware greeting
  const [greeting, setGreeting] = useState("Welcome Back");
  const isCurrentCustomer = stateCustomerId === customerId;
  const visibleAccounts = isCurrentCustomer
    ? isRemoteDataEnabled
      ? remoteAccountsOverview?.accounts.map((item) => item.account) ?? []
      : accounts
    : [];
  const visibleActivities = isCurrentCustomer
    ? isRemoteDataEnabled
      ? remoteTransactionsData?.items.map(apiTransactionToBankingActivity) ?? []
      : activities
    : [];
  const visibleInsight = isCurrentCustomer
    ? isRemoteDataEnabled
      ? remoteWealthData?.insights[0] ? apiInsightToWealthInsight(remoteWealthData.insights[0]) : null
      : insight
    : null;
  const visibleLoading = !isCurrentCustomer || loading;
  const visibleError = isCurrentCustomer && error;
  const visibleStaleError = isCurrentCustomer && staleError;
  const visibleDataSource = isCurrentCustomer ? dataSource : null;
  const visibleErrorMessage = visibleError
    ? apiErrorMessage(remoteError, remoteAccountsError ? "Account information" : "Financial information")
    : null;

  // Determine display name following user requirements priority
  const displayName = (() => {
    if (!isUserLoaded || !user) return demoSession?.displayName.split(" ")[0] ?? "Customer";
    if (user.firstName) return user.firstName;
    if (user.fullName) return user.fullName;
    if (user.primaryEmailAddress?.emailAddress) {
      return user.primaryEmailAddress.emailAddress.split("@")[0];
    }
    return "Customer";
  })();

  // Determine time-aware greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
    } else if (hour >= 17 && hour < 22) {
      setGreeting("Good Evening");
    } else {
      setGreeting("Welcome Back");
    }
  }, []);

  useEffect(() => {
    setCarouselIndex(0);
  }, [customerId]);

  useEffect(() => {
    if (stateCustomerId === customerId) return;
    setAccounts([]);
    setActivities([]);
    setInsight(null);
    setDataSource(null);
    setError(false);
    setStaleError(false);
    setLoading(true);
  }, [customerId, stateCustomerId]);

  const loadDemoData = useCallback(async () => {
    const requestedCustomerId = customerId;
    const [nextAccounts, nextActivities] = await Promise.all([
      getAccounts({ customerId }),
      getRecentActivities({ customerId }),
    ]);
    if (activeCustomerId.current !== requestedCustomerId) return false;
    setAccounts(nextAccounts);
    setActivities(nextActivities);
    setInsight(customerId === DEMO_CUSTOMER_B || customerId.includes("customer-b") ? null : demoInsight);
    setStateCustomerId(requestedCustomerId);
    return true;
  }, [customerId]);

  const loadData = useCallback(async () => {
    if (!isDemoUserReady || isRemoteDataEnabled) return;
    setLoading(true);
    setError(false);
    setDataSource(null);
    try {
      const loadedCurrentCustomer = await loadDemoData();
      if (!loadedCurrentCustomer) return;
      setDataSource("demo");
      setLoading(false);
    } catch {
      if (activeCustomerId.current !== customerId) return;
      setStateCustomerId(customerId);
      setError(true);
      setLoading(false);
    }
  }, [customerId, isDemoUserReady, loadDemoData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isRemoteDataEnabled) return;
    if (!remoteAuthReady) {
      setLoading(!isAuthLoaded || !remoteAuthReady);
      setError(false);
      setStaleError(false);
      return;
    }
    if (remoteAccountsOverview?.accounts) {
      setDataSource("remote");
      setStateCustomerId(customerId);
    }
    const hasUsableAccounts = Boolean(remoteAccountsOverview?.accounts?.length);
    const hasCriticalRemoteFailure = Boolean(remoteAccountsError || remoteTransactionsError);
    const hasRemoteFailure = Boolean(hasCriticalRemoteFailure || remoteWealthError);
    if (remoteAccountsError && !remoteAccountsLoading && !hasUsableAccounts) {
      setAccounts([]);
      setActivities([]);
      setInsight(null);
      setDataSource(null);
      setStateCustomerId(customerId);
    }
    setLoading((remoteAccountsLoading || remoteTransactionsLoading) && !hasUsableAccounts);
    setError(hasCriticalRemoteFailure && !hasUsableAccounts);
    setStaleError(hasRemoteFailure && hasUsableAccounts);
  }, [
    customerId,
    remoteAccountsOverview,
    remoteAccountsError,
    remoteAccountsLoading,
    remoteAuthReady,
    isAuthLoaded,
    remoteTransactionsData,
    remoteTransactionsError,
    remoteTransactionsLoading,
    remoteWealthData,
    remoteWealthError,
  ]);

  const isInitialLoading = visibleLoading || !isBalanceVisibilityHydrated;
  const { timedOut: loadingTimedOut, reset: resetLoadingTimeout } = useLoadingTimeout(isInitialLoading);

  const handleRetry = () => {
    resetLoadingTimeout();
    if (!isRemoteDataEnabled) {
      void loadData();
      return;
    }
    void Promise.all([refetchRemoteAccounts(), refetchRemoteTransactions(), refetchRemoteWealth()]);
  };



  // Calculate total balance across loaded accounts (Archived for now)
  // const totalBalance = accounts.reduce(
  //   (sum, acc) => sum + acc.availableBalance,
  //   0
  // );

  // Responsive breakpoints adjustments
  const isSmall = width < 375;
  const isTablet = width >= 768;

  const contentMaxWidth = isTablet ? 720 : "100%";
  const horizontalPadding = isSmall ? 16 : 20;
  const greetingFontSize = isSmall ? 27 : appTypography.pageTitle.fontSize;
  const greetingLineHeight = isSmall ? 34 : appTypography.pageTitle.lineHeight;

  // Calculate bottom padding taking the absolute tab bar height into account
  const tabHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });
  const bottomPadding = 32 + tabHeight;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: bottomPadding,
            maxWidth: contentMaxWidth,
          },
        ]}
      >
        {isInitialLoading && !loadingTimedOut ? (
          <HomeSkeletons />
        ) : isInitialLoading && loadingTimedOut ? (
          <StateCard
            actionLabel="Retry"
            description={!remoteAuthReady ? "Your secure session is still loading. Please try again in a moment." : "The banking service did not finish loading. Check your connection and try again."}
            onAction={handleRetry}
            style={[styles.screenState, { marginHorizontal: horizontalPadding }]}
            title="Home data is taking too long"
          />
        ) : visibleError && visibleAccounts.length === 0 ? (
          <StateCard
            actionAccessibilityLabel="Retry loading accounts data"
            actionLabel="Retry"
            description={visibleErrorMessage ?? "Account information is temporarily unavailable. Please try again."}
            onAction={handleRetry}
            style={[styles.screenState, { marginHorizontal: horizontalPadding }]}
            title="We couldn’t load your accounts."
          />
        ) : visibleAccounts.length === 0 ? (
          <StateCard
            description="Your linked banking accounts will appear here."
            style={[styles.screenState, { marginHorizontal: horizontalPadding }]}
            title="No linked accounts"
          />
        ) : (
          <View style={styles.composedContent}>
            {visibleDataSource === "demo" || visibleStaleError ? (
              <HomeDataNotice demo={visibleDataSource === "demo"} onRetry={handleRetry} stale={visibleStaleError} />
            ) : null}

            {/* Time-Aware Greeting */}
            <View style={{ paddingHorizontal: horizontalPadding }}>
              <Text
                style={[
                  styles.greeting,
                  { fontSize: greetingFontSize, lineHeight: greetingLineHeight },
                ]}
                accessibilityRole="header"
              >
                {greeting}, {displayName}
              </Text>
            </View>

            {/* Account Card Carousel (Full Width) */}
            <View style={styles.carouselSection}>
              <AccountCarousel
                accounts={visibleAccounts}
                activeIndex={carouselIndex}
                onIndexChange={setCarouselIndex}
                isBalanceVisible={isBalanceVisible}
              />
              <AccountPagination
                total={visibleAccounts.length}
                activeIndex={carouselIndex}
                onDotPress={setCarouselIndex}
              />
            </View>

            {/* Rest of the Content Sections (Padded) */}
            <View style={{ paddingHorizontal: horizontalPadding }}>
              {/* Quick Actions */}
              <View style={styles.quickActionsSection}>
                <QuickActions />
              </View>

              {/* Total Balance Card (Archived for now) */}
              {/* <View style={styles.balanceSection}>
                <TotalBalanceCard balance={totalBalance} />
              </View> */}

              {/* Wealth Coach Insight Card */}
              {visibleInsight && (
                <View style={styles.coachSection}>
                  <WealthCoachCard insight={visibleInsight} balanceVisible={isBalanceVisible} />
                </View>
              )}

              {/* Recent Activity Card */}
              <View style={styles.activitySection}>
                <ActivityCard activities={visibleActivities} balanceVisible={isBalanceVisible} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HomeDataNotice({ demo = false, onRetry, stale = false }: { demo?: boolean; onRetry: () => void; stale?: boolean }) {
  return (
    <View style={styles.dataNotice}>
      <StatusBanner
        size="prominent"
        message={demo ? "This screen is using the explicitly selected demo dataset." : stale ? "Couldn’t refresh banking data. Showing your last available information." : "Your live banking data is temporarily unavailable."}
        actionLabel={demo ? undefined : "Retry"}
        actionAccessibilityLabel="Retry loading live banking data"
        onAction={demo ? undefined : onRetry}
        title={demo ? "Demo data enabled" : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    width: "100%",
    alignSelf: "center",
    paddingTop: appSpacing.xxl,
  },
  composedContent: {
    width: "100%",
  },
  dataNotice: {
    marginHorizontal: 20,
    marginBottom: appSpacing.lg,
  },
  greeting: {
    color: appColors.textPrimary,
    fontWeight: appTypography.pageTitle.fontWeight,
    marginBottom: appSpacing.xxl,
  },
  carouselSection: {
    // Greeting to account card: 24, compact card-to-dots spacing, dots to quick actions: 28
    marginBottom: 28,
  },
  quickActionsSection: {
    // Dots to quick actions: 28 (satisfied above), Quick actions to balance card: 30
    marginBottom: 30,
  },
  balanceSection: {
    // Balance card to coach card: 20
    marginBottom: 20,
  },
  coachSection: {
    // Coach card to activity card: 20
    marginBottom: 20,
  },
  activitySection: {
    // Activity card to bottom content padding: 32 (satisfied by bottomPadding on scrollContent)
  },
  screenState: {
    marginTop: 40,
  },
});
