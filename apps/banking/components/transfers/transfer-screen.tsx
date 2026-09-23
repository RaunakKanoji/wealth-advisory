import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { isRemoteDataEnabled } from "@/lib/env";
import { useBeneficiaries, useTransfers } from "@/lib/api/hooks";
import { apiBeneficiaryToBeneficiary, apiTransferToAttempt } from "@/lib/api/view-models";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { getAccountPreference } from "@/services/accounts-service";
import {
  checkTransferStatus,
  createTransferDraft,
  executeTransfer,
  formatTransferStatus,
  getBeneficiaries,
  getRecentTransferRecipients,
  getTransfer,
  getTransferDraft,
  getTransferQrIntake,
  getTransferHistory,
  getTransferOptions,
  parseTransferAmount,
  quoteTransfer,
  updateTransferDraft,
} from "@/services/transfer-service";
import type { BankAccount } from "@/types/banking";
import type {
  Beneficiary,
  BeneficiaryInput,
  TransferAttempt,
  TransferDestinationType,
  TransferDraft,
  TransferHistoryPage,
  TransferMethod,
  TransferOptions,
  TransferQuote,
  TransferRecipientSnapshot,
} from "@/types/transfers";
import { appColors } from "@/components/theme/tokens";
import {
  DemoModeBanner,
  RecentRecipientList,
  SectionHeader,
  TransferOptionList,
  TransferOptionListSkeleton,
} from "@/components/transfers/transfer-ui";
import { isValidUpiId } from "@/lib/payment-qr-parser";

const colors = {
  background: appColors.background,
  surface: appColors.surface,
  text: appColors.textPrimary,
  secondary: appColors.textSecondary,
  muted: appColors.textMuted,
  green: appColors.primary,
  greenDark: appColors.primaryPressed,
  greenSoft: appColors.primarySoft,
  orange: appColors.orangeText,
  orangeSoft: appColors.warningSoft,
  border: appColors.border,
  danger: appColors.danger,
  dangerSoft: appColors.dangerSoft,
};

type TransferStep = "recipient" | "amount" | "review";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function opaqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function accountBalance(account: BankAccount): number | null {
  if (account.balanceDataAvailable === false) return null;
  return account.availableBalanceMinorUnits ?? account.balanceMinorUnits;
}

function beneficiarySearchText(beneficiary: Beneficiary): string {
  return [
    beneficiary.nickname,
    beneficiary.bankReturnedName,
    beneficiary.maskedAccountNumber,
    beneficiary.upiId,
    beneficiary.bankName,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function formatBeneficiaryStatus(status: Beneficiary["status"]): string {
  return status.split("-").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

function beneficiaryToRecipient(beneficiary: Beneficiary): TransferRecipientSnapshot & { lastUsedAt: string } {
  return {
    type: beneficiary.type === "upi" ? "upi" : "bank-account",
    displayName: beneficiary.nickname ?? beneficiary.bankReturnedName ?? beneficiary.upiId ?? "Recipient",
    maskedDestination: beneficiary.maskedAccountNumber ?? beneficiary.upiId ?? "Destination unavailable",
    bankName: beneficiary.bankName,
    upiId: beneficiary.upiId,
    beneficiaryId: beneficiary.id,
    resolutionStatus: beneficiary.resolutionStatus,
    lookupReference: beneficiary.lookupReference,
    lastUsedAt: beneficiary.updatedAt,
  };
}

export function TransferLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { fromAccountId: rawFromAccountId } = useLocalSearchParams<{ fromAccountId?: string | string[] }>();
  const fromAccountId = firstParam(rawFromAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const remoteBeneficiaries = useBeneficiaries();
  const remoteTransfers = useTransfers();
  const { refetch: refetchRemoteBeneficiaries } = remoteBeneficiaries;
  const { refetch: refetchRemoteTransfers } = remoteTransfers;
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [recipients, setRecipients] = useState<(TransferRecipientSnapshot & { lastUsedAt: string })[]>([]);
  const [history, setHistory] = useState<TransferHistoryPage | null>(null);
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    if (isRemoteDataEnabled) {
      try {
        const [beneficiaryResult, transferResult] = await Promise.all([
          refetchRemoteBeneficiaries(),
          refetchRemoteTransfers(),
        ]);
        if (beneficiaryResult.error || transferResult.error || !beneficiaryResult.data || !transferResult.data) throw new Error("Remote transfer data unavailable");
        const nextBeneficiaries = beneficiaryResult.data.items.map((item) => apiBeneficiaryToBeneficiary(item, customerId));
        setBeneficiaries(nextBeneficiaries);
        setRecipients(nextBeneficiaries.slice(0, 4).map(beneficiaryToRecipient));
        setHistory({ items: transferResult.data.items.map((item) => apiTransferToAttempt(item, nextBeneficiaries.find((beneficiary) => beneficiary.id === item.beneficiaryId))), page: 1, pageSize: 5, totalItems: transferResult.data.items.length, totalPages: 1 });
        setState("ready");
      } catch {
        setState("error");
      }
      return;
    }
    try {
      const [nextBeneficiaries, nextRecipients, nextHistory] = await Promise.all([
        getBeneficiaries({ customerId }),
        getRecentTransferRecipients({ customerId }),
        getTransferHistory({ customerId, pageSize: 5 }),
      ]);
      setBeneficiaries(nextBeneficiaries);
      setRecipients(nextRecipients);
      setHistory(nextHistory);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [customerId, refetchRemoteBeneficiaries, refetchRemoteTransfers]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const start = (destinationType: TransferDestinationType, params?: Record<string, string>) => {
    router.push({
      pathname: "/(app)/transfers/new",
      params: { type: destinationType, ...(fromAccountId ? { fromAccountId } : {}), ...params },
    });
  };

  const recentItems = useMemo(() => {
    if (recipients.length > 0) return recipients;
    return beneficiaries.slice(0, 4).map((beneficiary) => beneficiaryToRecipient(beneficiary));
  }, [beneficiaries, recipients]);

  const visibleBeneficiaries = beneficiaries
    .filter((beneficiary) => beneficiarySearch.trim().length === 0 || beneficiarySearchText(beneficiary).includes(beneficiarySearch.trim().toLocaleLowerCase()))
    .slice(0, 3);

  const startRecentRecipient = (recipient: TransferRecipientSnapshot & { lastUsedAt: string }) => {
    const destinationType: TransferDestinationType = recipient.type === "own-account"
      ? "own-account"
      : recipient.upiId
        ? "upi"
        : "bank-account";
    const params: Record<string, string> | undefined = recipient.beneficiaryId
      ? { beneficiaryId: recipient.beneficiaryId }
      : recipient.upiId
        ? { upiId: recipient.upiId }
        : undefined;
    start(destinationType, params);
  };

  const horizontalPadding = width < 375 ? 16 : 20;
  const bottomPadding = 28 + insets.bottom;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.fixedHeader}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding, maxWidth: width >= 768 ? 860 : undefined }]}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)")} />
            <Pressable accessibilityRole="button" accessibilityLabel="View transfer history" onPress={() => router.push("/(app)/transfers/history")} style={styles.headerAction}>
              <Ionicons name="time-outline" size={20} color={colors.greenDark} />
              <Text style={styles.headerActionText}>History</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView style={styles.flex} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: bottomPadding }]}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding, maxWidth: width >= 768 ? 860 : undefined }]}>
          <Text accessibilityRole="header" style={[styles.title, styles.landingTitle]}>Transfer money</Text>
          <Text style={styles.subtitle}>Choose where you want to send money.</Text>

          <DemoModeBanner />

          <SectionHeader title="Transfer to" />
          <TransferOptionList options={[
            { id: "own-account", icon: "swap-horizontal-outline", title: "My accounts", description: "Transfer between your accounts", onPress: () => start("own-account") },
            { id: "bank-account", icon: "business-outline", title: "Bank account", description: "NEFT · IMPS · RTGS", onPress: () => start("bank-account") },
            { id: "upi", icon: "at-outline", title: "UPI ID", description: "Pay using a UPI ID", onPress: () => start("upi") },
          ]} />

          {state === "loading" ? <LandingSkeleton /> : state === "error" ? <InlineState title="Transfer data unavailable" description="We could not load recipients or recent activity." action="Retry" onPress={() => void load()} /> : (
            <>
              <SectionHeader title="Recent recipients" actionLabel="View all" onAction={() => router.push("/(app)/beneficiaries")} />
              {recentItems.length === 0 ? <InlineState title="No recent recipients" description="Recipients will appear here after you use a transfer flow." /> : <RecentRecipientList recipients={recentItems} onRecipientPress={startRecentRecipient} onAddPress={() => router.push("/(app)/beneficiaries?mode=add")} />}

              <SectionHeader title="Beneficiaries" actionLabel="Manage" onAction={() => router.push("/(app)/beneficiaries")} />
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.secondary} />
                <TextInput accessibilityLabel="Search beneficiaries" value={beneficiarySearch} onChangeText={setBeneficiarySearch} placeholder="Search beneficiaries" placeholderTextColor={colors.muted} style={styles.searchInput} />
              </View>
              {visibleBeneficiaries.length === 0 ? <InlineState title={beneficiarySearch ? "No matching beneficiaries" : "No saved beneficiaries"} description="Add a beneficiary when you are ready to use a bank account or UPI ID again." action="Add beneficiary" onPress={() => router.push("/(app)/beneficiaries?mode=add")} /> : <View style={styles.listCard}>{visibleBeneficiaries.map((beneficiary) => <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} onPress={() => start(beneficiary.type === "upi" ? "upi" : "bank-account", { beneficiaryId: beneficiary.id })} />)}</View>}

              <SectionHeader title="Recent transfers" actionLabel="View all" onAction={() => router.push("/(app)/transfers/history")} />
              {!history || history.items.length === 0 ? <InlineState compact title="No recent transfers" description="Completed and reviewed transfers will appear here." /> : (
                <View style={styles.listCard}>
                  {history.items.map((attempt) => <TransferRow key={attempt.id} attempt={attempt} onPress={() => router.push({ pathname: "/(app)/transfers/[transferId]", params: { transferId: attempt.id } })} />)}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function TransferFlowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const params = useLocalSearchParams<{ type?: string | string[]; fromAccountId?: string | string[]; beneficiaryId?: string | string[]; upiId?: string | string[]; draftId?: string | string[]; qrIntakeId?: string | string[] }>();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const destinationType = (firstParam(params.type) === "bank-account" || firstParam(params.type) === "upi" ? firstParam(params.type) : "own-account") as TransferDestinationType;
  const fromAccountId = firstParam(params.fromAccountId);
  const beneficiaryId = firstParam(params.beneficiaryId);
  const initialUpiId = firstParam(params.upiId);
  const existingDraftId = firstParam(params.draftId);
  const qrIntakeId = firstParam(params.qrIntakeId);
  const [step, setStep] = useState<TransferStep>("recipient");
  const [options, setOptions] = useState<TransferOptions | null>(null);
  const [balanceVisibility, setBalanceVisibility] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TransferDraft | null>(null);
  const [quote, setQuote] = useState<TransferQuote | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState(fromAccountId ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [method, setMethod] = useState<TransferMethod | "">("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [upiId, setUpiId] = useState(initialUpiId ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [upiVerified, setUpiVerified] = useState(Boolean(beneficiaryId));
  const [verifiedRecipientName, setVerifiedRecipientName] = useState("");
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState(beneficiaryId ?? "");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [newBank, setNewBank] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getTransferOptions(destinationType, { customerId }),
      getBeneficiaries({ customerId, type: destinationType === "upi" ? "upi" : destinationType === "bank-account" ? "bank-account" : undefined }),
    ]).then(async ([nextOptions, nextBeneficiaries]) => {
      if (!active) return;
      setOptions(nextOptions);
      setBeneficiaries(nextBeneficiaries);
      const selectedBeneficiary = nextBeneficiaries.find((item) => item.id === beneficiaryId);
      if (selectedBeneficiary) {
        setUpiVerified(selectedBeneficiary.type === "upi");
        setVerifiedRecipientName(selectedBeneficiary.bankReturnedName ?? selectedBeneficiary.nickname ?? "");
      }
      const preferences = await Promise.all(nextOptions.eligibleSourceAccounts.map(async (account) => {
        try {
          const preference = await getAccountPreference(account.id, { customerId });
          return [account.id, preference.balanceVisible !== false] as const;
        } catch {
          return [account.id, true] as const;
        }
      }));
      if (!active) return;
      setBalanceVisibility(Object.fromEntries(preferences));
      const preferred = fromAccountId && nextOptions.eligibleSourceAccounts.some((account) => account.id === fromAccountId)
        ? fromAccountId
        : nextOptions.eligibleSourceAccounts.find((account) => account.isPrimary)?.id ?? nextOptions.eligibleSourceAccounts[0]?.id ?? "";
      setSourceAccountId(preferred);
      if (nextOptions.methods[0]) setMethod(nextOptions.methods[0].method);
    }).catch(() => { if (active) setError("We could not load the eligible transfer accounts."); });
    return () => { active = false; };
  }, [beneficiaryId, customerId, destinationType, fromAccountId]);

  useEffect(() => {
    if (!existingDraftId) return;
    void getTransferDraft(existingDraftId, { customerId }).then((nextDraft) => {
      if (!nextDraft) return;
      setDraft(nextDraft);
      setSourceAccountId(nextDraft.sourceAccountId ?? "");
      setDestinationAccountId(nextDraft.destinationAccountId ?? "");
      setAmountInput(nextDraft.amountMinorUnits ? (nextDraft.amountMinorUnits / 100).toFixed(2) : "");
      setMethod(nextDraft.method ?? "");
      setPaymentMessage(nextDraft.paymentMessage ?? "");
      setPrivateNote(nextDraft.privateNote ?? "");
      setStep("amount");
    });
  }, [customerId, existingDraftId]);

  useEffect(() => {
    if (!qrIntakeId) return;
    void getTransferQrIntake(qrIntakeId, { customerId }).then((intake) => {
      if (!intake) return;
      setUpiId(intake.upiId);
      setRecipientName(intake.recipientName ?? "");
      setAmountInput(intake.amountMinorUnits === null ? "" : (intake.amountMinorUnits / 100).toFixed(2));
      setPaymentMessage(intake.paymentMessage ?? "");
      setSelectedBeneficiaryId("");
    }).catch((nextError) => setError(nextError instanceof Error ? nextError.message : "This QR transfer intake is unavailable"));
  }, [customerId, qrIntakeId]);

  const back = () => {
    if (step === "recipient") {
      if (router.canGoBack()) router.back();
      else router.replace("/(app)/transfer");
    }
    else if (step === "amount") setStep("recipient");
    else setStep("amount");
  };

  const createDraftAndContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!sourceAccountId) throw new Error("Choose a funding account");
      if (destinationType === "upi" && !selectedBeneficiaryId && !upiVerified) throw new Error("Verify the UPI ID before continuing");
      let recipientInput: BeneficiaryInput | undefined;
      if (destinationType === "upi" && !selectedBeneficiaryId) recipientInput = { type: "upi", upiId, recipientName, saveBeneficiary };
      if (destinationType === "bank-account" && newBank) recipientInput = { type: "bank-account", accountNumber, confirmAccountNumber, ifsc, recipientName, saveBeneficiary };
      const nextDraft = await createTransferDraft({
        destinationType,
        customerId,
        sourceAccountId,
        destinationAccountId: destinationType === "own-account" ? destinationAccountId : undefined,
        beneficiaryId: destinationType === "own-account" ? undefined : selectedBeneficiaryId || undefined,
        recipientInput,
      });
      setDraft(nextDraft);
      setSourceAccountId(nextDraft.sourceAccountId ?? sourceAccountId);
      if (qrIntakeId && !amountInput) setAmountInput(nextDraft.amountMinorUnits ? (nextDraft.amountMinorUnits / 100).toFixed(2) : "");
      setStep("amount");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Recipient could not be prepared");
    } finally {
      setBusy(false);
    }
  };

  const verifyUpi = () => {
    setError(null);
    const normalized = upiId.trim().toLocaleLowerCase();
    if (!isValidUpiId(normalized)) {
      setUpiVerified(false);
      setVerifiedRecipientName("");
      setError("Enter a valid UPI ID such as name@bank");
      return;
    }
    setUpiId(normalized);
    setVerifiedRecipientName(recipientName.trim() || normalized.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
    setUpiVerified(true);
  };

  const prepareReview = async () => {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const amountMinorUnits = parseTransferAmount(amountInput);
      const updated = await updateTransferDraft(draft.id, {
        sourceAccountId,
        amountMinorUnits,
        method: method || undefined,
        paymentMessage: paymentMessage || undefined,
        privateNote: privateNote || undefined,
      }, { customerId });
      const nextQuote = await quoteTransfer(updated.id, { customerId });
      setDraft(updated);
      setQuote(nextQuote);
      setStep("review");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The transfer could not be prepared");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!draft || !quote || busy) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await executeTransfer({ draftId: draft.id, quoteId: quote.id, idempotencyKey: opaqueKey("confirm"), customerId });
      router.replace({ pathname: "/(app)/transfers/[transferId]", params: { transferId: attempt.id } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The transfer was not submitted");
    } finally {
      setBusy(false);
    }
  };

  const filteredFlowBeneficiaries = beneficiaries.filter((beneficiary) => beneficiarySearchText(beneficiary).includes(beneficiarySearch.trim().toLocaleLowerCase()));
  const selectedBeneficiary = beneficiaries.find((beneficiary) => beneficiary.id === selectedBeneficiaryId);
  const selectedBeneficiaryIsActive = selectedBeneficiary?.status === "active";
  const recipientReady = destinationType === "own-account"
    ? Boolean(sourceAccountId && destinationAccountId)
    : destinationType === "upi"
      ? Boolean((selectedBeneficiaryId && selectedBeneficiaryIsActive) || (!selectedBeneficiaryId && upiVerified))
      : Boolean((selectedBeneficiaryId && selectedBeneficiaryIsActive) || newBank);
  const canContinue = Boolean(options) && (step === "recipient" ? recipientReady : step === "amount" ? Boolean(draft) : Boolean(draft && quote));

  const recipientStep = destinationType === "own-account" ? (
    <View>
      <Text style={styles.formHeading}>Move between your accounts</Text>
      <Text style={styles.formDescription}>Only active savings, current, and salary accounts can be used for this demo journey.</Text>
      <Text style={styles.fieldLabel}>From account</Text>
      <AccountList accounts={options?.eligibleSourceAccounts ?? []} selectedId={sourceAccountId} onSelect={setSourceAccountId} balanceVisibility={balanceVisibility} />
      <Text style={styles.fieldLabel}>To account</Text>
      <AccountList accounts={(options?.eligibleOwnDestinationAccounts ?? []).filter((account) => account.id !== sourceAccountId)} selectedId={destinationAccountId} onSelect={setDestinationAccountId} balanceVisibility={balanceVisibility} emptyText="You need two different eligible accounts for an own-account transfer." />
    </View>
  ) : destinationType === "upi" ? (
    <View>
      <Text style={styles.formHeading}>Choose a UPI recipient</Text>
      <Text style={styles.formDescription}>Enter a UPI ID, verify the recipient, then continue to amount.</Text>
      {beneficiaries.filter((item) => item.type === "upi").length > 0 ? <View style={styles.recipientChoiceGroup}><Text style={styles.fieldLabel}>Saved UPI IDs</Text><RecipientChoices beneficiaries={beneficiaries.filter((item) => item.type === "upi")} selectedId={selectedBeneficiaryId} onSelect={(value) => { const selected = beneficiaries.find((item) => item.id === value); setSelectedBeneficiaryId(value); setUpiId(selected?.upiId ?? ""); setUpiVerified(true); setVerifiedRecipientName(selected?.bankReturnedName ?? selected?.nickname ?? ""); }} /></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Enter a new UPI ID" onPress={() => { setSelectedBeneficiaryId(""); setUpiVerified(false); setVerifiedRecipientName(""); }} style={styles.secondaryChoice}><Ionicons name="create-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryChoiceText}>Enter a new UPI ID</Text></Pressable>
      {!selectedBeneficiaryId ? <><View style={styles.inputActionRow}><View style={styles.inputActionField}><Field label="UPI ID"><TextInput accessibilityLabel="UPI ID" value={upiId} onChangeText={(value) => { setUpiId(value); setUpiVerified(false); setVerifiedRecipientName(""); }} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" placeholder="name@bank" placeholderTextColor={colors.muted} style={styles.textInput} /></Field></View><Pressable accessibilityRole="button" accessibilityLabel="Verify UPI ID" onPress={verifyUpi} style={styles.verifyButton}><Text style={styles.verifyButtonText}>Verify</Text></Pressable></View><Field label="Recipient name (optional)"><TextInput accessibilityLabel="Recipient name" value={recipientName} onChangeText={(value) => { setRecipientName(value); setUpiVerified(false); }} placeholder="Name returned or entered for review" placeholderTextColor={colors.muted} style={styles.textInput} /></Field>{upiVerified ? <View style={styles.verifiedCard} accessibilityLiveRegion="polite"><View style={styles.verifiedIcon}><Ionicons name="checkmark" size={16} color={colors.greenDark} /></View><View style={styles.verifiedCopy}><Text style={styles.verifiedTitle}>{verifiedRecipientName || "Recipient verified"}</Text><Text style={styles.verifiedDetail}>{upiId} · Verified for this demo</Text></View></View> : null}<Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveBeneficiary }} onPress={() => setSaveBeneficiary((current) => !current)} style={styles.checkRow}><View style={[styles.checkbox, saveBeneficiary && styles.checkboxSelected]}>{saveBeneficiary ? <Ionicons name="checkmark" size={15} color={colors.surface} /> : null}</View><Text style={styles.checkText}>Save this recipient for later</Text></Pressable></> : <View style={styles.verifiedCard}><View style={styles.verifiedIcon}><Ionicons name="checkmark" size={16} color={colors.greenDark} /></View><View style={styles.verifiedCopy}><Text style={styles.verifiedTitle}>{verifiedRecipientName || "Saved recipient selected"}</Text><Text style={styles.verifiedDetail}>{upiId} · Verified beneficiary</Text></View></View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Scan a QR code" onPress={() => router.push("/(app)/scan-qr")} style={styles.scanButton}><Ionicons name="qr-code-outline" size={19} color={colors.greenDark} /><Text style={styles.scanButtonText}>Scan QR instead</Text></Pressable>
    </View>
  ) : (
    <View>
      <Text style={styles.formHeading}>Select beneficiary</Text>
      <Text style={styles.formDescription}>Choose a recent beneficiary or add a new bank destination before entering the amount.</Text>
      <Field label="Search beneficiary"><TextInput accessibilityLabel="Search beneficiaries" value={beneficiarySearch} onChangeText={setBeneficiarySearch} placeholder="Search by name or account" placeholderTextColor={colors.muted} style={styles.textInput} /></Field>
      {filteredFlowBeneficiaries.filter((item) => item.type === "bank-account").length > 0 ? <View style={styles.recipientChoiceGroup}><Text style={styles.fieldLabel}>Recent beneficiaries</Text><RecipientChoices beneficiaries={filteredFlowBeneficiaries.filter((item) => item.type === "bank-account")} selectedId={selectedBeneficiaryId} onSelect={(value) => { setSelectedBeneficiaryId(value); setNewBank(false); }} /></View> : <InlineState title={beneficiarySearch ? "No matching beneficiaries" : "No recent beneficiaries"} description="Add a new bank beneficiary to continue." />}
      <Pressable accessibilityRole="button" accessibilityLabel="Add a new beneficiary" onPress={() => { setSelectedBeneficiaryId(""); setNewBank(true); }} style={styles.secondaryChoice}><Ionicons name="add-circle-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryChoiceText}>Add new beneficiary</Text></Pressable>
      {newBank ? <><Field label="Account holder name"><TextInput accessibilityLabel="Account holder name" value={recipientName} onChangeText={setRecipientName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Account number"><TextInput accessibilityLabel="Recipient account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" maxLength={24} placeholder="Enter account number" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Confirm account number"><TextInput accessibilityLabel="Confirm recipient account number" value={confirmAccountNumber} onChangeText={setConfirmAccountNumber} keyboardType="number-pad" maxLength={24} placeholder="Re-enter account number" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="IFSC"><TextInput accessibilityLabel="Recipient IFSC" value={ifsc} onChangeText={(value) => setIfsc(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="IBKL0000123" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveBeneficiary }} onPress={() => setSaveBeneficiary((current) => !current)} style={styles.checkRow}><View style={[styles.checkbox, saveBeneficiary && styles.checkboxSelected]}>{saveBeneficiary ? <Ionicons name="checkmark" size={15} color={colors.surface} /> : null}</View><Text style={styles.checkText}>Save beneficiary for later</Text></Pressable></> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: 12, paddingBottom: 34 + insets.bottom }]}>
          <View style={[styles.content, { paddingHorizontal: width < 375 ? 16 : 20, maxWidth: width >= 768 ? 760 : undefined }]}>
            <View style={styles.headerRow}><BackButton onPress={back} /><Text accessibilityRole="header" style={styles.headerTitle}>Transfer money</Text><View style={styles.headerSpacer} /></View>
            <Progress step={step} />
            {step === "recipient" ? recipientStep : step === "amount" ? <AmountStep options={options} draft={draft} sourceAccountId={sourceAccountId} amountInput={amountInput} method={method} paymentMessage={paymentMessage} privateNote={privateNote} balanceVisibility={balanceVisibility} onSourceChange={setSourceAccountId} onAmountChange={setAmountInput} onMethodChange={setMethod} onPaymentMessage={setPaymentMessage} onPrivateNote={setPrivateNote} /> : <ReviewStep draft={draft} quote={quote} onEditRecipient={() => { setDraft(null); setQuote(null); setStep("recipient"); }} onEditAmount={() => { setQuote(null); setStep("amount"); }} />}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy || !canContinue} onPress={() => void (step === "recipient" ? createDraftAndContinue() : step === "amount" ? prepareReview() : confirm())} style={({ pressed }) => [styles.primaryButton, (busy || !canContinue) && styles.disabledButton, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{step === "recipient" ? "Continue" : step === "amount" ? "Review transfer" : "Confirm transfer"}</Text>}
            </Pressable>
            {step === "review" ? <Text style={styles.reviewHint}>Opening review does not submit a payment. Confirmation creates one persisted transfer attempt.</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function TransferStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { transferId: rawTransferId } = useLocalSearchParams<{ transferId?: string | string[] }>();
  const transferId = firstParam(rawTransferId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [attempt, setAttempt] = useState<TransferAttempt | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!transferId) { setState("error"); return; }
    try {
      const next = await getTransfer(transferId, { customerId });
      setAttempt(next ?? null);
      setState(next ? "ready" : "error");
    } catch { setState("error"); }
  }, [customerId, transferId]);

  useEffect(() => { void load(); }, [load]);

  const check = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    try { setAttempt(await checkTransferStatus(attempt.id, { customerId })); } catch (error) { Alert.alert("Status unavailable", error instanceof Error ? error.message : "Please try again."); } finally { setBusy(false); }
  };

  if (state === "loading") return <SafeAreaView style={styles.screen} edges={["top"]}><CenteredLoading label="Loading transfer status" /></SafeAreaView>;
  if (!attempt) return <SafeAreaView style={styles.screen} edges={["top"]}><View style={[styles.content, { padding: 20, paddingTop: 12 }]}><BackButton onPress={() => router.replace("/(app)/transfer")} /><InlineState title="Transfer unavailable" description="This transfer is not available for the signed-in customer." action="Back to transfers" onPress={() => router.replace("/(app)/transfer")} /></View></SafeAreaView>;

  const definitiveSuccess = attempt.status === "succeeded";
  const returned = attempt.status === "returned";
  const pending = ["pending", "status-unknown", "return-pending", "submitting", "accepted-processing"].includes(attempt.status);
  return <SafeAreaView style={styles.screen} edges={["top"]}><ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 + insets.bottom, paddingTop: 12 }}><View style={[styles.content, { padding: 20, maxWidth: width >= 768 ? 760 : undefined }]}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/transfer")} /><View style={styles.resultHero}><View style={[styles.resultIcon, { backgroundColor: returned ? colors.greenSoft : definitiveSuccess ? colors.greenSoft : pending ? colors.orangeSoft : colors.dangerSoft }]}><Ionicons name={returned || definitiveSuccess ? "checkmark-circle-outline" : pending ? "time-outline" : "close-circle-outline"} size={44} color={returned || definitiveSuccess ? colors.green : pending ? colors.orange : colors.danger} /></View><Text accessibilityRole="header" style={styles.resultTitle}>{definitiveSuccess ? "Payment successful" : formatTransferStatus(attempt.status)}</Text>{definitiveSuccess ? <Text style={styles.resultAmount}>{formatIndianMinorUnits(attempt.amountMinorUnits)}</Text> : null}<View style={styles.demoBadge}><Text style={styles.demoBadgeText}>Demo transaction</Text></View><Text style={styles.resultSubtitle}>{attempt.status === "succeeded" ? "The synthetic demo ledger was updated." : attempt.status === "returned" ? "The original payment and its compensating return are linked in history." : attempt.status === "failed" ? "No demo ledger debit was recorded." : "The result is not final. Checking status does not submit another transfer."}</Text></View><View style={styles.reviewCard}><ResultRow label="Recipient" value={attempt.recipient.displayName} /><ResultRow label="Destination" value={attempt.recipient.maskedDestination} /><ResultRow label="Source account" value={`${attempt.sourceAccount.name} · •••• ${attempt.sourceAccount.lastFour}`} /><ResultRow label="Amount" value={formatIndianMinorUnits(attempt.amountMinorUnits)} /><ResultRow label="Method" value={methodLabel(attempt.method)} /><ResultRow label="Total debit" value={formatIndianMinorUnits(attempt.totalDebitMinorUnits)} /><ResultRow label="Created" value={formatDate(attempt.createdAt.slice(0, 10))} /><ResultRow label="Internal reference" value={attempt.internalReference} />{attempt.bankReference ? <ResultRow label="Bank reference" value={attempt.bankReference} /> : null}<View style={styles.demoBanner}><Ionicons name="information-circle-outline" size={19} color={colors.orange} /><Text style={styles.demoBannerText}>{attempt.status === "succeeded" || attempt.status === "returned" ? attempt.demoDisclosure : "Demo mode — no real money will be transferred."}</Text></View></View>{attempt.errorMessage ? <Text style={styles.errorText}>{attempt.errorMessage}</Text> : null}<View style={styles.resultActions}>{pending ? <Pressable accessibilityRole="button" onPress={() => void check()} disabled={busy} style={styles.primaryButton}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Check status</Text>}</Pressable> : null}<Pressable accessibilityRole="button" onPress={() => Share.share({ title: "Transfer receipt", message: `Transfer ${formatTransferStatus(attempt.status)}\n${attempt.internalReference}\n${attempt.demoDisclosure}` })} style={styles.secondaryButton}><Ionicons name="share-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryButtonText}>Share receipt</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/(app)/transfer")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Done</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/(app)/transfers/history")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>View transaction</Text></Pressable></View></View></ScrollView></SafeAreaView>;
}

export function TransferHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TransferAttemptStatusFilter>("all");
  const [history, setHistory] = useState<TransferHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { setState("loading"); void getTransferHistory({ customerId, filters: { search, status }, page }).then((next) => { setHistory(next); setState("ready"); }).catch(() => setState("error")); }, [customerId, page, search, status]);
  return <SafeAreaView style={styles.screen} edges={["top"]}><ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: 12, paddingBottom: 28 + insets.bottom }]}><View style={[styles.content, { padding: 20, maxWidth: 820 }]}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/transfer")} /><Text accessibilityRole="header" style={styles.title}>Transfer history</Text><Text style={styles.subtitle}>Search your simulated transfers and open any row for its receipt.</Text><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.secondary} /><TextInput accessibilityLabel="Search transfer history" value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search recipient or reference" placeholderTextColor={colors.muted} style={styles.searchInput} /></View><View style={styles.chipRow}>{(["all", "succeeded", "pending", "failed", "status-unknown", "returned"] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: status === item }} onPress={() => { setStatus(item); setPage(1); }} style={({ pressed }) => [styles.chip, status === item && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.chipText, status === item && styles.chipTextSelected]}>{item === "all" ? "All" : item === "succeeded" ? "Successful" : item === "status-unknown" ? "Unknown" : item === "returned" ? "Returned" : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>{state === "loading" ? <CenteredLoading label="Loading transfer history" /> : state === "error" ? <InlineState title="History unavailable" description="We could not load transfer history." action="Retry" onPress={() => setPage((current) => current)} /> : !history || history.items.length === 0 ? <InlineState title="No matching transfers" description="Completed, pending, failed, and returned attempts remain visible in this history." /> : <View style={styles.listCard}>{history.items.map((attempt) => <TransferRow key={attempt.id} attempt={attempt} onPress={() => router.push({ pathname: "/(app)/transfers/[transferId]", params: { transferId: attempt.id } })} />)}<View style={styles.pagination}><Text style={styles.paginationText}>{history.totalItems} records · page {history.page} of {history.totalPages}</Text><Pressable accessibilityRole="button" disabled={history.page >= history.totalPages} onPress={() => setPage((current) => current + 1)} style={[styles.secondaryButton, history.page >= history.totalPages && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Next</Text></Pressable></View></View>}</View></ScrollView></SafeAreaView>;
}

type TransferAttemptStatusFilter = "all" | "succeeded" | "pending" | "failed" | "status-unknown" | "returned";

function methodLabel(method: TransferMethod): string {
  return method === "internal" ? "Internal transfer" : method === "within-bank" ? "Within IDBI Bank" : method.toUpperCase();
}

function Progress({ step }: { step: TransferStep }) {
  const steps: TransferStep[] = ["recipient", "amount", "review"];
  return <View style={styles.progress} accessibilityLabel={`Transfer step ${steps.indexOf(step) + 1} of 3`}><Text style={[styles.progressItem, step === "recipient" && styles.progressActive]}>Recipient</Text><View style={styles.progressLine} /><Text style={[styles.progressItem, step === "amount" && styles.progressActive]}>Amount</Text><View style={styles.progressLine} /><Text style={[styles.progressItem, step === "review" && styles.progressActive]}>Review</Text></View>;
}

function AmountStep(props: { options: TransferOptions | null; draft: TransferDraft | null; sourceAccountId: string; amountInput: string; method: TransferMethod | ""; paymentMessage: string; privateNote: string; balanceVisibility: Record<string, boolean>; onSourceChange: (value: string) => void; onAmountChange: (value: string) => void; onMethodChange: (value: TransferMethod) => void; onPaymentMessage: (value: string) => void; onPrivateNote: (value: string) => void }) {
  const source = props.options?.eligibleSourceAccounts.find((account) => account.id === props.sourceAccountId);
  const sourceBalanceValue = source ? accountBalance(source) : null;
  const sourceBalance = !source
    ? "unavailable"
    : props.balanceVisibility[source.id] === false
      ? "hidden"
      : sourceBalanceValue === null
        ? "unavailable"
        : formatIndianMinorUnits(sourceBalanceValue);
  return (
    <View>
      <Text style={styles.formHeading}>Enter amount</Text>
      <Text style={styles.formDescription}>Choose the amount to send. Your available balance and transfer limits are checked before review.</Text>
      {props.draft ? (
        <View style={styles.recipientSummaryCard}>
          <View style={styles.summaryIcon}><Ionicons name={props.draft.destinationType === "upi" ? "at-outline" : "person-outline"} size={20} color={colors.greenDark} /></View>
          <View style={styles.summaryCopy}><Text style={styles.summaryLabel}>Recipient</Text><Text style={styles.summaryTitle}>{props.draft.recipient.displayName}</Text><Text style={styles.summaryDetail}>{props.draft.recipient.maskedDestination}{props.draft.recipient.bankName ? ` · ${props.draft.recipient.bankName}` : ""}</Text></View>
        </View>
      ) : null}
      <View style={styles.moneyPanel}>
        <Text style={styles.moneyLabel}>Amount</Text>
        <View style={styles.moneyInputRow}><Text style={styles.rupeeSymbol}>₹</Text><TextInput accessibilityLabel="Transfer amount in rupees" value={props.amountInput} onChangeText={props.onAmountChange} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" placeholderTextColor={colors.muted} style={styles.moneyInput} /></View>
        <Text style={styles.availableBalance}>Available balance {sourceBalance}</Text>
      </View>
      <Text style={styles.fieldLabel}>From account</Text>
      <AccountList accounts={props.options?.eligibleSourceAccounts ?? []} selectedId={props.sourceAccountId} onSelect={props.onSourceChange} balanceVisibility={props.balanceVisibility} />
      <Text style={styles.fieldLabel}>Transfer method</Text>
      <View style={styles.methodList}>{(props.options?.methods ?? []).map((item) => <Pressable key={item.method} accessibilityRole="radio" accessibilityState={{ selected: props.method === item.method, disabled: !item.available }} onPress={() => item.available && props.onMethodChange(item.method)} style={({ pressed }) => [styles.methodOption, props.method === item.method && styles.methodOptionSelected, !item.available && styles.disabledOption, pressed && styles.pressed]}><View style={styles.methodRadio}>{props.method === item.method ? <View style={styles.radioDot} /> : null}</View><View style={styles.methodCopy}><Text style={styles.methodTitle}>{item.label}</Text><Text style={styles.methodDescription}>{item.description}</Text><Text style={styles.methodTiming}>{item.available ? item.estimatedProcessing : item.unavailableReason}</Text></View></Pressable>)}</View>
      <Field label="Add note (optional)"><TextInput accessibilityLabel="Transfer note" value={props.paymentMessage} onChangeText={props.onPaymentMessage} maxLength={80} placeholder="For example, rent or monthly contribution" placeholderTextColor={colors.muted} style={styles.textInput} /></Field>
      <Field label="Private note (optional)"><TextInput accessibilityLabel="Private transfer note" value={props.privateNote} onChangeText={props.onPrivateNote} maxLength={240} placeholder="Saved only in this demo app" placeholderTextColor={colors.muted} style={styles.textInput} /></Field>
    </View>
  );
}

function ReviewStep({ draft, quote, onEditRecipient, onEditAmount }: { draft: TransferDraft | null; quote: TransferQuote | null; onEditRecipient: () => void; onEditAmount: () => void }) {
  if (!draft || !quote) return <InlineState title="Review unavailable" description="The transfer review needs to be prepared again." />;
  return <View><Text accessibilityRole="header" style={styles.formHeading}>Review transfer</Text><Text style={styles.formDescription}>Confirm the recipient, source, amount, and charges. No payment is submitted by opening this screen.</Text><ReviewCard title="Recipient" onEdit={onEditRecipient}><Text style={styles.reviewPrimary}>{quote.recipient.displayName}</Text><Text style={styles.reviewSecondary}>{quote.recipient.maskedDestination}{quote.recipient.bankName ? ` · ${quote.recipient.bankName}` : ""}</Text>{quote.recipient.bankReturnedName ? <Text style={styles.reviewHint}>Name returned by provider: {quote.recipient.bankReturnedName}{quote.recipient.enteredName && quote.recipient.enteredName !== quote.recipient.bankReturnedName ? ` · Name entered: ${quote.recipient.enteredName}` : ""}</Text> : null}<Text style={styles.reviewHint}>{quote.recipient.resolutionStatus === "resolved" ? "Recipient resolution returned by demo provider." : "Recipient lookup unavailable — do not treat syntax as verification."}</Text></ReviewCard><ReviewCard title="Source and method"><Text style={styles.reviewPrimary}>{quote.sourceAccount.name} · •••• {quote.sourceAccount.lastFour}</Text><Text style={styles.reviewSecondary}>{methodLabel(quote.method)} · {quote.estimatedProcessing}</Text></ReviewCard><ReviewCard title="Amount and charges" onEdit={onEditAmount}><ResultRow label="Amount" value={formatIndianMinorUnits(quote.amountMinorUnits)} /><ResultRow label="Fee" value={quote.feeMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(quote.feeMinorUnits)} /><ResultRow label="Tax" value={quote.taxMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(quote.taxMinorUnits)} /><ResultRow label="Total debit" value={formatIndianMinorUnits(quote.totalDebitMinorUnits)} /></ReviewCard>{draft.paymentMessage ? <ReviewCard title="Payment message"><Text style={styles.reviewSecondary}>{draft.paymentMessage}</Text></ReviewCard> : null}{draft.privateNote ? <ReviewCard title="Private note"><Text style={styles.reviewSecondary}>{draft.privateNote}</Text><Text style={styles.reviewHint}>This note stays in the app and is not sent to the recipient.</Text></ReviewCard> : null}<View style={styles.demoBanner}><Ionicons name="information-circle-outline" size={20} color={colors.orange} /><Text style={styles.demoBannerText}>Demo mode — no real money will be transferred.</Text></View></View>;
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) { return <View style={styles.reviewCard}><View style={styles.reviewCardHeader}><Text style={styles.reviewSectionLabel}>{title}</Text>{onEdit ? <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editLink}><Text style={styles.editLinkText}>Edit</Text></Pressable> : null}</View>{children}</View>; }

function AccountList({ accounts, selectedId, onSelect, balanceVisibility = {}, emptyText = "No eligible accounts are available." }: { accounts: BankAccount[]; selectedId: string; onSelect: (id: string) => void; balanceVisibility?: Record<string, boolean>; emptyText?: string }) { return accounts.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : <View style={styles.accountList}>{accounts.map((account) => { const balance = accountBalance(account); return <Pressable key={account.id} accessibilityRole="radio" accessibilityLabel={`${account.name} ending ${account.lastFour}`} accessibilityState={{ selected: selectedId === account.id }} onPress={() => onSelect(account.id)} style={[styles.accountOption, selectedId === account.id && styles.accountOptionSelected]}><View style={[styles.radio, selectedId === account.id && styles.radioSelected]}>{selectedId === account.id ? <View style={styles.radioDot} /> : null}</View><View style={styles.accountCopy}><Text style={styles.accountName}>{account.nickname ?? account.name} · •••• {account.lastFour}</Text><Text style={styles.accountBalance}>{balanceVisibility[account.id] === false ? "Balance hidden" : balance === null ? "Balance unavailable" : `${formatIndianMinorUnits(balance)} available`}</Text></View></Pressable>; })}</View>; }

function RecipientChoices({ beneficiaries, selectedId, onSelect }: { beneficiaries: Beneficiary[]; selectedId: string; onSelect: (id: string) => void }) { return <View style={styles.accountList}>{beneficiaries.map((beneficiary) => { const active = beneficiary.status === "active"; return <Pressable key={beneficiary.id} accessibilityRole="radio" accessibilityState={{ selected: selectedId === beneficiary.id, disabled: !active }} disabled={!active} onPress={() => onSelect(beneficiary.id)} style={[styles.accountOption, selectedId === beneficiary.id && styles.accountOptionSelected, !active && styles.disabledOption]}><View style={[styles.radio, selectedId === beneficiary.id && styles.radioSelected]}>{selectedId === beneficiary.id ? <View style={styles.radioDot} /> : null}</View><View style={styles.accountCopy}><Text style={styles.accountName}>{beneficiary.nickname ?? beneficiary.bankReturnedName ?? beneficiary.upiId ?? "Recipient"}</Text><Text style={styles.accountBalance}>{beneficiary.maskedAccountNumber ?? beneficiary.upiId}</Text><Text style={[styles.accountStatus, active ? styles.accountStatusActive : styles.accountStatusPending]}>{formatBeneficiaryStatus(beneficiary.status)}{!active ? " · Not ready for transfers" : ""}</Text></View></Pressable>; })}</View>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function BackButton({ onPress }: { onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress} style={styles.backButton}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>; }
function BeneficiaryRow({ beneficiary, onPress }: { beneficiary: Beneficiary; onPress: () => void }) { const active = beneficiary.status === "active"; return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !active }} disabled={!active} onPress={onPress} style={[styles.row, !active && styles.disabledRow]}><View style={styles.rowIcon}><Ionicons name={beneficiary.type === "upi" ? "at-outline" : "business-outline"} size={20} color={active ? colors.greenDark : colors.orange} /></View><View style={styles.rowCopy}><Text numberOfLines={1} style={styles.rowTitle}>{beneficiary.nickname ?? beneficiary.bankReturnedName ?? beneficiary.upiId ?? "Recipient"}</Text><Text numberOfLines={1} style={styles.rowSubtitle}>{beneficiary.maskedAccountNumber ?? beneficiary.upiId}</Text><Text style={[styles.rowStatus, active ? styles.rowStatusActive : styles.rowStatusPending]}>{formatBeneficiaryStatus(beneficiary.status)}{!active ? " · Not ready for transfers" : ""}</Text></View><Ionicons name="chevron-forward" size={19} color={active ? colors.muted : colors.border} /></Pressable>; }
function TransferRow({ attempt, onPress }: { attempt: TransferAttempt; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={styles.rowIcon}><Ionicons name={attempt.status === "succeeded" || attempt.status === "returned" ? "checkmark-circle-outline" : attempt.status === "failed" ? "close-circle-outline" : "time-outline"} size={20} color={attempt.status === "succeeded" || attempt.status === "returned" ? colors.greenDark : attempt.status === "failed" ? colors.danger : colors.orange} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{attempt.recipient.displayName}</Text><Text style={styles.rowSubtitle}>{formatIndianMinorUnits(attempt.amountMinorUnits)} · {methodLabel(attempt.method)} · {formatTransferStatus(attempt.status)}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>; }
function ResultRow({ label, value }: { label: string; value: string }) { return <View style={styles.resultRow}><Text style={styles.resultLabel}>{label}</Text><Text style={styles.resultValue}>{value}</Text></View>; }
function InlineState({ title, description, action, onPress, compact = false }: { title: string; description: string; action?: string; onPress?: () => void; compact?: boolean }) { return <View style={[styles.inlineState, compact && styles.compactInlineState]}><Ionicons name="swap-horizontal-outline" size={26} color={colors.greenDark} /><Text style={styles.inlineTitle}>{title}</Text><Text style={styles.inlineDescription}>{description}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{action}</Text></Pressable> : null}</View>; }
function LandingSkeleton() { return <View><TransferOptionListSkeleton /><View style={styles.loadingSection}><View style={styles.skeletonSectionTitle} /><View style={styles.skeletonRecipientStrip}><View style={styles.skeletonRecipient} /><View style={styles.skeletonRecipient} /><View style={styles.skeletonRecipient} /></View></View></View>; }
function CenteredLoading({ label }: { label: string }) { return <View style={styles.centered}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  fixedHeader: { backgroundColor: colors.background },
  scrollContent: { width: "100%", alignItems: "center", paddingTop: 12 },
  content: { width: "100%", alignSelf: "center" },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 54 },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "600" },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  headerAction: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  headerActionText: { marginLeft: 5, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  title: { marginTop: 16, color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: "800" },
  landingTitle: { marginTop: 28 },
  subtitle: { marginTop: 8, color: colors.secondary, fontSize: 16, lineHeight: 23 },
  demoBanner: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 13, borderRadius: 14, backgroundColor: colors.orangeSoft },
  demoBannerText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 13, lineHeight: 19 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 10 },
  listCard: { marginTop: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  disabledRow: { opacity: 0.72 },
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.greenSoft },
  rowCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rowSubtitle: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  rowStatus: { marginTop: 2, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  rowStatusActive: { color: colors.greenDark },
  rowStatusPending: { color: colors.orange },
  inlineState: { alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compactInlineState: { paddingVertical: 15, paddingHorizontal: 16 },
  inlineTitle: { marginTop: 9, color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  inlineDescription: { marginTop: 5, color: colors.secondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  recipientChoiceGroup: { marginTop: 18 },
  inputActionRow: { flexDirection: "row", alignItems: "flex-end", columnGap: 10 },
  inputActionField: { flex: 1 },
  verifyButton: { minHeight: 48, minWidth: 78, alignItems: "center", justifyContent: "center", marginBottom: 0, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.green },
  verifyButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  verifiedCard: { flexDirection: "row", alignItems: "center", marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: "#C8E3DB" },
  verifiedIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surface },
  verifiedCopy: { flex: 1, marginLeft: 9 },
  verifiedTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  verifiedDetail: { marginTop: 2, color: colors.greenDark, fontSize: 12, lineHeight: 17 },
  progress: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 20 },
  progressItem: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  progressActive: { color: colors.greenDark },
  progressLine: { flex: 1, height: 1, marginHorizontal: 8, backgroundColor: colors.border },
  formHeading: { color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: "800" },
  formDescription: { marginTop: 6, color: colors.secondary, fontSize: 14, lineHeight: 21 },
  field: { marginTop: 17 },
  fieldLabel: { marginBottom: 7, color: colors.text, fontSize: 13, fontWeight: "700" },
  textInput: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 15 },
  amountInput: { minHeight: 58, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 24, fontWeight: "800" },
  recipientSummaryCard: { flexDirection: "row", alignItems: "center", marginTop: 18, padding: 13, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  summaryIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.greenSoft },
  summaryCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  summaryLabel: { color: colors.secondary, fontSize: 11, lineHeight: 15, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  summaryTitle: { marginTop: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  summaryDetail: { marginTop: 1, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  moneyPanel: { alignItems: "center", marginTop: 16, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  moneyLabel: { color: colors.secondary, fontSize: 12, lineHeight: 17, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.45 },
  moneyInputRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  rupeeSymbol: { color: colors.text, fontSize: 27, lineHeight: 36, fontWeight: "700" },
  moneyInput: { minWidth: 110, paddingHorizontal: 6, paddingVertical: 0, color: colors.text, fontSize: 34, lineHeight: 42, fontWeight: "800", textAlign: "center" },
  availableBalance: { marginTop: 7, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  accountList: { gap: 8 },
  accountOption: { minHeight: 66, flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  accountOptionSelected: { backgroundColor: colors.greenSoft, borderColor: "#AED9CE" },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  accountCopy: { flex: 1, marginLeft: 10 },
  accountName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  accountBalance: { marginTop: 3, color: colors.secondary, fontSize: 12 },
  accountStatus: { marginTop: 2, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  accountStatusActive: { color: colors.greenDark },
  accountStatusPending: { color: colors.orange },
  emptyText: { padding: 15, borderRadius: 14, color: colors.secondary, backgroundColor: colors.surface, fontSize: 13, lineHeight: 19 },
  secondaryChoice: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  secondaryChoiceText: { marginLeft: 7, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  checkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", marginTop: 8 },
  checkbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: colors.muted },
  checkboxSelected: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: { marginLeft: 9, color: colors.secondary, fontSize: 13 },
  scanButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: "#B8DED5" },
  scanButtonText: { marginLeft: 7, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  methodList: { gap: 8 },
  methodOption: { minHeight: 72, flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  methodOptionSelected: { backgroundColor: colors.greenSoft, borderColor: "#AED9CE" },
  methodRadio: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1.5, borderColor: colors.muted },
  methodCopy: { flex: 1, marginLeft: 10 },
  methodTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  methodDescription: { marginTop: 2, color: colors.secondary, fontSize: 12 },
  methodTiming: { marginTop: 3, color: colors.muted, fontSize: 11 },
  disabledOption: { opacity: 0.55 },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 22, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.green },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: "800" },
  disabledButton: { opacity: 0.55 },
  secondaryButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10, paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.greenSoft },
  secondaryButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  reviewCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  reviewSectionLabel: { color: colors.secondary, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  editLink: { minHeight: 32, justifyContent: "center", paddingHorizontal: 4 },
  editLinkText: { color: colors.greenDark, fontSize: 13, fontWeight: "800" },
  reviewPrimary: { color: colors.text, fontSize: 16, fontWeight: "800" },
  reviewSecondary: { marginTop: 4, color: colors.secondary, fontSize: 14, lineHeight: 20 },
  reviewHint: { marginTop: 7, color: colors.muted, fontSize: 12, lineHeight: 17 },
  resultRow: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultLabel: { color: colors.secondary, fontSize: 13 },
  resultValue: { maxWidth: "58%", color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  errorText: { marginTop: 12, padding: 12, borderRadius: 11, color: colors.danger, backgroundColor: colors.dangerSoft, fontSize: 13, lineHeight: 19 },
  reviewCard: { marginTop: 12, padding: 16, borderRadius: 17, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  loadingSection: { marginTop: 25 },
  skeletonSectionTitle: { width: 148, height: 18, borderRadius: 9, backgroundColor: "#E7ECEE" },
  skeletonRecipientStrip: { flexDirection: "row", columnGap: 12, marginTop: 14 },
  skeletonRecipient: { width: 82, height: 96, borderRadius: 14, backgroundColor: "#EEF1F3" },
  resultHero: { alignItems: "center", paddingVertical: 22 },
  resultIcon: { width: 78, height: 78, alignItems: "center", justifyContent: "center", borderRadius: 39 },
  resultTitle: { marginTop: 14, color: colors.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  resultAmount: { marginTop: 5, color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: "800", textAlign: "center" },
  demoBadge: { marginTop: 9, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.orangeSoft },
  demoBadgeText: { color: colors.orange, fontSize: 11, lineHeight: 15, fontWeight: "800" },
  resultSubtitle: { maxWidth: 520, marginTop: 6, color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  resultActions: { marginTop: 6 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", marginTop: 12, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minHeight: 44, marginLeft: 8, color: colors.text, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.greenSoft, borderColor: "#AED9CE" },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: colors.greenDark },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  paginationText: { color: colors.secondary, fontSize: 12 },
  centered: { minHeight: 190, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: colors.secondary, fontSize: 13 },
  pressed: { opacity: 0.72 },
});
