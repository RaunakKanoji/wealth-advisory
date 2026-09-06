import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import { TransactionRow } from "@/components/accounts/transaction-row";
import { accountColors, softCardShadow } from "@/components/accounts/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate, formatMaturityDate } from "@/lib/date";
import {
  createTransactionCsv,
  getAccount,
  getAccountDocuments,
  getAccountPreference,
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
} from "@/types/banking";

type DetailsSection = "transactions" | "details" | "documents";
type LoadState = "loading" | "ready" | "error";

const sections: { key: DetailsSection; label: string }[] = [
  { key: "transactions", label: "Transactions" },
  { key: "details", label: "Details" },
  { key: "documents", label: "Documents" },
];

const initialFilters: TransactionFilters = {
  period: "all",
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

function accountStatusLabel(status: BankAccount["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AccountDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { accountId: rawAccountId, section: rawSection } = useLocalSearchParams<{
    accountId?: string | string[];
    section?: string | string[];
  }>();
  const accountId = firstParam(rawAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const currentSection: DetailsSection = sections.some((item) => item.key === firstParam(rawSection))
    ? (firstParam(rawSection) as DetailsSection)
    : "transactions";

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [accountState, setAccountState] = useState<LoadState>("loading");
  const [accountError, setAccountError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [transactionPage, setTransactionPage] = useState<Awaited<ReturnType<typeof getAccountTransactions>> | null>(null);
  const [transactionState, setTransactionState] = useState<LoadState>("loading");
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [documents, setDocuments] = useState<AccountDocument[]>([]);
  const [documentState, setDocumentState] = useState<LoadState>("loading");
  const [exportState, setExportState] = useState<"idle" | "loading" | "success" | "error">("idle");
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
      const [nextAccount, nextPreference, nextAccounts] = await Promise.all([
        getAccount(accountId, { customerId }),
        getAccountPreference(accountId, { customerId }),
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
      setBalanceVisible(nextPreference.balanceVisible !== false);
      setAccountState("ready");
    } catch {
      if (currentRequest === requestId.current) {
        setAccountState("error");
        setAccountError("We couldn’t load this account. Please try again.");
      }
    }
  }, [accountId, customerId]);

  useEffect(() => {
    setFilters(initialFilters);
    setSearchInput("");
    setFromDateInput("");
    setToDateInput("");
    setPageNumber(1);
    setTransactionPage(null);
    void loadAccount();
  }, [accountId, loadAccount]);

  useFocusEffect(
    useCallback(() => {
      if (accountState === "ready") {
        void loadAccount(true);
      }
    }, [accountState, loadAccount]),
  );

  const loadTransactions = useCallback(async () => {
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
        page: pageNumber,
      });
      if (currentRequest !== transactionRequestId.current) return;
      setTransactionPage(nextPage);
      setTransactionState("ready");
    } catch (error) {
      if (currentRequest !== transactionRequestId.current) return;
      setTransactionState("error");
      setTransactionError(error instanceof Error ? error.message : "We couldn’t load transactions.");
    }
  }, [accountId, accountState, customerId, filters, pageNumber]);

  useEffect(() => {
    if (currentSection === "transactions") {
      void loadTransactions();
    }
  }, [currentSection, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (currentSection === "transactions" && accountState === "ready") {
        void loadTransactions();
      }
    }, [accountState, currentSection, loadTransactions]),
  );

  useEffect(() => {
    if (currentSection !== "documents" || !accountId || accountState !== "ready") {
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
  }, [accountId, accountState, currentSection, customerId]);

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
    if (!accountId) {
      return;
    }
    router.replace({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId, section: nextSection },
    });
  };

  const switchAccount = (nextAccountId: string) => {
    setIsSwitcherOpen(false);
    setPageNumber(1);
    router.replace({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId: nextAccountId, section: "transactions" },
    });
  };

  const setTransactionFilter = <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPageNumber(1);
  };

  const applyCustomDateFilter = () => {
    setTransactionFilter("period", "custom");
    setFilters((current) => ({
      ...current,
      period: "custom",
      fromDate: fromDateInput.trim() || undefined,
      toDate: toDateInput.trim() || undefined,
    }));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchInput("");
    setFromDateInput("");
    setToDateInput("");
    setPageNumber(1);
  };

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

  const toggleBalanceVisibility = async () => {
    if (!account) {
      return;
    }
    const nextVisible = !balanceVisible;
    setBalanceVisible(nextVisible);
    try {
      await updateBalanceVisibility(account.id, nextVisible, { customerId });
    } catch {
      setBalanceVisible(!nextVisible);
      Alert.alert("Couldn’t save preference", "Your balance visibility preference was not changed.");
    }
  };

  const askCoach = () => {
    if (!account) {
      return;
    }
    router.push({
      pathname: "/(app)/coach/chat",
      params: { accountId: account.id, period: filters.period ?? "all", source: "account-details" },
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

  if (accountState === "loading") {
    return <LoadingScreen />;
  }

  if (!account || accountState === "error") {
    return (
      <ScreenShell bottomPadding={tabBarHeight}>
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
          actionLabel="Go to Accounts"
          onAction={() => router.replace("/(app)/(tabs)/accounts")}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell bottomPadding={tabBarHeight}>
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

        <View style={styles.actionRow}>
          <ActionButton icon="create-outline" label="Nickname" onPress={openPreferenceModal} />
          {account.status === "active" && ["savings", "current", "salary"].includes(account.type) ? (
            <ActionButton
              icon="arrow-up"
              label="Transfer"
              onPress={() => router.push({
                pathname: "/(app)/transfer",
                params: { fromAccountId: account.id },
              })}
            />
          ) : null}
          {account.capabilities.canManageCard ? (
            <ActionButton
              icon="card-outline"
              label="Manage card"
              onPress={() => router.push({
                pathname: "/(app)/accounts/manage-card",
                params: { accountId: account.id },
              })}
            />
          ) : null}
          {account.capabilities.canSetPrimary && !account.isPrimary ? (
            <ActionButton icon="star-outline" label="Set primary" onPress={() => void setPrimary()} />
          ) : null}
          <ActionButton icon="sparkles-outline" label="Ask Coach" onPress={askCoach} />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {sections.map((item) => {
            const selected = item.key === currentSection;
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

        {currentSection === "transactions" ? (
          <TransactionsSection
            account={account}
            balanceVisible={balanceVisible}
            filters={filters}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            fromDateInput={fromDateInput}
            toDateInput={toDateInput}
            onFromDateChange={setFromDateInput}
            onToDateChange={setToDateInput}
            onSetFilter={setTransactionFilter}
            onApplyCustomDate={applyCustomDateFilter}
            onClearFilters={clearFilters}
            page={transactionPage}
            loadState={transactionState}
            error={transactionError}
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            onTransactionPress={(transaction) => router.push({
              pathname: "/(app)/activity/[transactionId]",
              params: { transactionId: transaction.id, accountId: account.id },
            })}
          />
        ) : currentSection === "details" ? (
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

      <AccountSwitcherModal
        visible={isSwitcherOpen}
        accounts={accounts}
        selectedAccountId={account.id}
        onClose={() => setIsSwitcherOpen(false)}
        onSelect={switchAccount}
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

function ScreenShell({ children, bottomPadding }: { children: React.ReactNode; bottomPadding: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
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
  const hasAvailableBalance = account.availableBalanceMinorUnits !== undefined;
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryIcon}>
          <Ionicons name={isDeposit(account) ? "lock-closed-outline" : "wallet-outline"} size={25} color={accountColors.brandGreenDark} />
        </View>
        <View style={styles.summaryHeading}>
          <Text style={styles.productLabel}>{account.name}</Text>
          <Text numberOfLines={2} style={styles.accountTitle}>{displayedName}</Text>
          <Text style={styles.maskedNumber}>Account ending in {account.lastFour}</Text>
        </View>
        {account.isPrimary ? <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View> : null}
      </View>

      <View style={styles.summaryBalanceRow}>
        <View style={styles.summaryBalanceContent}>
          <Text style={styles.balanceLabel}>{hasAvailableBalance ? "Available balance" : account.type === "fixed-deposit" ? "Principal" : "Reported balance"}</Text>
          <Text
            accessibilityLabel={isBalanceVisible ? undefined : "Account balance hidden"}
            style={styles.summaryBalance}
          >
            {isBalanceVisible
              ? formatIndianMinorUnits(hasAvailableBalance ? account.availableBalanceMinorUnits! : account.balanceMinorUnits)
              : "₹ ••••••••"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isBalanceVisible ? "Hide account balance" : "Show account balance"}
          onPress={onToggleVisibility}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
        >
          <Ionicons name={isBalanceVisible ? "eye-outline" : "eye-off-outline"} size={21} color="#687386" />
        </Pressable>
      </View>

      <View style={styles.summaryMetaGrid}>
        <SummaryMeta label="Status" value={accountStatusLabel(account.status)} />
        <SummaryMeta label="Currency" value={account.currency} />
        {account.ledgerBalanceMinorUnits !== undefined ? (
          <SummaryMeta label="Ledger balance" value={isBalanceVisible ? formatIndianMinorUnits(account.ledgerBalanceMinorUnits) : "Hidden"} />
        ) : null}
        {account.holdsMinorUnits !== undefined ? (
          <SummaryMeta label="Holds" value={isBalanceVisible ? formatIndianMinorUnits(account.holdsMinorUnits) : "Hidden"} />
        ) : null}
      </View>
      <Text style={styles.updatedText}>Last successfully updated {formatDate(account.lastSuccessfulUpdate)}</Text>
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
      <Ionicons name={icon} size={20} color={accountColors.brandGreenDark} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function TransactionsSection({
  account,
  balanceVisible,
  filters,
  searchInput,
  onSearchChange,
  fromDateInput,
  toDateInput,
  onFromDateChange,
  onToDateChange,
  onSetFilter,
  onApplyCustomDate,
  onClearFilters,
  page,
  loadState,
  error,
  pageNumber,
  onPageChange,
  onTransactionPress,
}: {
  account: BankAccount;
  balanceVisible: boolean;
  filters: TransactionFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  fromDateInput: string;
  toDateInput: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onSetFilter: <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => void;
  onApplyCustomDate: () => void;
  onClearFilters: () => void;
  page: Awaited<ReturnType<typeof getAccountTransactions>> | null;
  loadState: LoadState;
  error: string | null;
  pageNumber: number;
  onPageChange: (page: number) => void;
  onTransactionPress: (transaction: AccountTransaction) => void;
}) {
  const hasActiveFilter = Boolean(
    searchInput ||
      (filters.period && filters.period !== "all") ||
      (filters.direction && filters.direction !== "all") ||
      (filters.category && filters.category !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.channel && filters.channel !== "all"),
  );
  const isDepositAccount = isDeposit(account);

  return (
    <View>
      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionHeadingContent}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{isDepositAccount ? "Contribution history" : "Transaction history"}</Text>
          <Text style={styles.sectionDescription}>{isDepositAccount ? "Recorded contributions for this deposit." : "Search and filter the complete demo transaction history."}</Text>
        </View>
        {loadState === "loading" && page ? <ActivityIndicator color={accountColors.brandGreenDark} /> : null}
      </View>

      {!isDepositAccount && page?.summary ? <TransactionSummary summary={page.summary} balanceVisible={balanceVisible} /> : null}
      <TransactionFiltersPanel
        filters={filters}
        searchInput={searchInput}
        onSearchChange={onSearchChange}
        fromDateInput={fromDateInput}
        toDateInput={toDateInput}
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
        onSetFilter={onSetFilter}
        onApplyCustomDate={onApplyCustomDate}
        onClearFilters={onClearFilters}
        hasActiveFilter={hasActiveFilter}
      />

      {loadState === "loading" && !page ? (
        <TransactionSkeleton />
      ) : loadState === "error" ? (
        <StateCard title="Transactions unavailable" description={error ?? "Please try again."} />
      ) : !page || page.totalItems === 0 ? (
        <StateCard
          compact
          title={hasActiveFilter ? "No matching transactions" : "No transactions yet"}
          description={hasActiveFilter ? "Try removing a filter or searching for another description." : "Transactions will appear here when they are available from the data source."}
        />
      ) : (
        <View style={styles.transactionCard}>
          {page.items.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              isBalanceVisible={balanceVisible}
              onPress={() => onTransactionPress(transaction)}
            />
          ))}
          <View style={styles.paginationRow}>
            <Text style={styles.paginationText}>{page.totalItems} matching records · page {page.page} of {page.totalPages}</Text>
            <View style={styles.paginationButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous transaction page"
                accessibilityState={{ disabled: pageNumber <= 1 }}
                disabled={pageNumber <= 1}
                onPress={() => onPageChange(Math.max(1, pageNumber - 1))}
                style={({ pressed }) => [styles.paginationButton, pageNumber <= 1 && styles.disabledButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={18} color={pageNumber <= 1 ? "#B8C0C8" : accountColors.brandGreenDark} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next transaction page"
                accessibilityState={{ disabled: page.page >= page.totalPages }}
                disabled={page.page >= page.totalPages}
                onPress={() => onPageChange(Math.min(page.totalPages, pageNumber + 1))}
                style={({ pressed }) => [styles.paginationButton, page.page >= page.totalPages && styles.disabledButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-forward" size={18} color={page.page >= page.totalPages ? "#B8C0C8" : accountColors.brandGreenDark} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function TransactionSummary({ summary, balanceVisible }: { summary: { moneyInMinorUnits: number; moneyOutMinorUnits: number; netMovementMinorUnits: number; scopeLabel: string; coverageLabel: string }; balanceVisible: boolean }) {
  return (
    <View style={styles.transactionSummary}>
      <Text style={styles.summarySectionTitle}>Money movement</Text>
      <Text style={styles.summaryScope}>{summary.scopeLabel}</Text>
      <View style={styles.movementRow}>
        <MovementMetric label="Money in" value={summary.moneyInMinorUnits} color="#007E5D" balanceVisible={balanceVisible} />
        <MovementMetric label="Money out" value={summary.moneyOutMinorUnits} color="#111827" balanceVisible={balanceVisible} />
        <MovementMetric label="Net" value={summary.netMovementMinorUnits} color={summary.netMovementMinorUnits >= 0 ? "#007E5D" : "#B93A2B"} balanceVisible={balanceVisible} />
      </View>
      <Text style={styles.coverageText}>{summary.coverageLabel}</Text>
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
  fromDateInput,
  toDateInput,
  onFromDateChange,
  onToDateChange,
  onSetFilter,
  onApplyCustomDate,
  onClearFilters,
  hasActiveFilter,
}: {
  filters: TransactionFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  fromDateInput: string;
  toDateInput: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onSetFilter: <Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) => void;
  onApplyCustomDate: () => void;
  onClearFilters: () => void;
  hasActiveFilter: boolean;
}) {
  const appliedFilters: { label: string; clear: () => void }[] = [];
  if (searchInput) appliedFilters.push({ label: `Search: ${searchInput}`, clear: () => onSearchChange("") });
  if (filters.period && filters.period !== "all") appliedFilters.push({ label: filters.period === "this-month" ? "This month" : filters.period === "last-month" ? "Last month" : "Custom range", clear: () => { onSetFilter("period", "all"); onFromDateChange(""); onToDateChange(""); } });
  if (filters.direction && filters.direction !== "all") appliedFilters.push({ label: filters.direction === "credit" ? "Money in" : "Money out", clear: () => onSetFilter("direction", "all") });
  if (filters.category && filters.category !== "all") appliedFilters.push({ label: filters.category, clear: () => onSetFilter("category", "all") });
  if (filters.status && filters.status !== "all") appliedFilters.push({ label: filters.status, clear: () => onSetFilter("status", "all") });
  if (filters.channel && filters.channel !== "all") appliedFilters.push({ label: filters.channel, clear: () => onSetFilter("channel", "all") });

  return (
    <View style={styles.filtersPanel}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color="#7B8492" />
        <TextInput
          accessibilityLabel="Search transactions"
          value={searchInput}
          onChangeText={onSearchChange}
          placeholder="Search merchant, description, reference"
          placeholderTextColor="#98A1AE"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchInput ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onSearchChange("")}><Ionicons name="close-circle" size={19} color="#98A1AE" /></Pressable> : null}
      </View>

      <FilterLine label="Period">
        <FilterChip label="All time" selected={!filters.period || filters.period === "all"} onPress={() => onSetFilter("period", "all")} />
        <FilterChip label="This month" selected={filters.period === "this-month"} onPress={() => onSetFilter("period", "this-month")} />
        <FilterChip label="Last month" selected={filters.period === "last-month"} onPress={() => onSetFilter("period", "last-month")} />
        <FilterChip label="Custom" selected={filters.period === "custom"} onPress={() => onSetFilter("period", "custom")} />
      </FilterLine>
      {filters.period === "custom" ? (
        <View style={styles.dateInputRow}>
          <TextInput accessibilityLabel="Start date" value={fromDateInput} onChangeText={onFromDateChange} placeholder="YYYY-MM-DD" placeholderTextColor="#98A1AE" style={styles.dateInput} />
          <Text style={styles.dateSeparator}>to</Text>
          <TextInput accessibilityLabel="End date" value={toDateInput} onChangeText={onToDateChange} placeholder="YYYY-MM-DD" placeholderTextColor="#98A1AE" style={styles.dateInput} />
          <Pressable accessibilityRole="button" accessibilityLabel="Apply custom date range" onPress={onApplyCustomDate} style={({ pressed }) => [styles.applyDateButton, pressed && styles.pressed]}><Text style={styles.applyDateText}>Apply</Text></Pressable>
        </View>
      ) : null}
      <FilterLine label="Direction">
        <FilterChip label="All" selected={!filters.direction || filters.direction === "all"} onPress={() => onSetFilter("direction", "all")} />
        <FilterChip label="Money in" selected={filters.direction === "credit"} onPress={() => onSetFilter("direction", "credit")} />
        <FilterChip label="Money out" selected={filters.direction === "debit"} onPress={() => onSetFilter("direction", "debit")} />
      </FilterLine>
      <FilterLine label="Category">
        <FilterChip label="All" selected={!filters.category || filters.category === "all"} onPress={() => onSetFilter("category", "all")} />
        {TRANSACTION_CATEGORIES.slice(0, 6).map((category) => <FilterChip key={category} label={category} selected={filters.category === category} onPress={() => onSetFilter("category", category)} />)}
      </FilterLine>
      <FilterLine label="Status">
        <FilterChip label="All" selected={!filters.status || filters.status === "all"} onPress={() => onSetFilter("status", "all")} />
        {TRANSACTION_STATUSES.map((status) => <FilterChip key={status} label={status} selected={filters.status === status} onPress={() => onSetFilter("status", status)} />)}
      </FilterLine>
      <FilterLine label="Channel">
        <FilterChip label="All" selected={!filters.channel || filters.channel === "all"} onPress={() => onSetFilter("channel", "all")} />
        {TRANSACTION_CHANNELS.slice(0, 5).map((channel) => <FilterChip key={channel} label={channel} selected={filters.channel === channel} onPress={() => onSetFilter("channel", channel)} />)}
      </FilterLine>
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
    </View>
  );
}

function FilterLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterLine}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        {children}
      </ScrollView>
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

function DetailsSectionContent({ account, isBalanceVisible, onEditPreferences, onToggleVisibility, onSetPrimary }: { account: BankAccount; isBalanceVisible: boolean; onEditPreferences: () => void; onToggleVisibility: () => void; onSetPrimary: () => void }) {
  return (
    <View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Account information</Text>
      <Text style={styles.sectionDescription}>Bank-provided account facts and customer-owned preferences.</Text>
      <View style={styles.infoCard}>
        <InfoRow label="Account holder" value={account.holderDisplayName} />
        <InfoRow label="Account type" value={account.name} />
        <InfoRow label="Masked account number" value={`•••• ${account.lastFour}`} />
        <InfoRow label="Branch" value={account.branch} />
        <InfoRow label="IFSC" value={account.ifsc} />
        <InfoRow label="Currency" value={account.currency} />
        <InfoRow label="Opening date" value={account.openingDate ? formatDate(account.openingDate) : undefined} />
        <InfoRow label="Ownership / operating mode" value={account.ownershipMode} />
        <InfoRow label="Status" value={accountStatusLabel(account.status)} last />
      </View>

      {account.fixedDeposit ? <FixedDepositDetailsContent account={account} isBalanceVisible={isBalanceVisible} /> : null}
      {account.recurringDeposit ? <RecurringDepositDetailsContent account={account} isBalanceVisible={isBalanceVisible} /> : null}

      <View style={styles.infoCard}>
        <View style={styles.cardHeaderRow}><Text style={styles.cardTitle}>Preferences</Text><Ionicons name="options-outline" size={20} color={accountColors.brandGreenDark} /></View>
        <PreferenceRow label="Nickname" value={account.nickname ?? "Not set"} onPress={onEditPreferences} />
        <PreferenceRow label="Balance visibility" value={isBalanceVisible ? "Shown" : "Hidden"} onPress={onToggleVisibility} />
        {account.capabilities.canSetPrimary ? <PreferenceRow label="Primary payment account" value={account.isPrimary ? "Yes" : "No"} onPress={account.isPrimary ? undefined : onSetPrimary} last /> : null}
      </View>
    </View>
  );
}

function FixedDepositDetailsContent({ account, isBalanceVisible }: { account: BankAccount; isBalanceVisible: boolean }) {
  const details = account.fixedDeposit!;
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>Fixed deposit details</Text>
      <InfoRow label="Principal" value={isBalanceVisible ? formatIndianMinorUnits(details.principal.minorUnits) : "Hidden"} />
      <InfoRow label="Reported current value" value={details.reportedCurrentValue && isBalanceVisible ? formatIndianMinorUnits(details.reportedCurrentValue.minorUnits) : details.reportedCurrentValue ? "Hidden" : undefined} />
      <InfoRow label="Start date" value={formatDate(details.startDate)} />
      <InfoRow label="Maturity date" value={details.maturityDate ? formatMaturityDate(details.maturityDate) : undefined} />
      <InfoRow label="Maturity value" value={details.maturityValue && isBalanceVisible ? formatIndianMinorUnits(details.maturityValue.minorUnits) : details.maturityValue ? "Hidden" : undefined} />
      {details.interestRate ? <InfoRow label="Interest rate" value={details.interestRate} last /> : null}
    </View>
  );
}

function RecurringDepositDetailsContent({ account, isBalanceVisible }: { account: BankAccount; isBalanceVisible: boolean }) {
  const details = account.recurringDeposit!;
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>Recurring deposit details</Text>
      <InfoRow label="Contribution amount" value={isBalanceVisible ? formatIndianMinorUnits(details.contributionAmount.minorUnits) : "Hidden"} />
      <InfoRow label="Contribution frequency" value={details.contributionFrequency} />
      <InfoRow label="Contributions recorded" value={String(details.contributionsRecorded)} />
      <InfoRow label="Reported balance" value={isBalanceVisible ? formatIndianMinorUnits(details.reportedBalance.minorUnits) : "Hidden"} />
      <InfoRow label="Start date" value={formatDate(details.startDate)} />
      <InfoRow label="Maturity date" value={details.maturityDate ? formatMaturityDate(details.maturityDate) : undefined} />
      <InfoRow label="Next contribution" value={details.nextContributionDate ? formatDate(details.nextContributionDate) : undefined} last />
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
      <Text accessibilityRole="header" style={styles.sectionTitle}>Documents</Text>
      <Text style={styles.sectionDescription}>Generated summaries are useful for review, but are not official bank statements.</Text>
      {loadState === "loading" ? <TransactionSkeleton /> : loadState === "error" ? <StateCard title="Documents unavailable" description="Please try again later." /> : documents.map((document) => (
        <View key={document.id} style={styles.documentCard}>
          <View style={styles.documentIcon}><Ionicons name="document-text-outline" size={23} color={accountColors.brandGreenDark} /></View>
          <View style={styles.documentContent}><Text style={styles.documentTitle}>{document.title}</Text><Text style={styles.documentMeta}>{document.period} · {document.source}</Text><Text style={styles.documentDescription}>{document.description}</Text></View>
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Export transaction summary as CSV" accessibilityState={{ busy: exportState === "loading" }} disabled={exportState === "loading"} onPress={onExport} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, exportState === "loading" && styles.disabledButton]}>
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

function StateCard({ title, description, actionLabel, onAction, compact = false }: { title: string; description: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  return <View style={[styles.stateCard, compact && styles.compactStateCard]}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDescription}>{description}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: accountColors.background },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", paddingTop: 17 },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: accountColors.textPrimary, fontSize: 16, fontWeight: "700" },
  switchButton: { minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: accountColors.brandGreenSoft },
  switchText: { color: accountColors.brandGreenDark, fontSize: 14, fontWeight: "700" },
  summaryCard: { marginTop: 13, padding: 20, borderRadius: 24, backgroundColor: accountColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: accountColors.border, ...softCardShadow },
  summaryTopRow: { flexDirection: "row", alignItems: "center" },
  summaryIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: accountColors.brandGreenSoft },
  summaryHeading: { flex: 1, minWidth: 0, marginLeft: 13, marginRight: 7 },
  productLabel: { color: accountColors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  accountTitle: { marginTop: 2, color: accountColors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: "700" },
  maskedNumber: { marginTop: 3, color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: accountColors.brandGreenSoft },
  primaryBadgeText: { color: accountColors.brandGreenDark, fontSize: 11, fontWeight: "700" },
  summaryBalanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingBottom: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: accountColors.divider },
  summaryBalanceContent: { flex: 1, minWidth: 0 },
  balanceLabel: { color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  summaryBalance: { marginTop: 4, color: accountColors.textPrimary, fontSize: 30, lineHeight: 37, fontWeight: "700" },
  eyeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  summaryMetaGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 13, columnGap: 15, marginTop: 16 },
  summaryMeta: { minWidth: 100, flexGrow: 1 },
  summaryMetaLabel: { color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  summaryMetaValue: { marginTop: 2, color: accountColors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  updatedText: { marginTop: 16, color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 15 },
  actionButton: { minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 6, paddingHorizontal: 13, borderRadius: 12, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.brandGreenBorder },
  actionLabel: { color: accountColors.brandGreenDark, fontSize: 13, fontWeight: "700" },
  tabs: { flexDirection: "row", marginTop: 25, borderBottomWidth: 1, borderBottomColor: accountColors.border },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  selectedTab: { borderBottomColor: accountColors.brandGreenDark },
  tabText: { color: accountColors.textSecondary, fontSize: 14, fontWeight: "600" },
  selectedTabText: { color: accountColors.brandGreenDark, fontWeight: "700" },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 },
  sectionHeadingContent: { flex: 1, minWidth: 0 },
  sectionTitle: { color: accountColors.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: "700" },
  sectionDescription: { marginTop: 4, color: accountColors.textSecondary, fontSize: 13, lineHeight: 19 },
  transactionSummary: { marginTop: 16, padding: 16, borderRadius: 17, backgroundColor: accountColors.brandGreenSoft },
  summarySectionTitle: { color: accountColors.textPrimary, fontSize: 15, fontWeight: "700" },
  summaryScope: { marginTop: 3, color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  movementRow: { flexDirection: "row", columnGap: 8, marginTop: 15 },
  movementMetric: { flex: 1, minWidth: 0 },
  movementLabel: { color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  movementValue: { marginTop: 3, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  coverageText: { marginTop: 13, color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  filtersPanel: { marginTop: 16, padding: 14, borderRadius: 17, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border },
  searchBox: { minHeight: 46, flexDirection: "row", alignItems: "center", columnGap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: accountColors.border },
  searchInput: { flex: 1, minWidth: 0, color: accountColors.textPrimary, fontSize: 14, paddingVertical: 9 },
  filterLine: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  filterLabel: { width: 66, color: accountColors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterChips: { columnGap: 7, paddingRight: 3 },
  smallFilterChip: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 17, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: accountColors.border },
  smallFilterChipSelected: { backgroundColor: accountColors.brandGreenDark, borderColor: accountColors.brandGreenDark },
  smallFilterText: { color: accountColors.textSecondary, fontSize: 12, fontWeight: "600" },
  smallFilterTextSelected: { color: "#FFFFFF" },
  dateInputRow: { flexDirection: "row", alignItems: "center", columnGap: 5, marginTop: 9, marginLeft: 66 },
  dateInput: { flex: 1, minWidth: 0, minHeight: 38, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: accountColors.border, color: accountColors.textPrimary, fontSize: 11 },
  dateSeparator: { color: accountColors.textSecondary, fontSize: 11 },
  applyDateButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: 9, backgroundColor: accountColors.brandGreenSoft },
  applyDateText: { color: accountColors.brandGreenDark, fontSize: 11, fontWeight: "700" },
  appliedFiltersRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accountColors.divider },
  appliedFiltersBlock: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accountColors.divider },
  appliedChipList: { columnGap: 7, paddingRight: 3 },
  appliedChip: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: accountColors.brandOrangeSoft },
  appliedChipText: { color: accountColors.brandOrange, fontSize: 11, fontWeight: "700" },
  appliedLabel: { color: accountColors.textSecondary, fontSize: 12 },
  clearButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: 7 },
  clearButtonText: { color: accountColors.brandOrange, fontSize: 12, fontWeight: "700" },
  transactionCard: { marginTop: 15, paddingHorizontal: 13, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  paginationRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 9 },
  paginationText: { flex: 1, color: accountColors.textSecondary, fontSize: 11, lineHeight: 16 },
  paginationButtons: { flexDirection: "row", columnGap: 7 },
  paginationButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: accountColors.brandGreenSoft },
  disabledButton: { opacity: 0.52 },
  infoCard: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 13, paddingBottom: 9 },
  cardTitle: { color: accountColors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  infoRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12, paddingVertical: 9 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: accountColors.divider },
  infoLabel: { flex: 1, color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  infoValue: { flex: 1.15, color: accountColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "right" },
  preferenceRow: { minHeight: 54, flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 9 },
  preferenceText: { flex: 1, minWidth: 0 },
  documentCard: { flexDirection: "row", marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  documentIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: accountColors.brandGreenSoft },
  documentContent: { flex: 1, minWidth: 0, marginLeft: 12 },
  documentTitle: { color: accountColors.textPrimary, fontSize: 15, fontWeight: "700" },
  documentMeta: { marginTop: 3, color: accountColors.textSecondary, fontSize: 12 },
  documentDescription: { marginTop: 7, color: accountColors.textSecondary, fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 18, paddingHorizontal: 18, borderRadius: 12, backgroundColor: accountColors.brandGreenDark },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  successText: { marginTop: 10, color: accountColors.brandGreenDark, fontSize: 12, textAlign: "center" },
  formError: { marginTop: 9, color: "#B93A2B", fontSize: 12, lineHeight: 17 },
  stateCard: { alignItems: "center", justifyContent: "center", marginTop: 16, padding: 23, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border },
  compactStateCard: { marginTop: 15 },
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
