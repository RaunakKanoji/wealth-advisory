import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrivateAmount } from "@/components/accounts/private-amount";
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { StateCard } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { useFinancialData } from "@/lib/api/hooks";
import { isRemoteDataEnabled } from "@/lib/env";
import { getAccountsOverview } from "@/services/accounts-service";
import type { AccountsOverview } from "@/types/banking";

import { accountColors } from "./tokens";

type AccountActionScreenProps = {
  title: string;
  description: string;
  actionLabel?: string;
  allowAccountSelection?: boolean;
};

const ALL_ACCOUNTS_ID = "all-accounts";

function getAccountId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AccountActionScreen({
  title,
  description,
  actionLabel = "Go Back",
  allowAccountSelection = false,
}: AccountActionScreenProps) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { accountId: rawAccountId } = useLocalSearchParams<{
    accountId?: string | string[];
  }>();
  const accountId = getAccountId(rawAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const shouldLoadAccounts = allowAccountSelection || Boolean(accountId);
  const remoteAccounts = useFinancialData(shouldLoadAccounts);
  const [localOverview, setLocalOverview] = useState<AccountsOverview | null>(null);
  const [localOverviewCustomerId, setLocalOverviewCustomerId] = useState(customerId);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(
    allowAccountSelection ? accountId ?? ALL_ACCOUNTS_ID : accountId,
  );
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);

  useEffect(() => {
    setSelectedAccountId(allowAccountSelection ? accountId ?? ALL_ACCOUNTS_ID : accountId);
    setIsAccountMenuOpen(false);
  }, [accountId, allowAccountSelection]);

  useEffect(() => {
    if (isRemoteDataEnabled || !shouldLoadAccounts || !isUserLoaded) return;
    let active = true;
    setLocalIsLoading(true);
    setLocalError(null);
    void getAccountsOverview({ customerId })
      .then((nextOverview) => {
        if (active) {
          setLocalOverview(nextOverview);
          setLocalOverviewCustomerId(customerId);
        }
      })
      .catch(() => {
        if (active) setLocalError("Account information is temporarily unavailable.");
      })
      .finally(() => {
        if (active) setLocalIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId, isUserLoaded, localReloadKey, shouldLoadAccounts]);

  const currentLocalOverview = localOverviewCustomerId === customerId ? localOverview : null;
  const overview = isRemoteDataEnabled ? remoteAccounts.overview : currentLocalOverview;
  const accounts = overview?.accounts ?? [];
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId);
  const selectionUnavailable = Boolean(
    selectedAccountId && selectedAccountId !== ALL_ACCOUNTS_ID && !selectedAccount,
  );
  const isLoadingAccounts = shouldLoadAccounts && (isRemoteDataEnabled
    ? remoteAccounts.isLoading && !remoteAccounts.overview
    : (!isUserLoaded || localIsLoading || localOverviewCustomerId !== customerId) && !currentLocalOverview);
  const accountsError = isRemoteDataEnabled
    ? remoteAccounts.error instanceof Error
      ? remoteAccounts.error.message
      : remoteAccounts.error
        ? "Account information is temporarily unavailable."
        : null
    : localError;
  const showAccountSummary = Boolean(overview) && (
    allowAccountSelection || Boolean(selectedAccount) || selectionUnavailable
  );
  const summaryName = selectedAccount?.displayName
    ?? (selectedAccountId === ALL_ACCOUNTS_ID ? "All accounts" : "Account unavailable");
  const summaryNumber = selectedAccount
    ? `Account ending in ${selectedAccount.lastFour}`
    : selectedAccountId === ALL_ACCOUNTS_ID
      ? `${overview?.summary.accountCount ?? 0} linked accounts`
      : "This account is not available for the signed-in customer";
  const summaryBalanceMinorUnits = selectedAccount?.mainBalanceMinorUnits
    ?? (selectedAccountId === ALL_ACCOUNTS_ID
      ? overview?.summary.totalBalanceMinorUnits ?? null
      : null);

  const selectAccount = (nextAccountId: string) => {
    setSelectedAccountId(nextAccountId);
    setIsAccountMenuOpen(false);
  };

  const retryAccounts = () => {
    if (isRemoteDataEnabled) {
      void remoteAccounts.refetch();
    } else {
      setLocalReloadKey((value) => value + 1);
    }
  };

  return (
    <ScreenContainer
      scroll
      edges={["top", "bottom"]}
      backgroundColor={accountColors.background}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={accountColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
          {isLoadingAccounts ? (
            <View accessible accessibilityLabel="Loading linked accounts" style={styles.loadingAccounts}>
              <Text style={styles.loadingAccountsText}>Loading linked accounts…</Text>
            </View>
          ) : accountsError && !overview ? (
            <StateCard
              actionLabel="Retry"
              compact
              description={accountsError}
              onAction={retryAccounts}
              style={styles.accountsState}
              title="Accounts unavailable"
            />
          ) : overview && allowAccountSelection && accounts.length === 0 ? (
            <StateCard
              compact
              description="Link a bank account before requesting statements."
              style={styles.accountsState}
              title="No linked accounts"
            />
          ) : (
            <>
              {allowAccountSelection ? (
                <View style={styles.selectorSection}>
                  <Text style={styles.selectorLabel}>Show statements for</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select account. Currently ${summaryName}`}
                    accessibilityState={{ expanded: isAccountMenuOpen }}
                    onPress={() => setIsAccountMenuOpen((open) => !open)}
                    style={({ pressed }) => [
                      styles.selectorButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.selectorTextColumn}>
                      <Text style={styles.selectorValue}>{summaryName}</Text>
                      <Text style={styles.selectorSubtext}>{summaryNumber}</Text>
                    </View>
                    <Ionicons
                      name={isAccountMenuOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={accountColors.textSecondary}
                    />
                  </Pressable>

                  {isAccountMenuOpen ? (
                    <View style={styles.accountOptions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Show statements for all accounts"
                        accessibilityState={{ selected: selectedAccountId === ALL_ACCOUNTS_ID }}
                        onPress={() => selectAccount(ALL_ACCOUNTS_ID)}
                        style={({ pressed }) => [
                          styles.accountOption,
                          selectedAccountId === ALL_ACCOUNTS_ID && styles.selectedAccountOption,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.accountOptionText}>All accounts</Text>
                        <Text style={styles.accountOptionSubtext}>
                          {overview?.summary.accountCount ?? 0} linked accounts
                        </Text>
                      </Pressable>
                      {accounts.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Show statements for ${item.displayName}`}
                          accessibilityState={{ selected: item.id === selectedAccountId }}
                          onPress={() => selectAccount(item.id)}
                          style={({ pressed }) => [
                            styles.accountOption,
                            item.id === selectedAccountId && styles.selectedAccountOption,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.accountOptionText}>{item.displayName}</Text>
                          <Text style={styles.accountOptionSubtext}>
                            Account ending in {item.lastFour}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {showAccountSummary ? (
                <View style={styles.accountSummary}>
                  <Text style={styles.accountName}>{summaryName}</Text>
                  <Text style={styles.accountNumber}>{summaryNumber}</Text>
                  <PrivateAmount
                    amountMinorUnits={summaryBalanceMinorUnits}
                    unavailableLabel="Balance unavailable"
                    visible={isBalanceVisibilityHydrated && balanceVisible}
                    style={styles.accountBalance}
                  />
                </View>
              ) : null}
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  backText: {
    marginLeft: 4,
    color: accountColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    marginTop: 24,
    padding: 24,
    borderRadius: 24,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    color: accountColors.textPrimary,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
  },
  description: {
    marginTop: 10,
    color: accountColors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  loadingAccounts: {
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: accountColors.background,
  },
  loadingAccountsText: {
    color: accountColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  accountsState: {
    marginTop: 20,
  },
  selectorSection: {
    marginTop: 24,
  },
  selectorLabel: {
    marginBottom: 8,
    color: accountColors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  selectorButton: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: accountColors.background,
    borderWidth: 1,
    borderColor: accountColors.border,
  },
  selectorTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  selectorValue: {
    color: accountColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  selectorSubtext: {
    marginTop: 3,
    color: accountColors.textSecondary,
    fontSize: 13,
  },
  accountOptions: {
    marginTop: 8,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: accountColors.background,
    borderWidth: 1,
    borderColor: accountColors.border,
  },
  accountOption: {
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: accountColors.border,
  },
  selectedAccountOption: {
    backgroundColor: accountColors.brandGreenSoft,
  },
  accountOptionText: {
    color: accountColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  accountOptionSubtext: {
    marginTop: 2,
    color: accountColors.textSecondary,
    fontSize: 13,
  },
  accountSummary: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: accountColors.brandGreenSoft,
  },
  accountName: {
    color: accountColors.brandGreenDark,
    fontSize: 17,
    fontWeight: "700",
  },
  accountNumber: {
    marginTop: 5,
    color: accountColors.textSecondary,
    fontSize: 14,
  },
  accountBalance: {
    marginTop: 12,
    color: accountColors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  actionButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: accountColors.brandGreenDark,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.78,
  },
});
