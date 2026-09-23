import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TransactionRow } from "@/components/accounts/transaction-row";
import { accountColors, softCardShadow } from "@/components/accounts/tokens";
import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { IconButton } from "@/components/design-system";
import { appTypography } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate, formatMaturityDate } from "@/lib/date";
import { apiRequest } from "@/lib/api/client";
import type { ApiAccount, ApiTransaction, TransactionsResponse } from "@/lib/api/types";
import { isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useStableGetToken } from "@/lib/api/use-stable-get-token";
import { apiAccountToBankAccount, parseApiMoneyToMinorUnits } from "@/lib/api/view-models";
import { useLoadingTimeout } from "@/lib/use-loading-timeout";
import {
  createTransactionCsv,
  getAccount,
  getAccountDocuments,
  getAccountTransactions,
  getAccounts,
  TRANSACTION_CATEGORIES,
  TRANSACTION_CHANNELS,
  TRANSACTION_STATUSES,
  updateAccountPreference,
  updateBalanceVisibility,
} from "@/services/accounts-service";
import type { AccountDocument, TransactionFilters } from "@/services/accounts-service";
import type {
  AccountTransaction,
  BankAccount,
  TransactionCategory,
} from "@/types/banking";

type DetailsSection = "transactions" | "details" | "documents";
type LoadState = "loading" | "ready" | "error";

const HIDDEN_AMOUNT = "₹••••••••";

const sections: { key: DetailsSection; label: string }[] = [
  { key: "transactions", label: "Transactions" },
  { key: "details", label: "Details" },
  { key: "documents", label: "Documents" },
];

const initialFilters: TransactionFilters = {
  period: "this-month",
  direction: "all",
  category: "all",
  status: "all",
  channel: "all",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDeposit(account: BankAccount) {
  return account.type === "fixed-deposit" || account.type === "recurring-deposit";
}

function accountTypeLabel(account: BankAccount) {
  switch (account.type) {
    case "fixed-deposit":
      return "Fixed deposit";
    case "recurring-deposit":
      return "Recurring deposit";
    case "current":
      return "Current account";
    case "salary":
      return "Salary account";
    case "savings":
    default:
      return "Savings account";
  }
}

function accountIcon(account: BankAccount): React.ComponentProps<typeof Ionicons>["name"] {
  switch (account.type) {
    case "fixed-deposit":
      return "lock-closed-outline";
    case "recurring-deposit":
      return "calendar-outline";
    case "current":
      return "briefcase-outline";
    case "salary":
    case "savings":
    default:
      return "wallet-outline";
  }
}

function privateAmount(amountMinorUnits: number | undefined, isBalanceVisible: boolean) {
  if (amountMinorUnits === undefined) return undefined;
  return isBalanceVisible ? formatIndianMinorUnits(amountMinorUnits) : HIDDEN_AMOUNT;
}

function primaryAccountMetric(account: BankAccount): { label: string; amountMinorUnits?: number } {
  if (account.type === "fixed-deposit") {
    if (account.fixedDeposit?.reportedCurrentValue) {
      return { label: "Current value", amountMinorUnits: account.fixedDeposit.reportedCurrentValue.minorUnits };
    }
    if (account.fixedDeposit?.principal) {
      return { label: "Deposit value", amountMinorUnits: account.fixedDeposit.principal.minorUnits };
    }
    return {
      label: "Current value",
      amountMinorUnits: account.balanceDataAvailable === false ? undefined : account.ledgerBalanceMinorUnits,
    };
  }

  if (account.type === "recurring-deposit") {
    return {
      label: "Current value",
      amountMinorUnits: account.recurringDeposit?.reportedBalance.minorUnits
        ?? (account.balanceDataAvailable === false ? undefined : account.ledgerBalanceMinorUnits),
    };
  }

  if (account.availableBalanceMinorUnits !== undefined) {
    return { label: "Available balance", amountMinorUnits: account.availableBalanceMinorUnits };
  }

  return {
    label: "Current balance",
    amountMinorUnits: account.balanceDataAvailable === false ? undefined : account.ledgerBalanceMinorUnits,
  };
}

function accountStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function transactionCategoryLabel(category: string) {
  if (category === "bill") return "Bills";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function sectionFromParam(value: string | undefined): DetailsSection {
  return sections.some((item) => item.key === value) ? value as DetailsSection : "transactions";
}

export function AccountDetailsScreen() {
  const { user } = useUser();
  const { accountId: rawAccountId } = useLocalSearchParams<{
    accountId?: string | string[];
  }>();
  const accountId = firstParam(rawAccountId) ?? "missing-account";
  const customerKey = user?.id ?? DEMO_CUSTOMER_A;
  // A URL parameter must never switch a live-data session to local fixtures.
  return isRemoteDataEnabled
    ? <RemoteAccountDetailsScreen key={`${customerKey}:${accountId}`} />
    : <LocalAccountDetailsScreen key={`${customerKey}:${accountId}`} />;
}

function remoteTransactionCategory(value: string | null): TransactionCategory {
  if (value === "food_dining") return "food";
  if (value === "utilities") return "bill";
  return value && TRANSACTION_CATEGORIES.includes(value as TransactionCategory) ? value as TransactionCategory : "other";
}

function remoteTransactionStatus(value: string): AccountTransaction["status"] {
  if (value === "failed") return "failed";
  if (value === "reversed") return "reversed";
  if (value === "pending") return "pending";
  return "posted";
}

function remoteTransactionToAccountTransaction(transaction: ApiTransaction): AccountTransaction {
  const date = new Date(transaction.transactionAt);
  const transactionDate = Number.isNaN(date.valueOf()) ? transaction.transactionAt.slice(0, 10) : date.toISOString().slice(0, 10);
  const status = remoteTransactionStatus(transaction.status);
  const category = remoteTransactionCategory(transaction.category);
  return {
    id: transaction.id,
    sourceTransactionId: transaction.id,
    accountId: transaction.accountId,
    amountMinorUnits: parseApiMoneyToMinorUnits(transaction.amount),
    currency: "INR",
    direction: transaction.direction,
    status,
    transactionDate,
    postedDate: status === "posted" ? transactionDate : undefined,
    valueDate: transactionDate,
    transactionTime: Number.isNaN(date.valueOf()) ? undefined : date.toISOString(),
    counterparty: transaction.merchantName ?? undefined,
    description: transaction.description,
    bankDescription: transaction.description,
    reference: transaction.reference ?? undefined,
    originalCategory: category,
    sourceEnvironment: transaction.metadata.source === "account_aggregator" && typeof transaction.metadata.provider === "string"
      ? `Account Aggregator · ${transaction.metadata.provider}`
      : "Bank API",
  };
}

function RemoteAccountDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken: clerkGetToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const { accountId: rawAccountId, section: rawSection } = useLocalSearchParams<{
    accountId?: string | string[];
    section?: string | string[];
  }>();
  const accountId = firstParam(rawAccountId);
  const routeSection = firstParam(rawSection);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [activeSection, setActiveSection] = useState<Exclude<DetailsSection, "documents">>(() => sectionFromParam(routeSection) === "details" ? "details" : "transactions");
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stateCustomerId, setStateCustomerId] = useState(customerId);
  const accountRef = useRef<BankAccount | null>(null);
  const activeCustomerId = useRef(customerId);
  const loadRequestId = useRef(0);
  activeCustomerId.current = customerId;
  const isCurrentCustomer = stateCustomerId === customerId;
  const visibleAccount = isCurrentCustomer ? account : null;
  const visibleTransactions = isCurrentCustomer ? transactions : [];
  const visibleError = isCurrentCustomer ? error : null;
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);

  const load = useCallback(async (quiet = false) => {
    const requestedCustomerId = customerId;
    const requestId = ++loadRequestId.current;
    if (!accountId) {
      setAccount(null);
      setTransactions([]);
      setStateCustomerId(requestedCustomerId);
      setState("error");
      setError("This account link is missing an account ID.");
      return;
    }
    if (!isUserLoaded || !isAuthLoaded) return;
    if (!isFinancialAuthReady(isAuthLoaded, isSignedIn)) {
      setState("error");
      setError("Please sign in again to view this account.");
      return;
    }
    if (!quiet) {
      accountRef.current = null;
      setAccount(null);
      setTransactions([]);
    }
    if (!quiet || !accountRef.current) setState("loading");
    setError(null);
    try {
      const [accountResponse, transactionResponse] = await Promise.all([
        apiRequest<ApiAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}`, { getToken }),
        apiRequest<TransactionsResponse>(`/api/v1/accounts/${encodeURIComponent(accountId)}/transactions?limit=50`, { getToken }),
      ]);
      if (activeCustomerId.current !== requestedCustomerId || loadRequestId.current !== requestId) return;
      const nextAccount = apiAccountToBankAccount(accountResponse);
      accountRef.current = nextAccount;
      setAccount(nextAccount);
      setTransactions(transactionResponse.items.map(remoteTransactionToAccountTransaction));
      setStateCustomerId(requestedCustomerId);
      setState("ready");
    } catch (caught) {
      if (activeCustomerId.current !== requestedCustomerId || loadRequestId.current !== requestId) return;
      if (!quiet || !accountRef.current) {
        accountRef.current = null;
        setAccount(null);
        setTransactions([]);
      }
      setStateCustomerId(requestedCustomerId);
      if (!quiet || !accountRef.current) setState("error");
      setError(caught instanceof Error ? caught.message : "This account could not be loaded.");
    }
  }, [accountId, customerId, getToken, isAuthLoaded, isSignedIn, isUserLoaded]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setActiveSection(sectionFromParam(routeSection) === "details" ? "details" : "transactions");
  }, [routeSection]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const isLoading = !isUserLoaded || !isAuthLoaded || !isBalanceVisibilityHydrated || !isCurrentCustomer || state === "loading";
  const { timedOut: loadingTimedOut, reset: resetLoadingTimeout } = useLoadingTimeout(isLoading);
  const retryAfterLoadingTimeout = useCallback(async () => {
    resetLoadingTimeout();
    await load();
  }, [load, resetLoadingTimeout]);

  const tabBarHeight = Platform.select({ ios: 72 + insets.bottom, android: 66 + Math.max(insets.bottom, 10), default: 76 });
  const horizontalPadding = width < 375 ? 16 : 20;
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/accounts");
  const openStatement = (selectedAccount: BankAccount) => router.push({
    pathname: "/(app)/accounts/statements",
    params: { accountId: selectedAccount.id },
  });
  const toggleRemoteBalanceVisibility = () => {
    const nextVisible = !balanceVisible;
    void updateBalanceVisibility(undefined, nextVisible, { customerId }).catch((caught) => {
      if (process.env.NODE_ENV !== "production") console.warn("[BALANCE_VISIBILITY] sync failed", caught);
    });
  };
  if (isLoading && !loadingTimedOut) return <LoadingScreen />;
  if (isLoading && loadingTimedOut) {
    return (
      <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void retryAfterLoadingTimeout()}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <StateCard
            title="Account data is taking too long"
            description="The banking service did not finish loading. Check your connection and try again."
            actionLabel="Retry"
            onAction={() => void retryAfterLoadingTimeout()}
          />
        </View>
      </ScreenShell>
    );
  }
  if (state === "error" || !visibleAccount) {
    return (
      <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void refresh()}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to accounts" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <StateCard title="Account unavailable" description={visibleError ?? "This account could not be found."} actionLabel="Retry" onAction={() => void load()} />
        </View>
      </ScreenShell>
    );
  }

  const depositActionLabel = visibleAccount.type === "recurring-deposit" ? "Schedule" : "Maturity";
  return (
    <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to accounts" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <AccountSummary account={visibleAccount} isBalanceVisible={balanceVisible} onToggleVisibility={toggleRemoteBalanceVisibility} />
        {visibleError ? <Text style={styles.staleText} accessibilityRole="alert">Couldn’t refresh account information. Showing your latest available information.</Text> : null}
        <Text style={styles.remoteSource}>Data source: {visibleAccount.sourceEnvironment} · Updated {formatDate(visibleAccount.lastSuccessfulUpdate)}</Text>

        <View style={styles.actionRow}>
          {isDeposit(visibleAccount) ? (
            <ActionButton icon="calendar-outline" label={depositActionLabel} onPress={() => setActiveSection("details")} />
          ) : visibleAccount.status === "active" ? (
            <ActionButton
              icon="arrow-up-outline"
              label="Transfer"
              onPress={() => router.push({ pathname: "/(app)/transfer", params: { fromAccountId: visibleAccount.id } })}
            />
          ) : null}
          <ActionButton icon="document-text-outline" label="Statement" onPress={() => openStatement(visibleAccount)} />
          <ActionButton icon="information-circle-outline" label="Details" onPress={() => setActiveSection("details")} />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {sections.filter((item) => item.key !== "documents").map((item) => {
            const selected = item.key === activeSection;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => setActiveSection(item.key as Exclude<DetailsSection, "documents">)}
                style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && styles.pressed]}
              >
                <Text style={[styles.tabText, selected && styles.selectedTabText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tabContent}>
          {activeSection === "details" ? (
            <DetailsSectionContent account={visibleAccount} isBalanceVisible={balanceVisible} />
          ) : (
            <>
              <TabSectionHeader title="Transaction history" description="Transactions received from the owner-scoped banking API." />
              {visibleTransactions.length ? (
                <View style={styles.transactionCard}>
                  {visibleTransactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      isBalanceVisible={balanceVisible}
                      onPress={() => router.push({ pathname: "/(app)/activity/[transactionId]", params: { transactionId: transaction.id, accountId: visibleAccount.id } })}
                    />
                  ))}
                </View>
              ) : <StateCard compact title="No transactions yet" description="Transactions will appear here when the connected data source returns them." />}
            </>
          )}
        </View>
      </View>
    </ScreenShell>
  );
}

function LocalAccountDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { accountId: rawAccountId, section: rawSection } = useLocalSearchParams<{
    accountId?: string | string[];
    section?: string | string[];
  }>();
  const accountId = firstParam(rawAccountId);
  const routeSection = firstParam(rawSection);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);
  const [activeSection, setActiveSection] = useState<DetailsSection>(() => sectionFromParam(routeSection));

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountState, setAccountState] = useState<LoadState>("loading");
  const [accountError, setAccountError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [transactionPage, setTransactionPage] = useState<Awaited<ReturnType<typeof getAccountTransactions>> | null>(null);
  const [transactionState, setTransactionState] = useState<LoadState>("loading");
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [documents, setDocuments] = useState<AccountDocument[]>([]);
  const [documentState, setDocumentState] = useState<LoadState>("loading");
  const [exportState, setExportState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [transactionItems, setTransactionItems] = useState<AccountTransaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const transactionRequestId = useRef(0);
  const documentRequestId = useRef(0);

  const loadAccount = useCallback(async (quiet = false) => {
    if (!accountId) {
      setAccountState("error");
      setAccountError("This account link is missing an account ID.");
      return;
    }

    const currentRequest = ++requestId.current;
    if (!quiet) {
      setAccountState("loading");
      setAccount(null);
    }
    setAccountError(null);

    try {
      const [nextAccount, nextAccounts] = await Promise.all([
        getAccount(accountId, { customerId }),
        getAccounts({ customerId }),
      ]);
      if (currentRequest !== requestId.current) {
        return;
      }
      if (!nextAccount) {
        setAccountState("error");
        setAccountError("This account is unavailable or you do not have access to it.");
        setAccount(null);
        return;
      }
      setAccount(nextAccount);
      setAccounts(nextAccounts);
      setAccountState("ready");
    } catch {
      if (currentRequest === requestId.current) {
        if (quiet) {
          setAccountState("ready");
          setAccountError("Couldn’t refresh account information. Showing your latest available information.");
        } else {
          setAccountState("error");
          setAccountError("We couldn’t load this account. Please try again.");
        }
      }
    }
  }, [accountId, customerId]);

  useEffect(() => {
    setActiveSection(sectionFromParam(routeSection));
    setFilters(initialFilters);
    setSearchInput("");
    setPageNumber(1);
    setTransactionPage(null);
    setTransactionItems([]);
    void loadAccount();
  }, [accountId, loadAccount, routeSection]);

  useFocusEffect(
    useCallback(() => {
      if (accountState === "ready") {
        void loadAccount(true);
      }
    }, [accountState, loadAccount]),
  );

  const loadTransactions = useCallback(async (requestedPage = pageNumber) => {
    if (!accountId || accountState !== "ready") {
      return;
    }

    setTransactionState("loading");
    setTransactionError(null);
    const currentRequest = ++transactionRequestId.current;
    try {
      const nextPage = await getAccountTransactions(accountId, {
        customerId,
        filters,
        page: requestedPage,
      });
      if (currentRequest !== transactionRequestId.current) return;
      setTransactionPage(nextPage);
      setTransactionItems((current) => requestedPage === 1 ? nextPage.items : [...current, ...nextPage.items]);
      setTransactionState("ready");
    } catch (error) {
      if (currentRequest !== transactionRequestId.current) return;
      setTransactionState("error");
      setTransactionError(error instanceof Error ? error.message : "We couldn’t load transactions.");
    }
  }, [accountId, accountState, customerId, filters, pageNumber]);

  useEffect(() => {
    if (activeSection === "transactions") {
      void loadTransactions();
    }
  }, [activeSection, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (activeSection === "transactions" && accountState === "ready") {
        void loadTransactions();
      }
    }, [accountState, activeSection, loadTransactions]),
  );

  useEffect(() => {
    if (activeSection !== "documents" || !accountId || accountState !== "ready") {
      return;
    }
    const currentRequest = ++documentRequestId.current;
    setDocumentState("loading");
    void getAccountDocuments(accountId, { customerId })
      .then((nextDocuments) => {
        if (currentRequest !== documentRequestId.current) return;
        setDocuments(nextDocuments);
        setDocumentState("ready");
      })
      .catch(() => {
        if (currentRequest === documentRequestId.current) setDocumentState("error");
      });
  }, [accountId, accountState, activeSection, customerId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput.trim() || undefined }));
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });
  const horizontalPadding = width < 375 ? 16 : 20;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/accounts");
    }
  };

  const changeSection = (nextSection: DetailsSection) => {
    setActiveSection(nextSection);
  };

  const switchAccount = (nextAccountId: string) => {
    setIsSwitcherOpen(false);
    setPageNumber(1);
    const nextAccount = accounts.find((item) => item.id === nextAccountId);
    router.replace({
      pathname: "/(app)/accounts/[accountId]",
      params: {
        accountId: nextAccountId,
        section: "transactions",
        ...(nextAccount ? { source: nextAccount.sourceEnvironment === "Demo data" ? "demo" : "remote" } : {}),
      },
    });
  };

  const setTransactionFilter = <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "period" && value !== "custom" ? { fromDate: undefined, toDate: undefined } : {}),
    }));
    setPageNumber(1);
  };

  const applyTransactionFilters = (nextFilters: TransactionFilters, nextFromDate: string, nextToDate: string) => {
    const isCustomRange = nextFilters.period === "custom";
    setFilters((current) => ({
      ...nextFilters,
      search: current.search,
      fromDate: isCustomRange ? nextFromDate.trim() || undefined : undefined,
      toDate: isCustomRange ? nextToDate.trim() || undefined : undefined,
    }));
    setPageNumber(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchInput("");
    setPageNumber(1);
    setTransactionItems([]);
  };

  const refreshAccount = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAccount(true);
      if (activeSection === "transactions") {
        setPageNumber(1);
        await loadTransactions(1);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [activeSection, loadAccount, loadTransactions]);

  const isLoading = !isUserLoaded || !isBalanceVisibilityHydrated || accountState === "loading";
  const { timedOut: loadingTimedOut, reset: resetLoadingTimeout } = useLoadingTimeout(isLoading);
  const retryAfterLoadingTimeout = useCallback(async () => {
    resetLoadingTimeout();
    await loadAccount();
  }, [loadAccount, resetLoadingTimeout]);

  const openPreferenceModal = () => {
    setNicknameDraft(account?.nickname ?? "");
    setPreferenceError(null);
    setIsPreferenceModalOpen(true);
  };

  const saveNickname = async () => {
    if (!account) {
      return;
    }
    setIsSavingPreference(true);
    setPreferenceError(null);
    try {
      const nextAccount = await updateAccountPreference(
        account.id,
        { nickname: nicknameDraft },
        { customerId },
      );
      setAccount(nextAccount);
      setAccounts((current) => current.map((item) => item.id === nextAccount.id ? nextAccount : item));
      setIsPreferenceModalOpen(false);
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : "Nickname could not be saved");
    } finally {
      setIsSavingPreference(false);
    }
  };

  const setPrimary = async () => {
    if (!account || !account.capabilities.canSetPrimary) {
      return;
    }
    const previousAccount = account;
    try {
      const nextAccount = await updateAccountPreference(account.id, { isPrimary: true }, { customerId });
      setAccount(nextAccount);
      setAccounts((current) => current.map((item) => ({
        ...item,
        isPrimary: item.id === nextAccount.id,
      })));
    } catch (error) {
      setAccount(previousAccount);
      Alert.alert("Couldn’t update primary account", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const toggleBalanceVisibility = () => {
    if (!account) {
      return;
    }
    const nextVisible = !balanceVisible;
    void updateBalanceVisibility(undefined, nextVisible, { customerId }).catch((caught) => {
      if (process.env.NODE_ENV !== "production") console.warn("[BALANCE_VISIBILITY] sync failed", caught);
    });
  };

  const askCoach = () => {
    if (!account) {
      return;
    }
    router.push({
      pathname: "/(app)/coach/chat",
      params: {
        accountId: account.id,
        period: filters.period ?? "all",
        source: "account-details",
        ...(filters.period === "custom" && filters.fromDate ? { fromDate: filters.fromDate } : {}),
        ...(filters.period === "custom" && filters.toDate ? { toDate: filters.toDate } : {}),
      },
    });
  };

  const exportTransactions = async () => {
    if (!account) {
      return;
    }
    setExportState("loading");
    try {
      const result = await createTransactionCsv(account.id, filters, { customerId });
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: result.filename, message: result.csv });
      }
      setExportState("success");
    } catch {
      setExportState("error");
    }
  };

  if (isLoading && !loadingTimedOut) {
    return <LoadingScreen />;
  }

  if (isLoading && loadingTimedOut) {
    return (
      <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void retryAfterLoadingTimeout()}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <StateCard
            title="Account data is taking too long"
            description="The banking service did not finish loading. Check your connection and try again."
            actionLabel="Retry"
            onAction={() => void retryAfterLoadingTimeout()}
          />
        </View>
      </ScreenShell>
    );
  }

  if (!account || accountState === "error") {
    return (
      <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void refreshAccount()}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to previous screen"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <StateCard
            title="Account unavailable"
            description={accountError ?? "This account could not be found."}
            actionLabel="Retry"
            onAction={() => void loadAccount()}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell bottomPadding={tabBarHeight} refreshing={isRefreshing} onRefresh={() => void refreshAccount()}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to previous screen"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch account from ${account.nickname ?? account.name}`}
            onPress={() => setIsSwitcherOpen(true)}
            style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
          >
            <Ionicons name="swap-vertical-outline" size={20} color={accountColors.brandGreenDark} />
            <Text style={styles.switchText}>Switch</Text>
          </Pressable>
        </View>

        <AccountSummary
          account={account}
          isBalanceVisible={balanceVisible}
          onToggleVisibility={() => void toggleBalanceVisibility()}
        />
        {accountError ? <Text style={styles.staleText} accessibilityRole="alert">{accountError}</Text> : null}

        <View style={styles.actionRow}>
          {account.type === "fixed-deposit" ? (
            <>
              <ActionButton icon="calendar-outline" label="Maturity" onPress={() => changeSection("details")} />
              <ActionButton icon="document-text-outline" label="Statement" onPress={() => router.push({ pathname: "/(app)/accounts/statements", params: { accountId: account.id } })} />
              <ActionButton icon="information-circle-outline" label="Details" onPress={() => changeSection("details")} />
            </>
          ) : null}
          {account.type === "recurring-deposit" ? (
            <>
              <ActionButton icon="calendar-outline" label="Schedule" onPress={() => changeSection("details")} />
              <ActionButton icon="document-text-outline" label="Statement" onPress={() => router.push({ pathname: "/(app)/accounts/statements", params: { accountId: account.id } })} />
              <ActionButton icon="information-circle-outline" label="Details" onPress={() => changeSection("details")} />
            </>
          ) : null}
          {!isDeposit(account) && account.status === "active" ? (
            <ActionButton
              icon="arrow-up-outline"
              label="Transfer"
              onPress={() => router.push({
                pathname: "/(app)/transfer",
                params: { fromAccountId: account.id },
              })}
            />
          ) : null}
          {!isDeposit(account) ? <ActionButton icon="document-text-outline" label="Statement" onPress={() => router.push({ pathname: "/(app)/accounts/statements", params: { accountId: account.id } })} /> : null}
          {!isDeposit(account) && account.capabilities.canManageCard && account.cardAvailable !== false ? (
            <ActionButton
              icon="card-outline"
              label="Card"
              onPress={() => router.push({
                pathname: "/(app)/accounts/manage-card",
                params: { accountId: account.id },
              })}
            />
          ) : null}
          <ActionButton icon="ellipsis-horizontal" label="More" onPress={() => setIsMoreActionsOpen(true)} />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {sections.map((item) => {
            const selected = item.key === activeSection;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => changeSection(item.key)}
                style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && styles.pressed]}
              >
                <Text style={[styles.tabText, selected && styles.selectedTabText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tabContent}>
          {activeSection === "transactions" ? (
            <TransactionsSection
              account={account}
              balanceVisible={balanceVisible}
              filters={filters}
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              onSetFilter={setTransactionFilter}
              onApplyFilters={applyTransactionFilters}
              onClearFilters={clearFilters}
              page={transactionPage}
              items={transactionItems}
              loadState={transactionState}
              error={transactionError}
              onRetry={() => void loadTransactions()}
              onLoadMore={() => setPageNumber((current) => current + 1)}
              onTransactionPress={(transaction) => router.push({
                pathname: "/(app)/activity/[transactionId]",
                params: { transactionId: transaction.id, accountId: account.id },
              })}
            />
          ) : activeSection === "details" ? (
            <DetailsSectionContent account={account} isBalanceVisible={balanceVisible} onEditPreferences={openPreferenceModal} onToggleVisibility={() => void toggleBalanceVisibility()} onSetPrimary={() => void setPrimary()} />
          ) : (
            <DocumentsSection
              documents={documents}
              loadState={documentState}
              exportState={exportState}
              onExport={() => void exportTransactions()}
            />
          )}
        </View>
      </View>

      <AccountSwitcherModal
        visible={isSwitcherOpen}
        accounts={accounts}
        selectedAccountId={account.id}
        onClose={() => setIsSwitcherOpen(false)}
        onSelect={switchAccount}
      />
      <MoreActionsModal
        visible={isMoreActionsOpen}
        canSetPrimary={account.capabilities.canSetPrimary && !account.isPrimary}
        onClose={() => setIsMoreActionsOpen(false)}
        onRename={() => { setIsMoreActionsOpen(false); openPreferenceModal(); }}
        onAskCoach={() => { setIsMoreActionsOpen(false); askCoach(); }}
        onSetPrimary={() => { setIsMoreActionsOpen(false); void setPrimary(); }}
      />
      <Modal
        visible={isPreferenceModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPreferenceModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.preferenceModal}>
            <View style={styles.modalHeader}>
              <Text accessibilityRole="header" style={styles.modalTitle}>Account preferences</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close account preferences"
                onPress={() => setIsPreferenceModalOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={23} color={accountColors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Account nickname</Text>
            <TextInput
              accessibilityLabel="Account nickname"
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              placeholder={account.name}
              maxLength={40}
              autoFocus
              style={styles.textInput}
            />
            <Text style={styles.characterHint}>{nicknameDraft.length}/40 characters</Text>
            {preferenceError ? <Text style={styles.formError} accessibilityRole="alert">{preferenceError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save account nickname"
              accessibilityState={{ busy: isSavingPreference }}
              disabled={isSavingPreference}
              onPress={() => void saveNickname()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSavingPreference && styles.disabledButton]}
            >
              {isSavingPreference ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.primaryButtonText}>Save preference</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function ScreenShell({ children, bottomPadding, refreshing = false, onRefresh }: { children: React.ReactNode; bottomPadding: number; refreshing?: boolean; onRefresh?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accountColors.brandGreenDark} colors={[accountColors.brandGreenDark]} /> : undefined}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 28 + bottomPadding }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function LoadingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.loadingScreen, { paddingTop: 34 + insets.top }]} accessible accessibilityLabel="Loading account details">
      <View style={styles.loadingBlock} />
      <View style={[styles.loadingBlock, styles.loadingBlockShort]} />
      <View style={[styles.loadingBlock, styles.loadingBlockLarge]} />
      <View style={styles.loadingRows} />
    </View>
  );
}

function AccountSummary({ account, isBalanceVisible, onToggleVisibility }: { account: BankAccount; isBalanceVisible: boolean; onToggleVisibility: () => void }) {
  const displayedName = account.nickname ?? account.name;
  const metric = primaryAccountMetric(account);
  const formattedMetric = privateAmount(metric.amountMinorUnits, isBalanceVisible);
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryIcon}>
          <Ionicons name={accountIcon(account)} size={23} color={accountColors.brandGreenDark} />
        </View>
        <View style={styles.summaryHeading}>
          <Text numberOfLines={2} style={styles.accountTitle}>{displayedName}</Text>
          <Text style={styles.maskedNumber}>{accountTypeLabel(account)} •••• {account.lastFour}</Text>
        </View>
        {account.isPrimary ? <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View> : null}
      </View>

      <View style={styles.summaryBalanceRow}>
        <View style={styles.summaryBalanceContent}>
          <Text style={styles.balanceLabel}>{metric.label}</Text>
          <Text
            adjustsFontSizeToFit
            accessibilityLabel={metric.amountMinorUnits === undefined
              ? `${metric.label} unavailable`
              : isBalanceVisible
                ? formattedMetric
                : `${metric.label} hidden`}
            minimumFontScale={0.76}
            numberOfLines={1}
            style={styles.summaryBalance}
          >
            {formattedMetric ?? `${metric.label} unavailable`}
          </Text>
        </View>
        <IconButton
          accessibilityLabel={isBalanceVisible ? "Hide account balance" : "Show account balance"}
          iconName={isBalanceVisible ? "eye-outline" : "eye-off-outline"}
          iconSize={20}
          onPress={onToggleVisibility}
          style={styles.eyeButton}
        />
      </View>

      <View style={styles.summaryMetaGrid}>
        {account.type === "fixed-deposit" ? (
          <>
            <SummaryMeta label="Principal" value={privateAmount(account.fixedDeposit?.principal.minorUnits, isBalanceVisible) ?? "Unavailable"} />
            <SummaryMeta label="Matures" value={account.fixedDeposit?.maturityDate ? formatMaturityDate(account.fixedDeposit.maturityDate) : account.maturityDate ? formatMaturityDate(account.maturityDate) : "Unavailable"} />
            {account.fixedDeposit?.interestRate ? <SummaryMeta label="Interest rate" value={account.fixedDeposit.interestRate} /> : null}
          </>
        ) : account.type === "recurring-deposit" ? (
          <>
            <SummaryMeta label="Contribution" value={privateAmount(account.recurringDeposit?.contributionAmount.minorUnits, isBalanceVisible) ?? "Unavailable"} />
            <SummaryMeta label="Next deposit" value={account.recurringDeposit?.nextContributionDate ? formatMaturityDate(account.recurringDeposit.nextContributionDate) : "Unavailable"} />
          </>
        ) : (
          <>
            {account.balanceDataAvailable !== false && account.ledgerBalanceMinorUnits !== undefined ? (
              <SummaryMeta label="Current balance" value={privateAmount(account.ledgerBalanceMinorUnits, isBalanceVisible)!} />
            ) : null}
            {account.balanceDataAvailable !== false && account.holdsMinorUnits !== undefined ? (
              <SummaryMeta label="Holds" value={privateAmount(account.holdsMinorUnits, isBalanceVisible)!} />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function SummaryMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMeta}>
      <Text style={styles.summaryMetaLabel}>{label}</Text>
      <Text style={styles.summaryMetaValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={accountColors.brandGreenDark} />
      <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function TransactionsSection({
  account,
  balanceVisible,
  filters,
  searchInput,
  onSearchChange,
  onSetFilter,
  onApplyFilters,
  page,
  items,
  loadState,
  error,
  onRetry,
  onClearFilters,
  onLoadMore,
  onTransactionPress,
}: {
  account: BankAccount;
  balanceVisible: boolean;
  filters: TransactionFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSetFilter: <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => void;
  onApplyFilters: (filters: TransactionFilters, fromDate: string, toDate: string) => void;
  page: Awaited<ReturnType<typeof getAccountTransactions>> | null;
  items: AccountTransaction[];
  loadState: LoadState;
  error: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onTransactionPress: (transaction: AccountTransaction) => void;
}) {
  const hasActiveFilter = Boolean(
    searchInput ||
      (filters.period && !["all", "this-month"].includes(filters.period)) ||
      (filters.direction && filters.direction !== "all") ||
      (filters.category && filters.category !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.channel && filters.channel !== "all"),
  );
  const isDepositAccount = isDeposit(account);

  return (
    <View>
      <TabSectionHeader
        title={isDepositAccount ? "Contribution history" : "Transaction history"}
        description={isDepositAccount ? "Recorded contributions for this deposit." : "Search and review activity for this account."}
        action={loadState === "loading" && page ? <ActivityIndicator color={accountColors.brandGreenDark} /> : null}
      />

      {!isDepositAccount && page?.summary ? <TransactionSummary summary={page.summary} balanceVisible={balanceVisible} /> : null}
      <TransactionFiltersPanel
        filters={filters}
        searchInput={searchInput}
        onSearchChange={onSearchChange}
        onSetFilter={onSetFilter}
        onApplyFilters={onApplyFilters}
        onClearFilters={onClearFilters}
        hasActiveFilter={hasActiveFilter}
      />

      {loadState === "loading" && !page ? (
        <TransactionSkeleton />
      ) : loadState === "error" ? (
        <StateCard title="Unable to load transactions" description={error ?? "Please try again."} actionLabel="Retry" onAction={onRetry} />
      ) : !page || page.totalItems === 0 ? (
        <StateCard
          compact
          title={hasActiveFilter ? "No matching transactions" : "No transactions yet"}
          description={hasActiveFilter ? "Try removing a filter or searching for another description." : "Transactions will appear here when they are available from the data source."}
          actionLabel={hasActiveFilter ? "Clear filters" : undefined}
          onAction={hasActiveFilter ? onClearFilters : undefined}
        />
      ) : (
        <View style={styles.transactionCard}>
          {items.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              isBalanceVisible={balanceVisible}
              onPress={() => onTransactionPress(transaction)}
            />
          ))}
          <View style={styles.paginationRow}>
            <Text style={styles.paginationText}>Showing {items.length} of {page.totalItems} transactions</Text>
            {page.page < page.totalPages ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more transactions"
                disabled={loadState === "loading"}
                onPress={onLoadMore}
                style={({ pressed }) => [styles.loadMoreButton, loadState === "loading" && styles.disabledButton, pressed && styles.pressed]}
              >
                {loadState === "loading" ? <ActivityIndicator size="small" color={accountColors.brandGreenDark} /> : null}
                <Text style={styles.loadMoreText}>{loadState === "loading" ? "Loading…" : "Load more"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function TabSectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <View style={styles.tabSectionHeader}>
      <View style={styles.sectionHeadingContent}>
        <Text accessibilityRole="header" style={styles.tabSectionTitle}>{title}</Text>
        <Text style={styles.tabSectionDescription}>{description}</Text>
      </View>
      {action ? <View style={styles.sectionHeadingActions}>{action}</View> : null}
    </View>
  );
}

function TransactionSummary({ summary, balanceVisible }: { summary: { moneyInMinorUnits: number; moneyOutMinorUnits: number; netMovementMinorUnits: number; scopeLabel: string; coverageLabel: string }; balanceVisible: boolean }) {
  return (
    <View style={styles.transactionSummary}>
      <View style={styles.summaryTitleRow}>
        <View>
          <Text style={styles.summarySectionTitle}>Money movement</Text>
          <Text style={styles.summaryScope}>{summary.scopeLabel.split(" · ")[0]}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Money movement totals information"
          onPress={() => Alert.alert("Money movement totals", "Totals include posted transactions only.")}
          style={({ pressed }) => [styles.summaryInfoButton, pressed && styles.pressed]}
        >
          <Ionicons name="information-circle-outline" size={18} color={accountColors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.movementRow}>
        <MovementMetric label="Money in" value={summary.moneyInMinorUnits} color="#007E5D" balanceVisible={balanceVisible} />
        <MovementMetric label="Money out" value={summary.moneyOutMinorUnits} color="#111827" balanceVisible={balanceVisible} />
        <MovementMetric label="Net" value={summary.netMovementMinorUnits} color={summary.netMovementMinorUnits >= 0 ? "#007E5D" : "#B93A2B"} balanceVisible={balanceVisible} />
      </View>
    </View>
  );
}

function MovementMetric({ label, value, color, balanceVisible }: { label: string; value: number; color: string; balanceVisible: boolean }) {
  return (
    <View style={styles.movementMetric}>
      <Text style={styles.movementLabel}>{label}</Text>
      <Text style={[styles.movementValue, { color }]}>{balanceVisible ? formatIndianMinorUnits(value) : "Hidden"}</Text>
    </View>
  );
}

function TransactionFiltersPanel({
  filters,
  searchInput,
  onSearchChange,
  onSetFilter,
  onApplyFilters,
  onClearFilters,
  hasActiveFilter,
}: {
  filters: TransactionFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSetFilter: <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => void;
  onApplyFilters: (filters: TransactionFilters, fromDate: string, toDate: string) => void;
  onClearFilters: () => void;
  hasActiveFilter: boolean;
}) {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>(filters);
  const [draftFromDate, setDraftFromDate] = useState(filters.fromDate ?? "");
  const [draftToDate, setDraftToDate] = useState(filters.toDate ?? "");

  const filterCount = [filters.direction, filters.category, filters.status, filters.channel]
    .filter((value) => value && value !== "all").length;
  const periodLabel = filters.period === "last-month"
    ? "Last month"
    : filters.period === "custom"
      ? "Custom range"
      : filters.period === "this-month"
        ? "This month"
        : "All time";

  const openFilterSheet = () => {
    setDraftFilters({ ...filters });
    setDraftFromDate(filters.fromDate ?? "");
    setDraftToDate(filters.toDate ?? "");
    setIsFilterSheetOpen(true);
  };

  const setDraftFilter = <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const applyDraftFilters = () => {
    if (draftFilters.period === "custom" && (!draftFromDate.trim() || !draftToDate.trim())) {
      Alert.alert("Add a date range", "Enter both a start and end date to use a custom range.");
      return;
    }
    onApplyFilters(draftFilters, draftFromDate, draftToDate);
    setIsFilterSheetOpen(false);
  };

  const appliedFilters: { label: string; clear: () => void }[] = [];
  if (searchInput) appliedFilters.push({ label: `Search: ${searchInput}`, clear: () => onSearchChange("") });
  if (filters.period && !["all", "this-month"].includes(filters.period)) appliedFilters.push({ label: filters.period === "last-month" ? "Last month" : "Custom range", clear: () => onSetFilter("period", "all") });
  if (filters.direction && filters.direction !== "all") appliedFilters.push({ label: filters.direction === "credit" ? "Money in" : "Money out", clear: () => onSetFilter("direction", "all") });
  if (filters.category && filters.category !== "all") appliedFilters.push({ label: transactionCategoryLabel(filters.category), clear: () => onSetFilter("category", "all") });
  if (filters.status && filters.status !== "all") appliedFilters.push({ label: accountStatusLabel(filters.status), clear: () => onSetFilter("status", "all") });
  if (filters.channel && filters.channel !== "all") appliedFilters.push({ label: filters.channel, clear: () => onSetFilter("channel", "all") });

  return (
    <View style={styles.filtersPanel}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color="#7B8492" />
        <TextInput
          accessibilityLabel="Search transactions"
          value={searchInput}
          onChangeText={onSearchChange}
          placeholder="Search transactions"
          placeholderTextColor="#98A1AE"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchInput ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onSearchChange("")}><Ionicons name="close-circle" size={19} color="#98A1AE" /></Pressable> : null}
      </View>
      <View style={styles.filterBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={filterCount ? `Open filters, ${filterCount} active` : "Open filters"} onPress={openFilterSheet} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={17} color={accountColors.brandGreenDark} />
          <Text style={styles.filterButtonText}>{filterCount ? `Filters (${filterCount})` : "Filters"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Transaction period: ${periodLabel}`}
          onPress={() => onSetFilter("period", filters.period === "this-month" ? "all" : "this-month")}
          style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}
        >
          <Text style={styles.periodButtonText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={15} color={accountColors.brandGreenDark} />
        </Pressable>
      </View>
      {hasActiveFilter ? (
        <View style={styles.appliedFiltersBlock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appliedChipList}>
            {appliedFilters.map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`Remove ${item.label} filter`} onPress={item.clear} style={({ pressed }) => [styles.appliedChip, pressed && styles.pressed]}><Text style={styles.appliedChipText}>{item.label}  ×</Text></Pressable>)}
          </ScrollView>
          <View style={styles.appliedFiltersRow}>
            <Text style={styles.appliedLabel}>Filters applied</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear all transaction filters" onPress={onClearFilters} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear all</Text></Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={isFilterSheetOpen} transparent animationType="slide" onRequestClose={() => setIsFilterSheetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.filterSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text accessibilityRole="header" style={styles.modalTitle}>Filter transactions</Text>
                <Text style={styles.modalDescription}>Refine activity for this account.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close transaction filters" onPress={() => setIsFilterSheetOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={accountColors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
              <FilterSheetSection label="Period">
                <FilterChip label="All time" selected={!draftFilters.period || draftFilters.period === "all"} onPress={() => setDraftFilter("period", "all")} />
                <FilterChip label="This month" selected={draftFilters.period === "this-month"} onPress={() => setDraftFilter("period", "this-month")} />
                <FilterChip label="Last month" selected={draftFilters.period === "last-month"} onPress={() => setDraftFilter("period", "last-month")} />
                <FilterChip label="Custom" selected={draftFilters.period === "custom"} onPress={() => setDraftFilter("period", "custom")} />
              </FilterSheetSection>
              {draftFilters.period === "custom" ? (
                <View style={styles.dateInputRow}>
                  <TextInput accessibilityLabel="Start date" value={draftFromDate} onChangeText={setDraftFromDate} placeholder="YYYY-MM-DD" placeholderTextColor="#98A1AE" style={styles.dateInput} />
                  <Text style={styles.dateSeparator}>to</Text>
                  <TextInput accessibilityLabel="End date" value={draftToDate} onChangeText={setDraftToDate} placeholder="YYYY-MM-DD" placeholderTextColor="#98A1AE" style={styles.dateInput} />
                </View>
              ) : null}
              <FilterSheetSection label="Direction">
                <FilterChip label="All" selected={!draftFilters.direction || draftFilters.direction === "all"} onPress={() => setDraftFilter("direction", "all")} />
                <FilterChip label="Money in" selected={draftFilters.direction === "credit"} onPress={() => setDraftFilter("direction", "credit")} />
                <FilterChip label="Money out" selected={draftFilters.direction === "debit"} onPress={() => setDraftFilter("direction", "debit")} />
              </FilterSheetSection>
              <FilterSheetSection label="Category">
                <FilterChip label="All" selected={!draftFilters.category || draftFilters.category === "all"} onPress={() => setDraftFilter("category", "all")} />
                {TRANSACTION_CATEGORIES.map((category) => <FilterChip key={category} label={transactionCategoryLabel(category)} selected={draftFilters.category === category} onPress={() => setDraftFilter("category", category)} />)}
              </FilterSheetSection>
              <FilterSheetSection label="Status">
                <FilterChip label="All" selected={!draftFilters.status || draftFilters.status === "all"} onPress={() => setDraftFilter("status", "all")} />
                {TRANSACTION_STATUSES.map((status) => <FilterChip key={status} label={status.charAt(0).toUpperCase() + status.slice(1)} selected={draftFilters.status === status} onPress={() => setDraftFilter("status", status)} />)}
              </FilterSheetSection>
              <FilterSheetSection label="Channel">
                <FilterChip label="All" selected={!draftFilters.channel || draftFilters.channel === "all"} onPress={() => setDraftFilter("channel", "all")} />
                {TRANSACTION_CHANNELS.map((channel) => <FilterChip key={channel} label={channel} selected={draftFilters.channel === channel} onPress={() => setDraftFilter("channel", channel)} />)}
              </FilterSheetSection>
            </ScrollView>
            <View style={styles.filterSheetActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Reset transaction filters" onPress={() => { setDraftFilters({ ...initialFilters, period: "all" }); setDraftFromDate(""); setDraftToDate(""); }} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply transaction filters" onPress={applyDraftFilters} style={({ pressed }) => [styles.applyFiltersButton, pressed && styles.pressed]}>
                <Text style={styles.applyFiltersText}>Apply filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterSheetSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterSheetSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterSheetChips}>
        {children}
      </View>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Filter by ${label}`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.smallFilterChip, selected && styles.smallFilterChipSelected, pressed && styles.pressed]}>
      <Text style={[styles.smallFilterText, selected && styles.smallFilterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function TransactionSkeleton() {
  return <View style={styles.transactionCard} accessible accessibilityLabel="Loading transactions"><View style={styles.skeletonRow} /><View style={styles.skeletonRow} /><View style={styles.skeletonRow} /></View>;
}

function DetailsSectionContent({
  account,
  isBalanceVisible,
  onEditPreferences,
  onToggleVisibility,
  onSetPrimary,
}: {
  account: BankAccount;
  isBalanceVisible: boolean;
  onEditPreferences?: () => void;
  onToggleVisibility?: () => void;
  onSetPrimary?: () => void;
}) {
  const canManagePreferences = Boolean(onEditPreferences && onToggleVisibility && onSetPrimary);
  return (
    <View>
      <TabSectionHeader title="Account information" description="Bank-provided account and product details." />
      <View style={styles.infoCard}>
        <InfoRow label="Account holder" value={account.holderDisplayName} />
        <InfoRow label="Account name" value={account.name} />
        <InfoRow label="Account type" value={accountTypeLabel(account)} />
        <InfoRow label="Masked account number" value={`•••• ${account.lastFour}`} />
        <InfoRow label="Branch" value={account.branch} />
        <InfoRow label="IFSC" value={account.ifsc} />
        <InfoRow label="Currency" value={account.currency} />
        <InfoRow label="Opening date" value={account.openingDate ? formatDate(account.openingDate) : undefined} />
        <InfoRow label="Ownership / operating mode" value={account.ownershipMode} />
        <InfoRow label="Status" value={accountStatusLabel(account.status)} last />
      </View>

      {account.type === "fixed-deposit" ? (
        <FixedDepositDetailsContent account={account} isBalanceVisible={isBalanceVisible} />
      ) : account.type === "recurring-deposit" ? (
        <RecurringDepositDetailsContent account={account} isBalanceVisible={isBalanceVisible} />
      ) : (
        <TransactionAccountBalanceContent account={account} isBalanceVisible={isBalanceVisible} />
      )}

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Linked data</Text>
        <InfoRow label="Data source" value={account.sourceEnvironment} />
        <InfoRow label="Last updated" value={formatDate(account.lastSuccessfulUpdate)} last />
      </View>

      {canManagePreferences ? (
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderRow}><Text style={styles.cardTitle}>Preferences</Text><Ionicons name="options-outline" size={20} color={accountColors.brandGreenDark} /></View>
          <PreferenceRow label="Nickname" value={account.nickname ?? "Not set"} onPress={onEditPreferences} />
          <PreferenceRow label="Balance visibility" value={isBalanceVisible ? "Shown" : "Hidden"} onPress={onToggleVisibility} last={!account.capabilities.canSetPrimary} />
          {account.capabilities.canSetPrimary ? <PreferenceRow label="Primary payment account" value={account.isPrimary ? "Yes" : "No"} onPress={account.isPrimary ? undefined : onSetPrimary} last /> : null}
        </View>
      ) : null}
    </View>
  );
}

function TransactionAccountBalanceContent({ account, isBalanceVisible }: { account: BankAccount; isBalanceVisible: boolean }) {
  const hasBalanceSnapshot = account.balanceDataAvailable !== false;
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>Balance information</Text>
      <InfoRow label="Available balance" value={privateAmount(hasBalanceSnapshot ? account.availableBalanceMinorUnits : undefined, isBalanceVisible)} />
      <InfoRow label="Current balance" value={privateAmount(hasBalanceSnapshot ? account.ledgerBalanceMinorUnits : undefined, isBalanceVisible)} />
      <InfoRow label="Holds" value={privateAmount(hasBalanceSnapshot ? account.holdsMinorUnits : undefined, isBalanceVisible)} last />
    </View>
  );
}

function FixedDepositDetailsContent({ account, isBalanceVisible }: { account: BankAccount; isBalanceVisible: boolean }) {
  const details = account.fixedDeposit;
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>Fixed deposit details</Text>
      <InfoRow label="Principal" value={privateAmount(details?.principal.minorUnits, isBalanceVisible)} />
      <InfoRow label="Current value" value={privateAmount(details?.reportedCurrentValue?.minorUnits ?? (account.balanceDataAvailable === false ? undefined : account.ledgerBalanceMinorUnits), isBalanceVisible)} />
      <InfoRow label="Interest rate" value={details?.interestRate} />
      <InfoRow label="Start date" value={details?.startDate ? formatDate(details.startDate) : account.openingDate ? formatDate(account.openingDate) : undefined} />
      <InfoRow label="Maturity date" value={details?.maturityDate ? formatMaturityDate(details.maturityDate) : account.maturityDate ? formatMaturityDate(account.maturityDate) : undefined} />
      <InfoRow label="Expected maturity amount" value={privateAmount(details?.maturityValue?.minorUnits, isBalanceVisible)} last />
    </View>
  );
}

function RecurringDepositDetailsContent({ account, isBalanceVisible }: { account: BankAccount; isBalanceVisible: boolean }) {
  const details = account.recurringDeposit;
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>Recurring deposit details</Text>
      <InfoRow label="Current value" value={privateAmount(details?.reportedBalance.minorUnits ?? (account.balanceDataAvailable === false ? undefined : account.ledgerBalanceMinorUnits), isBalanceVisible)} />
      <InfoRow label={details?.contributionFrequency === "Monthly" ? "Monthly contribution" : "Contribution amount"} value={privateAmount(details?.contributionAmount.minorUnits, isBalanceVisible)} />
      <InfoRow label="Contribution frequency" value={details?.contributionFrequency} />
      <InfoRow label="Contributions recorded" value={details ? String(details.contributionsRecorded) : undefined} />
      <InfoRow label="Start date" value={details?.startDate ? formatDate(details.startDate) : account.openingDate ? formatDate(account.openingDate) : undefined} />
      <InfoRow label="Maturity date" value={details?.maturityDate ? formatMaturityDate(details.maturityDate) : account.maturityDate ? formatMaturityDate(account.maturityDate) : undefined} />
      <InfoRow label="Next deposit" value={details?.nextContributionDate ? formatDate(details.nextContributionDate) : undefined} last />
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? "Not available from this data source"}</Text>
    </View>
  );
}

function PreferenceRow({ label, value, onPress, last = false }: { label: string; value: string; onPress?: () => void; last?: boolean }) {
  const content = <><View style={styles.preferenceText}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>{onPress ? <Ionicons name="chevron-forward" size={18} color="#B4BCC6" /> : null}</>;
  if (!onPress) return <View style={[styles.preferenceRow, !last && styles.infoRowBorder]}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [styles.preferenceRow, !last && styles.infoRowBorder, pressed && styles.pressed]}>{content}</Pressable>;
}

function DocumentsSection({ documents, loadState, exportState, onExport }: { documents: AccountDocument[]; loadState: LoadState; exportState: "idle" | "loading" | "success" | "error"; onExport: () => void }) {
  return (
    <View>
      <TabSectionHeader title="Documents" description="Generated summaries are useful for review, but are not official bank statements." />
      {loadState === "loading" ? <TransactionSkeleton /> : loadState === "error" ? <StateCard title="Documents unavailable" description="Please try again later." /> : documents.map((document) => (
        <View key={document.id} style={styles.documentCard}>
          <View style={styles.documentIcon}><Ionicons name="document-text-outline" size={23} color={accountColors.brandGreenDark} /></View>
          <View style={styles.documentContent}><Text style={styles.documentTitle}>{document.title}</Text><Text style={styles.documentMeta}>{document.period} · {document.source}</Text><Text style={styles.documentDescription}>{document.description}</Text></View>
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Export transaction summary as CSV" accessibilityState={{ busy: exportState === "loading" }} disabled={exportState === "loading"} onPress={onExport} style={({ pressed }) => [styles.primaryButton, styles.documentsExportButton, pressed && styles.pressed, exportState === "loading" && styles.disabledButton]}>
        {exportState === "loading" ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="download-outline" size={19} color="#FFFFFF" />}
        <Text style={styles.primaryButtonText}>{exportState === "loading" ? "Preparing CSV…" : "Export transaction summary (CSV)"}</Text>
      </Pressable>
      {exportState === "success" ? <Text style={styles.successText} accessibilityLiveRegion="polite">CSV summary ready to download or share.</Text> : null}
      {exportState === "error" ? <Text style={styles.formError} accessibilityRole="alert">The CSV could not be prepared. Please try again.</Text> : null}
    </View>
  );
}

function AccountSwitcherModal({ visible, accounts, selectedAccountId, onClose, onSelect }: { visible: boolean; accounts: BankAccount[]; selectedAccountId: string; onClose: () => void; onSelect: (accountId: string) => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.switcherModal}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Switch account</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close account switcher" onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={accountColors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.modalDescription}>Choose an account to inspect.</Text>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${account.nickname ?? account.name} ending in ${account.lastFour}`}
              accessibilityState={{ selected: account.id === selectedAccountId }}
              onPress={() => onSelect(account.id)}
              style={({ pressed }) => [
                styles.switcherRow,
                account.id === selectedAccountId && styles.selectedSwitcherRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.switcherText}>
                <Text style={styles.switcherName}>{account.nickname ?? account.name}</Text>
                <Text style={styles.switcherNumber}>Account ending in {account.lastFour}</Text>
              </View>
              {account.id === selectedAccountId ? <Ionicons name="checkmark-circle" size={21} color={accountColors.brandGreenDark} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function MoreActionsModal({ visible, canSetPrimary, onClose, onRename, onAskCoach, onSetPrimary }: { visible: boolean; canSetPrimary: boolean; onClose: () => void; onRename: () => void; onAskCoach: () => void; onSetPrimary: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.moreActionsModal}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>More account actions</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close more account actions" onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={accountColors.textPrimary} />
            </Pressable>
          </View>
          <MoreActionRow icon="create-outline" label="Rename account" onPress={onRename} />
          <MoreActionRow icon="sparkles-outline" label="Ask Wealth Coach" onPress={onAskCoach} />
          {canSetPrimary ? <MoreActionRow icon="star-outline" label="Set as primary account" onPress={onSetPrimary} last /> : null}
        </View>
      </View>
    </Modal>
  );
}

function MoreActionRow({ icon, label, onPress, last = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.moreActionRow, !last && styles.infoRowBorder, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={accountColors.brandGreenDark} />
      <Text style={styles.moreActionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#B4BCC6" />
    </Pressable>
  );
}

function StateCard({ title, description, actionLabel, onAction, compact = false }: { title: string; description: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  return <View style={[styles.stateCard, compact && styles.compactStateCard]}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDescription}>{description}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: accountColors.background },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", paddingTop: 10 },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: accountColors.textPrimary, fontSize: 16, fontWeight: "700" },
  switchButton: { minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 5, paddingHorizontal: 14, borderRadius: 12, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.brandGreenBorder },
  switchText: { color: accountColors.brandGreenDark, fontSize: 14, fontWeight: "700" },
  summaryCard: { marginTop: 18, padding: 20, borderRadius: 22, backgroundColor: accountColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: accountColors.border, ...softCardShadow },
  summaryTopRow: { flexDirection: "row", alignItems: "center" },
  summaryIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: accountColors.brandGreenSoft },
  summaryHeading: { flex: 1, minWidth: 0, marginLeft: 13, marginRight: 7 },
  accountTitle: { color: accountColors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  maskedNumber: { marginTop: 3, color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  primaryBadge: { minHeight: 26, justifyContent: "center", paddingHorizontal: 10, borderRadius: 999, backgroundColor: accountColors.brandGreenSoft },
  primaryBadgeText: { color: accountColors.brandGreenDark, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  summaryBalanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: accountColors.divider },
  summaryBalanceContent: { flex: 1, minWidth: 0 },
  balanceLabel: { color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  summaryBalance: { marginTop: 3, color: accountColors.textPrimary, fontSize: 28, lineHeight: 35, fontWeight: "700", fontVariant: ["tabular-nums"] },
  eyeButton: { marginLeft: 10, backgroundColor: accountColors.surfaceMuted },
  summaryMetaGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 28, marginTop: 13 },
  summaryMeta: { minWidth: 105 },
  summaryMetaLabel: { color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  summaryMetaValue: { marginTop: 1, color: accountColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  updatedText: { marginTop: 14, color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  remoteSource: { marginTop: 12, color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  staleText: { marginTop: 12, color: "#8A5A10", fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", alignItems: "stretch", columnGap: 8, marginTop: 20 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 5, paddingHorizontal: 7, borderRadius: 12, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.brandGreenBorder },
  actionLabel: { flexShrink: 1, color: accountColors.brandGreenDark, fontSize: 12, fontWeight: "700" },
  tabs: { flexDirection: "row", marginTop: 32, borderBottomWidth: 1, borderBottomColor: accountColors.border },
  tab: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  selectedTab: { borderBottomColor: accountColors.brandGreenDark },
  tabText: { color: accountColors.textSecondary, fontSize: 14, fontWeight: "600" },
  selectedTabText: { color: accountColors.brandGreenDark, fontWeight: "700" },
  tabContent: { width: "100%", paddingTop: 24 },
  tabSectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tabSectionTitle: { color: accountColors.textPrimary, ...appTypography.sectionTitle },
  tabSectionDescription: { marginTop: 4, color: accountColors.textSecondary, ...appTypography.supporting },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 },
  sectionHeadingContent: { flex: 1, minWidth: 0 },
  sectionHeadingActions: { alignItems: "flex-end", marginLeft: 8 },
  sectionTitle: { color: accountColors.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: "700" },
  sectionDescription: { marginTop: 4, color: accountColors.textSecondary, fontSize: 13, lineHeight: 19 },
  transactionSummary: { marginTop: 24, padding: 16, borderRadius: 17, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border },
  summaryTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  summarySectionTitle: { color: accountColors.textPrimary, fontSize: 15, fontWeight: "700" },
  summaryScope: { marginTop: 3, color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  summaryInfoButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: -6, marginRight: -5 },
  movementRow: { flexDirection: "row", columnGap: 8, marginTop: 13 },
  movementMetric: { flex: 1, minWidth: 0 },
  movementLabel: { color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  movementValue: { marginTop: 3, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  filtersPanel: { marginTop: 24 },
  searchBox: { minHeight: 46, flexDirection: "row", alignItems: "center", columnGap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: accountColors.border },
  searchInput: { flex: 1, minWidth: 0, color: accountColors.textPrimary, fontSize: 14, paddingVertical: 9 },
  filterBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  filterButton: { minHeight: 42, flexDirection: "row", alignItems: "center", columnGap: 6, paddingHorizontal: 13, borderRadius: 12, backgroundColor: accountColors.brandGreenSoft },
  filterButtonText: { color: accountColors.brandGreenDark, fontSize: 13, fontWeight: "700" },
  periodButton: { minHeight: 42, flexDirection: "row", alignItems: "center", columnGap: 4, paddingHorizontal: 10 },
  periodButtonText: { color: accountColors.brandGreenDark, fontSize: 13, fontWeight: "700" },
  filterSheetSection: { marginTop: 18 },
  filterLabel: { marginBottom: 9, color: accountColors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterSheetChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallFilterChip: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: accountColors.border },
  smallFilterChipSelected: { backgroundColor: accountColors.brandGreenDark, borderColor: accountColors.brandGreenDark },
  smallFilterText: { color: accountColors.textSecondary, fontSize: 12, fontWeight: "600" },
  smallFilterTextSelected: { color: "#FFFFFF" },
  dateInputRow: { flexDirection: "row", alignItems: "center", columnGap: 5, marginTop: 9 },
  dateInput: { flex: 1, minWidth: 0, minHeight: 38, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: accountColors.border, color: accountColors.textPrimary, fontSize: 11 },
  dateSeparator: { color: accountColors.textSecondary, fontSize: 11 },
  appliedFiltersRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accountColors.divider },
  appliedFiltersBlock: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accountColors.divider },
  appliedChipList: { columnGap: 7, paddingRight: 3 },
  appliedChip: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: accountColors.brandOrangeSoft },
  appliedChipText: { color: accountColors.brandOrange, fontSize: 11, fontWeight: "700" },
  appliedLabel: { color: accountColors.textSecondary, fontSize: 12 },
  clearButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: 7 },
  clearButtonText: { color: accountColors.brandOrange, fontSize: 12, fontWeight: "700" },
  transactionCard: { marginTop: 24, paddingHorizontal: 13, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  paginationRow: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 9 },
  paginationText: { flex: 1, color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  loadMoreButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 7, paddingHorizontal: 13, borderRadius: 12, backgroundColor: accountColors.brandGreenSoft },
  loadMoreText: { color: accountColors.brandGreenDark, fontSize: 12, fontWeight: "700" },
  disabledButton: { opacity: 0.52 },
  infoCard: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 13, paddingBottom: 9 },
  cardTitle: { color: accountColors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  infoRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12, paddingVertical: 9 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: accountColors.divider },
  infoLabel: { flex: 1, color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  infoValue: { flex: 1.15, color: accountColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "right", fontVariant: ["tabular-nums"] },
  preferenceRow: { minHeight: 54, flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 9 },
  preferenceText: { flex: 1, minWidth: 0 },
  documentCard: { flexDirection: "row", marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  documentIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: accountColors.brandGreenSoft },
  documentContent: { flex: 1, minWidth: 0, marginLeft: 12 },
  documentTitle: { color: accountColors.textPrimary, fontSize: 15, fontWeight: "700" },
  documentMeta: { marginTop: 3, color: accountColors.textSecondary, fontSize: 12 },
  documentDescription: { marginTop: 7, color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 18, paddingHorizontal: 18, borderRadius: 12, backgroundColor: accountColors.brandGreenDark },
  documentsExportButton: { marginTop: 24 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  successText: { marginTop: 10, color: accountColors.brandGreenDark, fontSize: 12, textAlign: "center" },
  formError: { marginTop: 9, color: "#B93A2B", fontSize: 12, lineHeight: 17 },
  stateCard: { alignItems: "center", justifyContent: "center", marginTop: 24, padding: 23, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border },
  compactStateCard: { marginTop: 24 },
  stateTitle: { color: accountColors.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: "700", textAlign: "center" },
  stateDescription: { maxWidth: 330, marginTop: 7, color: accountColors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  loadingScreen: { flex: 1, padding: 20, paddingTop: 34, backgroundColor: accountColors.background },
  loadingBlock: { height: 24, marginBottom: 11, borderRadius: 8, backgroundColor: "#E7ECEE" },
  loadingBlockShort: { width: "42%" },
  loadingBlockLarge: { height: 205, marginTop: 16, borderRadius: 23 },
  loadingRows: { height: 340, marginTop: 18, borderRadius: 18, backgroundColor: "#E7ECEE" },
  skeletonRow: { height: 63, marginVertical: 7, borderRadius: 10, backgroundColor: "#E7ECEE" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.32)" },
  preferenceModal: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: accountColors.surface },
  filterSheet: { maxHeight: "90%", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: accountColors.surface },
  filterSheetContent: { paddingBottom: 10 },
  filterSheetActions: { flexDirection: "row", alignItems: "center", columnGap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accountColors.divider },
  resetButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: accountColors.brandGreenBorder },
  resetButtonText: { color: accountColors.brandGreenDark, fontSize: 14, fontWeight: "700" },
  applyFiltersButton: { minHeight: 48, flex: 1.35, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: accountColors.brandGreenDark },
  applyFiltersText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  moreActionsModal: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: accountColors.surface },
  moreActionRow: { minHeight: 56, flexDirection: "row", alignItems: "center", columnGap: 12, paddingVertical: 8 },
  moreActionLabel: { flex: 1, color: accountColors.textPrimary, fontSize: 15, fontWeight: "600" },
  switcherModal: { maxHeight: "82%", paddingHorizontal: 12, paddingTop: 18, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: accountColors.surface },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: accountColors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: "700" },
  modalDescription: { marginTop: 5, marginBottom: 8, color: accountColors.textSecondary, fontSize: 13 },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  fieldLabel: { marginTop: 22, marginBottom: 7, color: accountColors.textSecondary, fontSize: 13, fontWeight: "700" },
  textInput: { minHeight: 49, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: accountColors.border, color: accountColors.textPrimary, fontSize: 15 },
  characterHint: { marginTop: 5, color: accountColors.textSecondary, fontSize: 11, textAlign: "right" },
  switcherRow: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 10, marginTop: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 15, borderWidth: 1, borderColor: accountColors.border },
  selectedSwitcherRow: { borderColor: accountColors.brandGreenDark, backgroundColor: accountColors.brandGreenSoft },
  switcherText: { flex: 1, minWidth: 0 },
  switcherName: { color: accountColors.textPrimary, fontSize: 15, fontWeight: "700" },
  switcherNumber: { marginTop: 3, color: accountColors.textSecondary, fontSize: 12 },
  pressed: { opacity: 0.75 },
});
