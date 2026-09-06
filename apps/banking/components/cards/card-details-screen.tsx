import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaymentCardPreview, cardStatusLabel } from "@/components/cards/payment-card-preview";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import {
  checkCardOperationStatus,
  formatLimitInput,
  getCard,
  getCardFundingSummary,
  getCardTransactions,
  getCardControlDescription,
  parseLimitInput,
  reportCardLostOrStolen,
  updateCardChannelState,
  updateCardLimit,
  updateCardMasterState,
  updateCardNickname,
} from "@/services/cards-service";
import { getAccountPreference } from "@/services/accounts-service";
import type {
  CardChannelGroup,
  CardControl,
  CardControlOperation,
  CardMasterState,
  CardRecord,
  CardTransaction,
  CardTransactionFilters,
  CardTransactionPage,
  CardTransactionType,
} from "@/types/cards";

type DetailsSection = "activity" | "controls" | "details" | "billing";
type LoadState = "loading" | "ready" | "error";

const pageSections: { key: DetailsSection; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "controls", label: "Controls" },
  { key: "details", label: "Details" },
  { key: "billing", label: "Billing" },
];

const initialFilters: CardTransactionFilters = {
  period: "all",
  status: "all",
  transactionType: "all",
  category: "all",
};

const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#111827",
  secondary: "#6F7888",
  muted: "#98A1AE",
  green: "#007E5D",
  greenDark: "#006647",
  greenSoft: "#E9F5F2",
  orange: "#F45B2A",
  orangeSoft: "#FFF2EA",
  border: "#E8EBEF",
  danger: "#A62B32",
  dangerSoft: "#FDECEC",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nextKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function operationStatusLabel(status: CardControlOperation["status"]): string {
  switch (status) {
    case "confirmed": return "Confirmed";
    case "pending": return "Pending — status not confirmed";
    case "unknown": return "Unknown — status not confirmed";
    default: return "Not applied";
  }
}

function transactionTypeLabel(type: CardTransactionType): string {
  switch (type) {
    case "cash-withdrawal": return "Cash withdrawal";
    case "authorisation": return "Authorisation";
    case "purchase": return "Purchase";
    case "refund": return "Refund";
    case "reversal": return "Reversal";
    case "fee": return "Fee";
    case "repayment": return "Credit-card repayment";
    default: return "Declined attempt";
  }
}

function statusLabel(status: CardTransaction["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.loadingText}>Loading card details…</Text>
    </View>
  );
}

export function CardDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { cardId: rawCardId, section: rawSection, fromAccountId: rawFromAccountId } = useLocalSearchParams<{
    cardId?: string | string[];
    section?: string | string[];
    fromAccountId?: string | string[];
  }>();
  const cardId = firstParam(rawCardId);
  const fromAccountId = firstParam(rawFromAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const currentSection = pageSections.some((item) => item.key === firstParam(rawSection))
    ? firstParam(rawSection) as DetailsSection
    : "activity";
  const [card, setCard] = useState<CardRecord | null>(null);
  const [fundingSummary, setFundingSummary] = useState<Awaited<ReturnType<typeof getCardFundingSummary>> | null>(null);
  const [cardState, setCardState] = useState<LoadState>("loading");
  const [cardError, setCardError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CardTransactionPage | null>(null);
  const [transactionState, setTransactionState] = useState<LoadState>("loading");
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardTransactionFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [controlBusy, setControlBusy] = useState(false);
  const [lastOperation, setLastOperation] = useState<CardControlOperation | null>(null);
  const [masterConfirmation, setMasterConfirmation] = useState<CardMasterState | null>(null);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [limitDraft, setLimitDraft] = useState<{ id: string; value: string } | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState<"lost" | "stolen">("lost");
  const requestId = useRef(0);
  const transactionRequestId = useRef(0);

  const loadCard = useCallback(async (quiet = false) => {
    if (!cardId) {
      setCardState("error");
      setCardError("This card link is missing a card ID.");
      return;
    }
    const currentRequest = ++requestId.current;
    if (!quiet) setCardState("loading");
    setCardError(null);
    try {
      const [nextCard, nextFunding] = await Promise.all([
        getCard(cardId, { customerId }),
        getCardFundingSummary(cardId, { customerId }),
      ]);
      if (currentRequest !== requestId.current) return;
      if (!nextCard) {
        setCardState("error");
        setCardError("This card is unavailable or you do not have access to it.");
        setCard(null);
        return;
      }
      setCard(nextCard);
      setFundingSummary(nextFunding);
      if (nextFunding.type === "debit") {
        const preference = await getAccountPreference(nextFunding.account.id, { customerId });
        if (currentRequest === requestId.current) setBalanceVisible(preference.balanceVisible !== false);
      }
      setCardState("ready");
    } catch {
      if (currentRequest === requestId.current) {
        setCardState("error");
        setCardError("We couldn’t load this card. Please try again.");
      }
    }
  }, [cardId, customerId]);

  const loadTransactions = useCallback(async () => {
    if (!cardId || cardState !== "ready") return;
    const currentRequest = ++transactionRequestId.current;
    setTransactionState("loading");
    setTransactionError(null);
    try {
      const nextPage = await getCardTransactions(cardId, {
        customerId,
        filters: { ...filters, search: searchInput.trim() || undefined },
        page: pageNumber,
      });
      if (currentRequest !== transactionRequestId.current) return;
      setTransactions(nextPage);
      setTransactionState("ready");
    } catch (error) {
      if (currentRequest !== transactionRequestId.current) return;
      setTransactionState("error");
      setTransactionError(error instanceof Error ? error.message : "Transactions unavailable");
    }
  }, [cardId, cardState, customerId, filters, pageNumber, searchInput]);

  useEffect(() => {
    setFilters(initialFilters);
    setSearchInput("");
    setPageNumber(1);
    setTransactions(null);
    void loadCard();
  }, [cardId, loadCard]);

  useEffect(() => {
    if (currentSection === "activity") void loadTransactions();
  }, [currentSection, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (cardState === "ready") {
        void loadCard(true);
        if (currentSection === "activity") void loadTransactions();
      }
    }, [cardState, currentSection, loadCard, loadTransactions]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (fromAccountId) router.replace({ pathname: "/(app)/accounts/[accountId]", params: { accountId: fromAccountId } });
    else router.replace("/(app)/cards");
  };

  const changeSection = (section: DetailsSection) => {
    if (!cardId) return;
    router.replace({ pathname: "/(app)/cards/[cardId]", params: { cardId, section } });
  };

  const refreshAfterOperation = async (operation: CardControlOperation) => {
    setLastOperation(operation);
    if (operation.status === "confirmed") {
      await loadCard(true);
      if (currentSection === "activity") await loadTransactions();
    }
  };

  const applyMasterChange = async () => {
    if (!card || masterConfirmation === null || controlBusy) return;
    setControlBusy(true);
    try {
      const operation = await updateCardMasterState(card.id, masterConfirmation, {
        customerId,
        expectedRevision: card.sourceRevision,
        idempotencyKey: nextKey("master"),
      });
      setMasterConfirmation(null);
      await refreshAfterOperation(operation);
    } catch (error) {
      Alert.alert("Card change not applied", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setControlBusy(false);
    }
  };

  const applyChannelChange = async (control: CardControl, nextValue: boolean) => {
    if (!card || controlBusy || !control.supported) return;
    setControlBusy(true);
    try {
      const operation = await updateCardChannelState(card.id, control.group, control.channel, nextValue ? "enabled" : "disabled", {
        customerId,
        expectedRevision: card.sourceRevision,
        idempotencyKey: nextKey("channel"),
      });
      await refreshAfterOperation(operation);
    } catch (error) {
      Alert.alert("Usage setting not changed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setControlBusy(false);
    }
  };

  const applyLimitChange = async () => {
    if (!card || !limitDraft || controlBusy) return;
    setControlBusy(true);
    try {
      const amountMinorUnits = parseLimitInput(limitDraft.value);
      const operation = await updateCardLimit(card.id, limitDraft.id, amountMinorUnits, {
        customerId,
        expectedRevision: card.sourceRevision,
        idempotencyKey: nextKey("limit"),
      });
      setLimitDraft(null);
      await refreshAfterOperation(operation);
    } catch (error) {
      Alert.alert("Limit not changed", error instanceof Error ? error.message : "Please enter a valid limit.");
    } finally {
      setControlBusy(false);
    }
  };

  const checkOperation = async () => {
    if (!lastOperation || controlBusy) return;
    setControlBusy(true);
    try {
      const operation = await checkCardOperationStatus(lastOperation.id, { customerId });
      await refreshAfterOperation(operation);
    } catch (error) {
      Alert.alert("Status unavailable", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setControlBusy(false);
    }
  };

  const applyLostReport = async () => {
    if (!card || controlBusy) return;
    setControlBusy(true);
    try {
      const operation = await reportCardLostOrStolen(card.id, lostReason, {
        customerId,
        expectedRevision: card.sourceRevision,
        idempotencyKey: nextKey("hotlist"),
      });
      setLostModalOpen(false);
      await refreshAfterOperation(operation);
    } catch (error) {
      Alert.alert("Card was not blocked", error instanceof Error ? error.message : "Please contact support.");
    } finally {
      setControlBusy(false);
    }
  };

  const saveNickname = async () => {
    if (!card || controlBusy) return;
    setControlBusy(true);
    try {
      const nextCard = await updateCardNickname(card.id, nicknameDraft, { customerId });
      setCard(nextCard);
      setNicknameModalOpen(false);
    } catch (error) {
      Alert.alert("Nickname not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setControlBusy(false);
    }
  };

  const askCoach = () => {
    if (!card) return;
    router.push({ pathname: "/(app)/coach/chat", params: { cardId: card.id, period: filters.period ?? "all", source: "card-details" } });
  };

  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({ ios: 72 + insets.bottom, android: 66 + Math.max(insets.bottom, 10), default: 76 });

  if (cardState === "loading") return <LoadingScreen />;
  if (!card || cardState === "error") {
    return (
      <View style={styles.screen}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding, paddingTop: 12 }]}>
          <BackButton onPress={goBack} />
          <StateCard title="Card unavailable" description={cardError ?? "This card could not be found."} actionLabel="Back to Cards" onAction={() => router.replace("/(app)/cards")} />
        </View>
      </View>
    );
  }

  const isTemporarilyOff = card.lifecycleStatus === "temporarily-disabled";
  const canShowBilling = card.productKind === "credit" && card.capabilities.canViewStatements;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + tabBarHeight }]}>
        <View style={[styles.content, { maxWidth: isTablet ? 900 : undefined, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerRow}>
            <BackButton onPress={goBack} />
            <Pressable accessibilityRole="button" accessibilityLabel="Switch card" onPress={() => router.replace({ pathname: "/(app)/cards", params: { accountId: card.linkedAccountId } })} style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}>
              <Ionicons name="swap-vertical-outline" size={19} color={colors.greenDark} />
              <Text style={styles.switchText}>Switch card</Text>
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleColumn}>
              <Text accessibilityRole="header" style={styles.title}>{card.nickname ?? card.productName}</Text>
              <Text style={styles.subtitle}>{card.productKind === "unknown" ? "Card details" : `${card.productKind === "credit" ? "Credit" : "Debit"} card · ${card.formFactor}`}</Text>
            </View>
            <Text style={styles.lastFour}>•••• {card.lastFour}</Text>
          </View>

          <PaymentCardPreview card={card} />

          <FinancialSummary card={card} summary={fundingSummary} balanceVisible={balanceVisible} onToggleBalance={() => setBalanceVisible((visible) => !visible)} />

          <View style={styles.primaryActions}>
            {card.capabilities.canTemporarilyDisable || isTemporarilyOff ? (
              <PrimaryAction
                icon={isTemporarilyOff ? "lock-open-outline" : "lock-closed-outline"}
                label={isTemporarilyOff ? "Turn card on" : "Turn card off"}
                disabled={controlBusy || card.lifecycleStatus === "blocked" || card.lifecycleStatus === "expired"}
                onPress={() => setMasterConfirmation(isTemporarilyOff ? "on" : "off")}
              />
            ) : null}
            {card.capabilities.canManageLimits ? <PrimaryAction icon="options-outline" label="Manage limits" onPress={() => changeSection("controls")} /> : null}
            {card.capabilities.canHotlist ? <PrimaryAction icon="warning-outline" label="Report lost" destructive onPress={() => setLostModalOpen(true)} /> : null}
          </View>

          {lastOperation && lastOperation.status !== "confirmed" ? (
            <View style={[styles.operationBanner, lastOperation.status === "failed" ? styles.operationFailed : styles.operationPending]} accessibilityRole="alert">
              <Ionicons name={lastOperation.status === "failed" ? "close-circle-outline" : "time-outline"} size={19} color={lastOperation.status === "failed" ? colors.danger : colors.orange} />
              <View style={styles.operationText}>
                <Text style={styles.operationTitle}>{operationStatusLabel(lastOperation.status)}</Text>
                <Text style={styles.operationDescription}>The last requested change is not shown as applied until its status is confirmed.</Text>
              </View>
              {lastOperation.status === "pending" || lastOperation.status === "unknown" ? <Pressable accessibilityRole="button" accessibilityLabel="Check card operation status" onPress={() => void checkOperation} style={styles.checkButton}><Text style={styles.checkButtonText}>Check</Text></Pressable> : null}
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs} accessibilityRole="tablist">
            {pageSections.map((section) => {
              if (section.key === "billing" && !canShowBilling) return null;
              const selected = section.key === currentSection;
              return <Pressable key={section.key} accessibilityRole="tab" accessibilityLabel={section.label} accessibilityState={{ selected }} onPress={() => changeSection(section.key)} style={({ pressed }) => [styles.sectionTab, selected && styles.sectionTabSelected, pressed && styles.pressed]}><Text style={[styles.sectionTabText, selected && styles.sectionTabTextSelected]}>{section.label}</Text></Pressable>;
            })}
          </ScrollView>

          {currentSection === "activity" ? (
            <ActivitySection
              transactions={transactions}
              loadState={transactionState}
              error={transactionError}
              filters={filters}
              search={searchInput}
              pageNumber={pageNumber}
              onSearch={setSearchInput}
              onPage={setPageNumber}
              onSetFilter={(key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPageNumber(1); }}
              onTransaction={(transaction) => router.push({ pathname: "/(app)/cards/transaction/[transactionId]", params: { cardId: card.id, transactionId: transaction.id } })}
              onAskCoach={askCoach}
            />
          ) : currentSection === "controls" ? (
            <ControlsSection card={card} busy={controlBusy} onChannelChange={(control, value) => void applyChannelChange(control, value)} onLimitEdit={(id, value) => setLimitDraft({ id, value: formatLimitInput(value) })} />
          ) : currentSection === "details" ? (
            <CardDetailsMetadataSection card={card} onEditNickname={() => { setNicknameDraft(card.nickname ?? ""); setNicknameModalOpen(true); }} />
          ) : (
            <BillingSection card={card} />
          )}
        </View>
      </ScrollView>

      <Modal visible={masterConfirmation !== null} transparent animationType="slide" onRequestClose={() => setMasterConfirmation(null)}>
        <ModalShell title={masterConfirmation === "off" ? "Turn card off?" : "Turn card on?"} onClose={() => setMasterConfirmation(null)}>
          <Text style={styles.modalLead}>{card.productName} ending in {card.lastFour}</Text>
          <Text style={styles.modalBody}>{masterConfirmation === "off" ? "This will temporarily stop supported new card usage. Pending, recurring, offline, or token-related transactions may not be affected. Your saved channel preferences will be kept." : "This will restore the card’s master switch. Previously saved online, international, and contactless preferences will not be changed."}</Text>
          <View style={styles.demoNotice}><Ionicons name="information-circle-outline" size={18} color={colors.greenDark} /><Text style={styles.demoNoticeText}>Demo mode — no issuer card is changed.</Text></View>
          <ModalButton label={controlBusy ? "Applying…" : masterConfirmation === "off" ? "Turn card off" : "Turn card on"} onPress={() => void applyMasterChange()} disabled={controlBusy} />
        </ModalShell>
      </Modal>

      <Modal visible={limitDraft !== null} transparent animationType="slide" onRequestClose={() => setLimitDraft(null)}>
        <ModalShell title="Review limit change" onClose={() => setLimitDraft(null)}>
          {limitDraft ? <LimitReview card={card} draft={limitDraft} onChange={(value) => setLimitDraft({ ...limitDraft, value })} onApply={() => void applyLimitChange()} busy={controlBusy} /> : null}
        </ModalShell>
      </Modal>

      <Modal visible={lostModalOpen} transparent animationType="slide" onRequestClose={() => setLostModalOpen(false)}>
        <ModalShell title="Report lost or stolen" onClose={() => setLostModalOpen(false)}>
          <Text style={styles.modalLead}>{card.productName} ending in {card.lastFour}</Text>
          <Text style={styles.modalBody}>Permanent blocking cannot be undone by turning the card back on. This demo will not block a real bank card.</Text>
          <Text style={styles.fieldLabel}>Reason</Text>
          <View style={styles.reasonRow}><ChoiceButton label="Lost" selected={lostReason === "lost"} onPress={() => setLostReason("lost")} /><ChoiceButton label="Stolen" selected={lostReason === "stolen"} onPress={() => setLostReason("stolen")} /></View>
          <ModalButton label={controlBusy ? "Submitting…" : "Permanently block demo card"} destructive onPress={() => void applyLostReport()} disabled={controlBusy} />
        </ModalShell>
      </Modal>

      <Modal visible={nicknameModalOpen} transparent animationType="slide" onRequestClose={() => setNicknameModalOpen(false)}>
        <ModalShell title="Card nickname" onClose={() => setNicknameModalOpen(false)}>
          <Text style={styles.modalBody}>This customer preference changes how the card is labelled in this app. It does not edit issuer records.</Text>
          <TextInput accessibilityLabel="Card nickname" value={nicknameDraft} onChangeText={setNicknameDraft} maxLength={40} placeholder={card.productName} style={styles.textInput} />
          <Text style={styles.characterHint}>{nicknameDraft.length}/40 characters</Text>
          <ModalButton label={controlBusy ? "Saving…" : "Save nickname"} onPress={() => void saveNickname()} disabled={controlBusy} />
        </ModalShell>
      </Modal>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>;
}

function FinancialSummary({ card, summary, balanceVisible, onToggleBalance }: { card: CardRecord; summary: Awaited<ReturnType<typeof getCardFundingSummary>> | null; balanceVisible: boolean; onToggleBalance: () => void }) {
  if (!summary || summary.type === "unavailable") return <View style={styles.limitations}><Ionicons name="information-circle-outline" size={19} color={colors.orange} /><Text style={styles.limitationText}>Funding information is unavailable for this product. No card balance has been inferred.</Text></View>;
  if (summary.type === "debit") {
    const account = summary.account;
    const available = account.availableBalanceMinorUnits ?? account.balanceMinorUnits;
    return <View style={styles.financialCard}><View style={styles.financialHeader}><View><Text style={styles.eyebrow}>Linked payment account</Text><Text style={styles.financialTitle}>{account.nickname ?? account.name} •••• {account.lastFour}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={balanceVisible ? "Hide card linked account balance" : "Show card linked account balance"} onPress={onToggleBalance} style={styles.eyeButton}><Ionicons name={balanceVisible ? "eye-outline" : "eye-off-outline"} size={20} color={colors.secondary} /></Pressable></View><Text style={styles.financialLabel}>Available account balance</Text><Text style={styles.financialValue}>{balanceVisible ? formatIndianMinorUnits(available) : "₹ ••••••••"}</Text><Text style={styles.sourceText}>{account.sourceEnvironment} · Updated {formatDate(account.lastSuccessfulUpdate)}</Text><Text style={styles.scopeText}>This is the linked account balance, not a separate debit-card balance.</Text></View>;
  }
  const facility = summary.facility;
  return <View style={styles.financialCard}><View style={styles.financialHeader}><View><Text style={styles.eyebrow}>Shared credit facility</Text><Text style={styles.financialTitle}>{facility.facilityLabel}</Text></View><View style={styles.sharedBadge}><Text style={styles.sharedBadgeText}>Shared</Text></View></View><View style={styles.creditGrid}><Metric label="Current outstanding" value={facility.currentOutstandingMinorUnits} /><Metric label="Available credit" value={facility.availableCreditMinorUnits} /><Metric label="Approved limit" value={facility.approvedCreditLimitMinorUnits} /></View><Text style={styles.scopeText}>Billing and outstanding amounts refer to the entire facility, not only this physical card.</Text></View>;
}

function Metric({ label, value }: { label: string; value?: number }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value === undefined ? "Unavailable" : formatIndianMinorUnits(value)}</Text></View>; }

function PrimaryAction({ icon, label, onPress, disabled = false, destructive = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryAction, destructive && styles.primaryActionDestructive, disabled && styles.disabledAction, pressed && styles.pressed]}><Ionicons name={icon} size={21} color={destructive ? colors.danger : colors.greenDark} /><Text style={[styles.primaryActionText, destructive && styles.destructiveText]}>{label}</Text></Pressable>; }

function ActivitySection({ transactions, loadState, error, filters, search, pageNumber, onSearch, onPage, onSetFilter, onTransaction, onAskCoach }: { transactions: CardTransactionPage | null; loadState: LoadState; error: string | null; filters: CardTransactionFilters; search: string; pageNumber: number; onSearch: (value: string) => void; onPage: (page: number) => void; onSetFilter: <Key extends keyof CardTransactionFilters>(key: Key, value: CardTransactionFilters[Key]) => void; onTransaction: (transaction: CardTransaction) => void; onAskCoach: () => void }) {
  const hasFilters = Boolean(search || (filters.period && filters.period !== "all") || (filters.status && filters.status !== "all") || (filters.transactionType && filters.transactionType !== "all"));
  return <View><View style={styles.sectionHeading}><View style={styles.sectionHeadingText}><Text accessibilityRole="header" style={styles.sectionTitle}>Card activity</Text><Text style={styles.sectionDescription}>Transactions attributed to this card only. Account transfers are not included automatically.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Ask Coach about this card’s spending" onPress={onAskCoach} style={styles.coachButton}><Ionicons name="sparkles-outline" size={18} color={colors.greenDark} /><Text style={styles.coachButtonText}>Ask Coach</Text></Pressable></View>{transactions ? <SpendingSummary summary={transactions.summary} /> : null}<View style={styles.filtersPanel}><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.secondary} /><TextInput accessibilityLabel="Search card transactions" value={search} onChangeText={onSearch} placeholder="Search merchant or reference" placeholderTextColor={colors.muted} style={styles.searchInput} /></View><View style={styles.chipRowWrap}><FilterChip label="All time" selected={!filters.period || filters.period === "all"} onPress={() => onSetFilter("period", "all")} /><FilterChip label="This month" selected={filters.period === "this-month"} onPress={() => onSetFilter("period", "this-month")} /><FilterChip label="Pending" selected={filters.status === "pending"} onPress={() => onSetFilter("status", filters.status === "pending" ? "all" : "pending")} /><FilterChip label="Purchases" selected={filters.transactionType === "purchase"} onPress={() => onSetFilter("transactionType", filters.transactionType === "purchase" ? "all" : "purchase")} /></View></View>{loadState === "loading" && !transactions ? <ActivityIndicator color={colors.green} style={styles.loader} /> : loadState === "error" ? <StateCard title="Activity unavailable" description={error ?? "Please try again."} /> : !transactions || transactions.totalItems === 0 ? <StateCard title={hasFilters ? "No matching transactions" : "No card transactions yet"} description={hasFilters ? "Try changing the search or filters." : "Card activity will appear when records are available from the provider."} /> : <View style={styles.transactionCard}>{transactions.items.map((item) => <CardTransactionRow key={item.id} transaction={item} onPress={() => onTransaction(item)} />)}<View style={styles.paginationRow}><Text style={styles.paginationText}>{transactions.totalItems} records · page {transactions.page} of {transactions.totalPages}</Text><View style={styles.paginationButtons}><Pressable accessibilityRole="button" accessibilityLabel="Previous card transaction page" disabled={pageNumber <= 1} onPress={() => onPage(Math.max(1, pageNumber - 1))} style={({ pressed }) => [styles.paginationButton, pageNumber <= 1 && styles.disabledAction, pressed && styles.pressed]}><Ionicons name="chevron-back" size={18} color={pageNumber <= 1 ? colors.muted : colors.greenDark} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next card transaction page" disabled={transactions.page >= transactions.totalPages} onPress={() => onPage(Math.min(transactions.totalPages, pageNumber + 1))} style={({ pressed }) => [styles.paginationButton, transactions.page >= transactions.totalPages && styles.disabledAction, pressed && styles.pressed]}><Ionicons name="chevron-forward" size={18} color={transactions.page >= transactions.totalPages ? colors.muted : colors.greenDark} /></Pressable></View></View></View>}</View>;
}

function SpendingSummary({ summary }: { summary: CardTransactionPage["summary"] }) { return <View style={styles.spendingSummary}><Text style={styles.eyebrow}>Card spending</Text><Text style={styles.summaryScope}>{summary.scopeLabel}</Text><View style={styles.creditGrid}><Metric label="Purchases" value={summary.postedPurchasesMinorUnits} /><Metric label="Cash withdrawals" value={summary.postedCashWithdrawalsMinorUnits} /><Metric label="Fees" value={summary.postedFeesMinorUnits} /></View><Text style={styles.coverageText}>{summary.coverageLabel}</Text></View>; }

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}><Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text></Pressable>; }

function CardTransactionRow({ transaction, onPress }: { transaction: CardTransaction; onPress: () => void }) { const isCredit = transaction.direction === "credit"; return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${transaction.merchant ?? transaction.description}, ${formatIndianMinorUnits(transaction.amountMinorUnits)}`} onPress={onPress} style={({ pressed }) => [styles.transactionRow, pressed && styles.pressed]}><View style={styles.transactionIcon}><Ionicons name={transaction.transactionType === "cash-withdrawal" ? "cash-outline" : transaction.transactionType === "refund" ? "return-down-back-outline" : transaction.transactionType === "fee" ? "receipt-outline" : "cart-outline"} size={21} color={isCredit ? colors.greenDark : colors.orange} /></View><View style={styles.transactionText}><Text style={styles.transactionTitle} numberOfLines={1}>{transaction.merchant ?? transaction.description}</Text><Text style={styles.transactionMeta} numberOfLines={1}>{transactionTypeLabel(transaction.transactionType)} · {formatDate(transaction.transactionDate)}</Text><View style={styles.statusLine}><Text style={styles.transactionStatus}>{statusLabel(transaction.status)}</Text>{transaction.category ? <Text style={styles.transactionCategory}>{transaction.category}</Text> : null}</View></View><View style={styles.transactionAmount}><Text style={[styles.amountText, isCredit && styles.amountCredit]}>{isCredit ? "+" : "−"}{formatIndianMinorUnits(transaction.amountMinorUnits)}</Text><Ionicons name="chevron-forward" size={18} color="#B7C0C8" /></View></Pressable>; }

function ControlsSection({ card, busy, onChannelChange, onLimitEdit }: { card: CardRecord; busy: boolean; onChannelChange: (control: CardControl, value: boolean) => void; onLimitEdit: (id: string, value: number) => void }) {
  const groups: CardChannelGroup[] = ["domestic", "international"];
  return <View><View style={styles.sectionHeading}><View style={styles.sectionHeadingText}><Text accessibilityRole="header" style={styles.sectionTitle}>Card controls</Text><Text style={styles.sectionDescription}>Confirmed provider settings. A master switch can override channel use without deleting saved preferences.</Text></View>{busy ? <ActivityIndicator color={colors.green} /> : null}</View><View style={styles.controlCard}><ControlRow label={card.lifecycleStatus === "temporarily-disabled" ? "Card temporarily off" : "Card master switch"} description={card.lifecycleStatus === "temporarily-disabled" ? "Supported new card usage is currently paused." : "The master card state controls supported usage."} value={card.lifecycleStatus === "active"} disabled={true} onValueChange={() => undefined} /><View style={styles.effectiveNote}><Ionicons name="information-circle-outline" size={17} color={colors.orange} /><Text style={styles.effectiveNoteText}>{card.lifecycleStatus === "temporarily-disabled" ? "Channel preferences remain saved while the card is off." : "Channel settings below are the effective settings when the card is on."}</Text></View></View>{groups.map((group) => { const supportedGroup = group === "domestic" ? card.capabilities.canManageDomesticUsage : card.capabilities.canManageInternationalUsage; const controls = card.controls.filter((item) => item.group === group); if (!supportedGroup && controls.every((item) => !item.supported)) return null; return <View key={group} style={styles.controlGroup}><Text style={styles.groupTitle}>{group === "domestic" ? "Domestic" : "International"}</Text><View style={styles.controlCard}>{controls.map((control) => <ControlRow key={`${control.group}:${control.channel}`} label={control.channel === "atm" ? "ATM withdrawals" : control.channel === "in-store" ? "In-store purchases" : control.channel === "online" ? "Online purchases" : "Contactless payments"} description={control.supported ? getCardControlDescription(control.group, control.channel) : control.unavailableReason ?? "Unavailable"} value={control.state === "enabled"} disabled={!control.supported || !supportedGroup || card.lifecycleStatus !== "active"} onValueChange={(value) => onChannelChange(control, value)} />)}</View></View>; })}<View style={styles.controlGroup}><View style={styles.groupHeadingRow}><View><Text style={styles.groupTitle}>Transaction limits</Text><Text style={styles.sectionDescription}>Issuer constraints are shown for each supported limit.</Text></View></View>{card.limits.length === 0 ? <StateCard title="Limits unavailable" description="This card does not supply editable transaction limits." compact /> : <View style={styles.controlCard}>{card.limits.map((limit) => <View key={limit.id} style={styles.limitRow}><View style={styles.limitText}><Text style={styles.limitTitle}>{limit.label}</Text><Text style={styles.limitMeta}>{limit.period === "daily" ? "Daily" : "Per transaction"} · Maximum {formatIndianMinorUnits(limit.maximumMinorUnits)} · {limit.currency}</Text>{limit.resetTimeZone ? <Text style={styles.limitMeta}>Resets in {limit.resetTimeZone}</Text> : null}</View><View style={styles.limitValue}><Text style={styles.limitAmount}>{formatIndianMinorUnits(limit.amountMinorUnits)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${limit.label} limit`} onPress={() => onLimitEdit(limit.id, limit.amountMinorUnits)} style={styles.editButton}><Text style={styles.editButtonText}>Edit</Text></Pressable></View></View>)}</View>}</View></View>;
}

function ControlRow({ label, description, value, disabled, onValueChange }: { label: string; description: string; value: boolean; disabled: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.controlRow}><View style={styles.controlText}><Text style={styles.controlTitle}>{label}</Text><Text style={styles.controlDescription}>{description}</Text></View><Switch accessibilityLabel={label} accessibilityState={{ disabled, checked: value }} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ false: "#D6DCE1", true: "#9BD3C5" }} thumbColor={value ? colors.green : "#FFFFFF"} />{disabled && !value ? <Text style={styles.unavailableLabel}>Unavailable</Text> : null}</View>; }

function CardDetailsMetadataSection({ card, onEditNickname }: { card: CardRecord; onEditNickname: () => void }) { const metadata = [["Product", card.productName], ["Product type", card.productKind === "unknown" ? "Unavailable" : card.productKind === "credit" ? "Credit" : "Debit"], ["Form factor", card.formFactor], ["Card number", `Ending in ${card.lastFour}`], ["Cardholder", card.holderDisplayName ?? "Unavailable"], ["Network", card.network ?? "Unavailable"], ["Expiry", card.expiryMonth && card.expiryYear ? `${String(card.expiryMonth).padStart(2, "0")}/${card.expiryYear}` : "Unavailable"], ["Status", cardStatusLabel(card.lifecycleStatus)], ["Data source", card.sourceEnvironment]]; return <View><View style={styles.sectionHeading}><View style={styles.sectionHeadingText}><Text accessibilityRole="header" style={styles.sectionTitle}>Card details</Text><Text style={styles.sectionDescription}>Useful masked metadata and the capabilities supplied for this card.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Edit card nickname" onPress={onEditNickname} style={styles.coachButton}><Ionicons name="create-outline" size={17} color={colors.greenDark} /><Text style={styles.coachButtonText}>Nickname</Text></Pressable></View><View style={styles.detailsCard}>{metadata.map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}<View style={styles.detailDivider} /><Text style={styles.capabilityHeading}>Supported services</Text><Capability label="Temporary on/off" enabled={card.capabilities.canTemporarilyDisable || card.capabilities.canReenable} /><Capability label="Usage controls" enabled={card.capabilities.canManageDomesticUsage || card.capabilities.canManageInternationalUsage} /><Capability label="Transaction limits" enabled={card.capabilities.canManageLimits} /><Capability label="Lost/stolen assistance" enabled={card.capabilities.canHotlist} /><Capability label="Statements" enabled={card.capabilities.canViewStatements} /><Text style={styles.sourceText}>Last successfully updated {formatDate(card.lastSuccessfulUpdate)} · Demo card — changes affect this prototype only.</Text></View></View>; }

function Capability({ label, enabled }: { label: string; enabled: boolean }) { return <View style={styles.capabilityRow}><Ionicons name={enabled ? "checkmark-circle" : "remove-circle-outline"} size={18} color={enabled ? colors.green : colors.muted} /><Text style={[styles.capabilityText, !enabled && styles.unavailableText]}>{enabled ? label : `${label} unavailable`}</Text></View>; }

function BillingSection({ card }: { card: CardRecord }) { const facility = card.creditFacility; if (!facility) return <StateCard title="Billing unavailable" description="This product does not supply credit billing information." />; return <View><View style={styles.sectionHeading}><View style={styles.sectionHeadingText}><Text accessibilityRole="header" style={styles.sectionTitle}>Billing & statements</Text><Text style={styles.sectionDescription}>Source-provided amounts for the shared credit facility.</Text></View></View><View style={styles.detailsCard}><BillingRow label="Statement period" value={facility.statementPeriod ?? "Unavailable"} /><BillingRow label="Statement total due" value={facility.statementTotalDueMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(facility.statementTotalDueMinorUnits)} /><BillingRow label="Minimum amount due" value={facility.minimumAmountDueMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(facility.minimumAmountDueMinorUnits)} /><BillingRow label="Payment due date" value={facility.paymentDueDate ? formatDate(facility.paymentDueDate) : "Unavailable"} /><BillingRow label="Payment status" value={facility.paymentStatus ?? "Unavailable"} /><Text style={styles.billingNote}>A minimum payment is not the same as fully settling a statement. Bill payment is unavailable until an authorised payment integration is connected.</Text><Pressable accessibilityRole="button" accessibilityLabel="Pay credit card bill unavailable" disabled style={[styles.secondaryDisabledButton, styles.disabledAction]}><Text style={styles.secondaryDisabledText}>Pay bill unavailable in this prototype</Text></Pressable><Text style={styles.demoDocument}>Demo card activity — not an official bank statement.</Text></View></View>; }

function BillingRow({ label, value }: { label: string; value: string }) { return <View style={styles.billingRow}><Text style={styles.billingLabel}>{label}</Text><Text style={styles.billingValue}>{value}</Text></View>; }

function StateCard({ title, description, actionLabel, onAction, compact = false }: { title: string; description: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) { return <View style={[styles.stateCard, compact && styles.stateCardCompact]}><Ionicons name="card-outline" size={compact ? 22 : 28} color={colors.greenDark} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDescription}>{description}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.modalButton}><Text style={styles.modalButtonText}>{actionLabel}</Text></Pressable> : null}</View>; }

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <View style={styles.modalBackdrop}><View style={styles.modal}><View style={styles.modalHeader}><Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View>{children}</View></View>; }

function ModalButton({ label, onPress, disabled = false, destructive = false }: { label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy: disabled }} disabled={disabled} onPress={onPress} style={[styles.modalButton, destructive && styles.modalButtonDestructive, disabled && styles.disabledAction]}><Text style={styles.modalButtonText}>{label}</Text></Pressable>; }

function ChoiceButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choiceButton, selected && styles.choiceButtonSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }

function LimitReview({ card, draft, onChange, onApply, busy }: { card: CardRecord; draft: { id: string; value: string }; onChange: (value: string) => void; onApply: () => void; busy: boolean }) { const limit = card.limits.find((item) => item.id === draft.id); if (!limit) return null; return <><Text style={styles.modalLead}>{limit.label}</Text><Text style={styles.modalBody}>Set an exact INR amount. Maximum permitted: {formatIndianMinorUnits(limit.maximumMinorUnits)}.</Text><Text style={styles.fieldLabel}>New {limit.period === "daily" ? "daily" : "per-transaction"} limit</Text><TextInput accessibilityLabel="New card transaction limit" value={draft.value} onChangeText={onChange} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" style={styles.textInput} /><View style={styles.reviewBox}><Text style={styles.reviewLabel}>Review</Text><Text style={styles.reviewText}>{formatIndianMinorUnits(limit.amountMinorUnits)} → {draft.value || "—"} INR</Text><Text style={styles.reviewHint}>The provider will validate this value against the latest constraint.</Text></View><ModalButton label={busy ? "Applying…" : "Apply limit"} onPress={onApply} disabled={busy} /></>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 },
  loadingText: { marginTop: 12, color: colors.secondary, fontSize: 15 },
  scrollContent: { width: "100%", alignItems: "center", paddingTop: 12 },
  content: { width: "100%", alignSelf: "center" },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "600" },
  switchButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  switchText: { marginLeft: 5, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10, marginBottom: 18 },
  titleColumn: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: "700" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 15, lineHeight: 21 },
  lastFour: { marginLeft: 10, marginBottom: 2, color: colors.secondary, fontSize: 14, fontWeight: "600" },
  financialCard: { marginTop: 18, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 9, elevation: 2 },
  financialHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrow: { color: colors.secondary, fontSize: 12, lineHeight: 16, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.45 },
  financialTitle: { marginTop: 4, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  financialLabel: { marginTop: 18, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  financialValue: { marginTop: 2, color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: "800" },
  sourceText: { marginTop: 9, color: colors.muted, fontSize: 12, lineHeight: 17 },
  scopeText: { marginTop: 11, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  eyeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  sharedBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.orangeSoft },
  sharedBadgeText: { color: colors.orange, fontSize: 11, fontWeight: "800" },
  creditGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  metric: { flex: 1, minWidth: 92 },
  metricLabel: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  metricValue: { marginTop: 4, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  primaryActions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 16 },
  primaryAction: { minHeight: 48, flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: "#CBE6DE" },
  primaryActionDestructive: { backgroundColor: colors.dangerSoft, borderColor: "#F2C6C8" },
  primaryActionText: { marginLeft: 6, color: colors.greenDark, fontSize: 13, fontWeight: "700", textAlign: "center" },
  destructiveText: { color: colors.danger },
  operationBanner: { flexDirection: "row", alignItems: "flex-start", marginTop: 14, padding: 13, borderRadius: 14, borderWidth: 1 },
  operationPending: { backgroundColor: colors.orangeSoft, borderColor: "#F6D1C0" },
  operationFailed: { backgroundColor: colors.dangerSoft, borderColor: "#F2C6C8" },
  operationText: { flex: 1, minWidth: 0, marginLeft: 8 },
  operationTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  operationDescription: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  checkButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
  checkButtonText: { color: colors.greenDark, fontSize: 13, fontWeight: "800" },
  sectionTabs: { columnGap: 8, paddingVertical: 20 },
  sectionTab: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionTabSelected: { backgroundColor: colors.greenSoft, borderColor: "#B8DED5" },
  sectionTabText: { color: colors.secondary, fontSize: 13, fontWeight: "700" },
  sectionTabTextSelected: { color: colors.greenDark },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 },
  sectionHeadingText: { flex: 1, minWidth: 0 },
  sectionTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  sectionDescription: { marginTop: 5, color: colors.secondary, fontSize: 13, lineHeight: 19 },
  coachButton: { minHeight: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.greenSoft },
  coachButtonText: { marginLeft: 5, color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  spendingSummary: { marginBottom: 14, padding: 16, borderRadius: 17, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  summaryScope: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  coverageText: { marginTop: 14, color: colors.muted, fontSize: 11, lineHeight: 16 },
  filtersPanel: { padding: 13, borderRadius: 17, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.background },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 8, paddingVertical: 8, color: colors.text, fontSize: 14 },
  chipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  filterChip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 11, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  filterChipSelected: { backgroundColor: colors.greenSoft, borderColor: "#B8DED5" },
  filterChipText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  filterChipTextSelected: { color: colors.greenDark },
  loader: { marginTop: 28 },
  transactionCard: { marginTop: 14, overflow: "hidden", borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  transactionRow: { minHeight: 82, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  transactionIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.orangeSoft },
  transactionText: { flex: 1, minWidth: 0, marginLeft: 11 },
  transactionTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  transactionMeta: { marginTop: 2, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  transactionStatus: { color: colors.muted, fontSize: 11, lineHeight: 15, textTransform: "capitalize" },
  transactionCategory: { color: colors.greenDark, fontSize: 11, lineHeight: 15, textTransform: "capitalize" },
  transactionAmount: { flexDirection: "row", alignItems: "center", marginLeft: 7 },
  amountText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  amountCredit: { color: colors.greenDark },
  paginationRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13 },
  paginationText: { flex: 1, color: colors.secondary, fontSize: 11 },
  paginationButtons: { flexDirection: "row", columnGap: 5, marginLeft: 8 },
  paginationButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.greenSoft },
  controlCard: { overflow: "hidden", borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  controlGroup: { marginTop: 22 },
  groupTitle: { marginBottom: 9, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  groupHeadingRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  controlRow: { minHeight: 75, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  controlText: { flex: 1, minWidth: 0, paddingRight: 10 },
  controlTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  controlDescription: { marginTop: 3, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  unavailableLabel: { marginLeft: 6, color: colors.muted, fontSize: 10, fontWeight: "700" },
  effectiveNote: { flexDirection: "row", alignItems: "flex-start", padding: 13, backgroundColor: colors.orangeSoft },
  effectiveNoteText: { flex: 1, marginLeft: 7, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  limitRow: { minHeight: 86, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  limitText: { flex: 1, minWidth: 0, paddingRight: 8 },
  limitTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  limitMeta: { marginTop: 3, color: colors.secondary, fontSize: 11, lineHeight: 15 },
  limitValue: { alignItems: "flex-end" },
  limitAmount: { color: colors.text, fontSize: 14, fontWeight: "800" },
  editButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 5 },
  editButtonText: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  detailsCard: { padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  detailRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 13 },
  detailValue: { maxWidth: "55%", color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  detailDivider: { height: 1, marginVertical: 14, backgroundColor: colors.border },
  capabilityHeading: { marginBottom: 8, color: colors.text, fontSize: 16, fontWeight: "800" },
  capabilityRow: { minHeight: 34, flexDirection: "row", alignItems: "center" },
  capabilityText: { marginLeft: 8, color: colors.text, fontSize: 13 },
  unavailableText: { color: colors.muted },
  billingRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  billingLabel: { color: colors.secondary, fontSize: 13 },
  billingValue: { maxWidth: "55%", color: colors.text, fontSize: 13, fontWeight: "800", textAlign: "right", textTransform: "capitalize" },
  billingNote: { marginTop: 15, color: colors.secondary, fontSize: 12, lineHeight: 18 },
  secondaryDisabledButton: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 15, borderRadius: 12, backgroundColor: colors.background },
  secondaryDisabledText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  demoDocument: { marginTop: 12, color: colors.muted, fontSize: 11, lineHeight: 16, fontStyle: "italic" },
  limitations: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 13, borderRadius: 14, backgroundColor: colors.orangeSoft },
  limitationText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  stateCard: { alignItems: "center", marginTop: 10, padding: 24, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stateCardCompact: { marginTop: 0, padding: 18 },
  stateTitle: { marginTop: 12, color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
  stateDescription: { marginTop: 6, color: colors.secondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.45)" },
  modal: { padding: 20, paddingBottom: 28, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: colors.surface },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { flex: 1, color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  modalLead: { marginTop: 16, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  modalBody: { marginTop: 8, color: colors.secondary, fontSize: 14, lineHeight: 21 },
  demoNotice: { flexDirection: "row", alignItems: "flex-start", marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  demoNoticeText: { flex: 1, marginLeft: 7, color: colors.greenDark, fontSize: 12, lineHeight: 17 },
  modalButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 20, borderRadius: 13, backgroundColor: colors.green },
  modalButtonDestructive: { backgroundColor: colors.danger },
  modalButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  fieldLabel: { marginTop: 18, marginBottom: 7, color: colors.text, fontSize: 13, fontWeight: "800" },
  reasonRow: { flexDirection: "row", gap: 8 },
  choiceButton: { minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  choiceButtonSelected: { backgroundColor: colors.greenSoft, borderColor: "#B8DED5" },
  choiceText: { color: colors.secondary, fontSize: 14, fontWeight: "700" },
  choiceTextSelected: { color: colors.greenDark },
  textInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 },
  characterHint: { marginTop: 5, color: colors.muted, fontSize: 11, textAlign: "right" },
  reviewBox: { marginTop: 16, padding: 13, borderRadius: 13, backgroundColor: colors.greenSoft },
  reviewLabel: { color: colors.greenDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  reviewText: { marginTop: 5, color: colors.text, fontSize: 16, fontWeight: "800" },
  reviewHint: { marginTop: 5, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72 },
  disabledAction: { opacity: 0.55 },
});
