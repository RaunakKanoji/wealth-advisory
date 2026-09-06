import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
  AccountsListCard,
  AccountsScreenHeader,
  AccountsSkeletons,
} from "@/components/accounts";
import { accountColors, softCardShadow } from "@/components/accounts/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { getAccounts } from "@/services/accounts-service";
import type { AccountListFilter } from "@/services/accounts-service";
import type { BankAccount } from "@/types/banking";

const accountFilters: { key: AccountListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "savings", label: "Savings" },
  { key: "current", label: "Current" },
  { key: "deposits", label: "Deposits" },
];

export default function AccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [filter, setFilter] = useState<AccountListFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const hasLoaded = useRef(false);

  const loadAccounts = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const nextAccounts = await getAccounts({ customerId });
        setAccounts(nextAccounts);
        hasLoaded.current = true;
      } catch {
        setError("We couldn’t load your accounts. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [customerId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadAccounts(!hasLoaded.current);
    }, [loadAccounts]),
  );

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => {
      if (filter === "deposits") {
        return account.type === "fixed-deposit" || account.type === "recurring-deposit";
      }
      return filter === "all" || account.type === filter;
    }),
    [accounts, filter],
  );

  const paymentBalanceMinorUnits = useMemo(
    () => accounts
      .filter((account) => account.type !== "fixed-deposit" && account.type !== "recurring-deposit")
      .reduce((total, account) => total + (account.availableBalanceMinorUnits ?? account.balanceMinorUnits), 0),
    [accounts],
  );
  const depositBalanceMinorUnits = useMemo(
    () => accounts
      .filter((account) => account.type === "fixed-deposit" || account.type === "recurring-deposit")
      .reduce((total, account) => total + account.balanceMinorUnits, 0),
    [accounts],
  );
  const lastUpdated = accounts
    .map((account) => account.lastSuccessfulUpdate)
    .sort()
    .at(-1);

  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });

  const openAccount = (account: BankAccount) => {
    router.push({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId: account.id, section: "transactions" },
    });
  };

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
              maxWidth: isTablet ? 760 : undefined,
              paddingHorizontal: horizontalPadding,
              paddingBottom: 32 + tabBarHeight,
            },
          ]}
        >
          <AccountsScreenHeader
            accountCount={accounts.length}
            lastUpdated={lastUpdated ? formatDate(lastUpdated) : undefined}
            isRefreshing={isRefreshing}
            onRefresh={() => void loadAccounts(false)}
          />

          {isLoading || !isUserLoaded ? (
            <AccountsSkeletons />
          ) : error && accounts.length === 0 ? (
            <StateCard
              title="Accounts unavailable"
              description={error}
              actionLabel="Retry"
              onAction={() => void loadAccounts(true)}
            />
          ) : accounts.length === 0 ? (
            <StateCard
              title="No accounts found"
              description="No eligible demo accounts are linked to this customer."
            />
          ) : (
            <>
              {error ? (
                <View style={styles.staleBanner} accessibilityRole="alert">
                  <Ionicons name="cloud-offline-outline" size={18} color="#8A5A10" />
                  <Text style={styles.staleText}>{error} Showing the last successful data.</Text>
                </View>
              ) : null}

              <BalanceSummaryCard
                paymentBalanceMinorUnits={paymentBalanceMinorUnits}
                depositBalanceMinorUnits={depositBalanceMinorUnits}
                accountCount={accounts.length}
                isVisible={isBalanceVisible}
                onToggleVisibility={() => setIsBalanceVisible((visible) => !visible)}
              />

              <View style={styles.freshnessRow}>
                <Text style={styles.sourceLabel}>{accounts[0]?.sourceEnvironment}</Text>
                <Text style={styles.freshnessLabel}>
                  {lastUpdated ? `Updated ${formatDate(lastUpdated)}` : "Updated time unavailable"}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
                style={styles.filterScroll}
              >
                {accountFilters.map((item) => {
                  const selected = item.key === filter;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${item.label.toLowerCase()} accounts`}
                      accessibilityState={{ selected }}
                      onPress={() => setFilter(item.key)}
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

              {filteredAccounts.length === 0 ? (
                <StateCard
                  title="No matching accounts"
                  description="Try another account filter to see your linked products."
                  compact
                />
              ) : (
                <View style={styles.listGap}>
                  <AccountsListCard
                    accounts={filteredAccounts}
                    title={filter === "all" ? "Your accounts" : accountFilters.find((item) => item.key === filter)?.label ?? "Accounts"}
                    onAccountPress={openAccount}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BalanceSummaryCard({
  paymentBalanceMinorUnits,
  depositBalanceMinorUnits,
  accountCount,
  isVisible,
  onToggleVisibility,
}: {
  paymentBalanceMinorUnits: number;
  depositBalanceMinorUnits: number;
  accountCount: number;
  isVisible: boolean;
  onToggleVisibility: () => void;
}) {
  const totalMinorUnits = paymentBalanceMinorUnits + depositBalanceMinorUnits;
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryEyebrow}>Reported balances</Text>
          <Text style={styles.summaryTitle}>{accountCount} linked accounts</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isVisible ? "Hide account balances" : "Show account balances"}
          onPress={onToggleVisibility}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
        >
          <Ionicons name={isVisible ? "eye-outline" : "eye-off-outline"} size={20} color="#687386" />
        </Pressable>
      </View>
      <View style={styles.totalBalanceRow}>
        <Text style={styles.totalLabel}>Combined reported balance</Text>
        <Text style={styles.totalValue}>
          {isVisible ? formatIndianMinorUnits(totalMinorUnits) : "₹ ••••••••"}
        </Text>
      </View>
      <View style={styles.breakdownRow}>
        <BalanceBreakdown
          label="Payment accounts"
          value={paymentBalanceMinorUnits}
          isVisible={isVisible}
        />
        <BalanceBreakdown
          label="Deposits"
          value={depositBalanceMinorUnits}
          isVisible={isVisible}
        />
      </View>
      <Text style={styles.summaryNote}>
        Payment accounts are the only category shown as available to spend. Deposits are not immediately available.
      </Text>
    </View>
  );
}

function BalanceBreakdown({ label, value, isVisible }: { label: string; value: number; isVisible: boolean }) {
  return (
    <View style={styles.breakdownItem}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{isVisible ? formatIndianMinorUnits(value) : "₹ •••••"}</Text>
    </View>
  );
}

function StateCard({
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.stateCard, compact && styles.compactStateCard]}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: accountColors.background,
  },
  scrollContent: {
    width: "100%",
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 24,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    ...softCardShadow,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    color: accountColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  summaryTitle: {
    marginTop: 2,
    color: accountColors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  totalBalanceRow: {
    marginTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: accountColors.divider,
  },
  totalLabel: {
    color: accountColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  totalValue: {
    marginTop: 3,
    color: accountColors.textPrimary,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "700",
  },
  breakdownRow: {
    flexDirection: "row",
    columnGap: 16,
    marginTop: 16,
  },
  breakdownItem: {
    flex: 1,
    minWidth: 0,
  },
  breakdownLabel: {
    color: accountColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  breakdownValue: {
    marginTop: 4,
    color: accountColors.brandGreenDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  summaryNote: {
    marginTop: 15,
    color: accountColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  freshnessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 11,
    paddingHorizontal: 2,
  },
  sourceLabel: {
    color: accountColors.brandGreenDark,
    fontSize: 12,
    fontWeight: "700",
  },
  freshnessLabel: {
    color: accountColors.textSecondary,
    fontSize: 12,
  },
  filterScroll: {
    marginTop: 19,
    marginHorizontal: -4,
  },
  filterContent: {
    columnGap: 8,
    paddingHorizontal: 4,
  },
  filterChip: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 20,
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
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: "#FFFFFF",
  },
  listGap: {
    marginTop: 24,
  },
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFF4D8",
  },
  staleText: {
    flex: 1,
    color: "#73500D",
    fontSize: 12,
    lineHeight: 17,
  },
  stateCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 22,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
  },
  compactStateCard: {
    marginTop: 24,
  },
  stateTitle: {
    color: accountColors.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    textAlign: "center",
  },
  stateDescription: {
    maxWidth: 320,
    marginTop: 8,
    color: accountColors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    marginTop: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: accountColors.brandGreenDark,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
  },
});
