import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
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

type TransferStep = "recipient" | "amount" | "review";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function opaqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function accountBalance(account: BankAccount): number {
  return account.availableBalanceMinorUnits ?? account.balanceMinorUnits;
}

export function TransferLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { fromAccountId: rawFromAccountId } = useLocalSearchParams<{ fromAccountId?: string | string[] }>();
  const fromAccountId = firstParam(rawFromAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [recipients, setRecipients] = useState<(TransferRecipientSnapshot & { lastUsedAt: string })[]>([]);
  const [history, setHistory] = useState<TransferHistoryPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
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
  }, [customerId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const start = (destinationType: TransferDestinationType, params?: Record<string, string>) => {
    router.push({
      pathname: "/(app)/transfers/new",
      params: { type: destinationType, ...(fromAccountId ? { fromAccountId } : {}), ...params },
    });
  };

  const horizontalPadding = width < 375 ? 16 : 20;
  const bottomPadding = 28 + insets.bottom + 70;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}>
        <View style={[styles.content, { paddingHorizontal: horizontalPadding, maxWidth: width >= 768 ? 860 : undefined }]}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)")} />
            <Pressable accessibilityRole="button" accessibilityLabel="View transfer history" onPress={() => router.push("/(app)/transfers/history")} style={styles.headerAction}>
              <Ionicons name="time-outline" size={20} color={colors.greenDark} />
              <Text style={styles.headerActionText}>History</Text>
            </Pressable>
          </View>
          <Text accessibilityRole="header" style={styles.title}>Transfer money</Text>
          <Text style={styles.subtitle}>Choose where you want to send money.</Text>

          <View style={styles.demoBanner} accessibilityLiveRegion="polite">
            <Ionicons name="information-circle-outline" size={20} color={colors.orange} />
            <Text style={styles.demoBannerText}>Demo mode — no real money will be transferred.</Text>
          </View>

          <Text accessibilityRole="header" style={styles.sectionTitle}>Transfer options</Text>
          <View style={styles.optionGrid}>
            <TransferOption icon="swap-horizontal-outline" title="To my accounts" description="Move money between eligible accounts." onPress={() => start("own-account")} />
            <TransferOption icon="business-outline" title="To a bank account" description="Use a beneficiary or enter bank details." onPress={() => start("bank-account")} />
            <TransferOption icon="at-outline" title="To a UPI ID" description="Enter a UPI ID or continue from Scan QR." onPress={() => start("upi")} />
          </View>

          {state === "loading" ? <LandingSkeleton /> : state === "error" ? <InlineState title="Transfer data unavailable" description="We could not load recipients or recent activity." action="Retry" onPress={() => void load()} /> : (
            <>
              <SectionHeader title="Recent recipients" actionLabel="View all beneficiaries" onAction={() => router.push("/(app)/beneficiaries")} />
              {recipients.length === 0 ? <InlineState title="No recent recipients" description="Recipients will appear here after a transfer draft is used." /> : (
                <View style={styles.listCard}>
                  {recipients.map((recipient) => (
                    <RecipientRow key={`${recipient.type}:${recipient.maskedDestination}:${recipient.upiId ?? ""}`} recipient={recipient} onPress={() => start(recipient.type === "own-account" ? "own-account" : recipient.upiId ? "upi" : "bank-account", recipient.beneficiaryId ? { beneficiaryId: recipient.beneficiaryId } : recipient.upiId ? { upiId: recipient.upiId } : undefined)} />
                  ))}
                </View>
              )}

              <SectionHeader title="Saved beneficiaries" actionLabel="Add beneficiary" onAction={() => router.push("/(app)/beneficiaries?mode=add")} />
              {beneficiaries.length === 0 ? <InlineState title="No saved beneficiaries" description="Add a beneficiary when you are ready to use a bank account or UPI ID again." action="Add beneficiary" onPress={() => router.push("/(app)/beneficiaries?mode=add")} /> : (
                <View style={styles.listCard}>
                  {beneficiaries.slice(0, 3).map((beneficiary) => <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} onPress={() => start(beneficiary.type === "upi" ? "upi" : "bank-account", { beneficiaryId: beneficiary.id })} />)}
                </View>
              )}

              <SectionHeader title="Recent transfers" actionLabel="View all" onAction={() => router.push("/(app)/transfers/history")} />
              {!history || history.items.length === 0 ? <InlineState title="No transfer history" description="Your reviewed and submitted transfer attempts will appear here." /> : (
                <View style={styles.listCard}>
                  {history.items.map((attempt) => <TransferRow key={attempt.id} attempt={attempt} onPress={() => router.push({ pathname: "/(app)/transfers/[transferId]", params: { transferId: attempt.id } })} />)}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
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
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState(beneficiaryId ?? "");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
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
  }, [customerId, destinationType, fromAccountId]);

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
      <Text style={styles.formDescription}>A valid format is not proof that the recipient is safe. We will show the lookup state before review.</Text>
      {beneficiaries.length > 0 ? <RecipientChoices beneficiaries={beneficiaries} selectedId={selectedBeneficiaryId} onSelect={(value) => { setSelectedBeneficiaryId(value); setUpiId(""); }} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Enter a new UPI ID" onPress={() => { setSelectedBeneficiaryId(""); setUpiId(upiId || ""); }} style={styles.secondaryChoice}><Ionicons name="create-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryChoiceText}>Enter a new UPI ID</Text></Pressable>
      {!selectedBeneficiaryId ? <><Field label="UPI ID"><TextInput accessibilityLabel="UPI ID" value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" placeholder="name@bank" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Recipient name (optional)"><TextInput accessibilityLabel="Recipient name" value={recipientName} onChangeText={setRecipientName} placeholder="Name returned or entered for review" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveBeneficiary }} onPress={() => setSaveBeneficiary((current) => !current)} style={styles.checkRow}><View style={[styles.checkbox, saveBeneficiary && styles.checkboxSelected]}>{saveBeneficiary ? <Ionicons name="checkmark" size={15} color={colors.surface} /> : null}</View><Text style={styles.checkText}>Save this recipient for later</Text></Pressable></> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Scan a QR code" onPress={() => router.push("/(app)/scan-qr")} style={styles.scanButton}><Ionicons name="qr-code-outline" size={19} color={colors.greenDark} /><Text style={styles.scanButtonText}>Scan QR instead</Text></Pressable>
    </View>
  ) : (
    <View>
      <Text style={styles.formHeading}>Choose a bank recipient</Text>
      <Text style={styles.formDescription}>Use an active beneficiary or enter a new destination. A saved row in this prototype is not a live bank registration.</Text>
      {beneficiaries.length > 0 ? <RecipientChoices beneficiaries={beneficiaries} selectedId={selectedBeneficiaryId} onSelect={(value) => { setSelectedBeneficiaryId(value); setNewBank(false); }} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Enter a new bank account" onPress={() => { setSelectedBeneficiaryId(""); setNewBank(true); }} style={styles.secondaryChoice}><Ionicons name="add-circle-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryChoiceText}>Enter a new bank account</Text></Pressable>
      {newBank || !selectedBeneficiaryId && beneficiaries.length === 0 ? <><Field label="Account number"><TextInput accessibilityLabel="Recipient account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" maxLength={24} placeholder="Enter account number" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Confirm account number"><TextInput accessibilityLabel="Confirm recipient account number" value={confirmAccountNumber} onChangeText={setConfirmAccountNumber} keyboardType="number-pad" maxLength={24} placeholder="Re-enter account number" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="IFSC"><TextInput accessibilityLabel="Recipient IFSC" value={ifsc} onChangeText={(value) => setIfsc(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="IBKL0000123" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Recipient name"><TextInput accessibilityLabel="Recipient name" value={recipientName} onChangeText={setRecipientName} placeholder="Name entered for review" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveBeneficiary }} onPress={() => setSaveBeneficiary((current) => !current)} style={styles.checkRow}><View style={[styles.checkbox, saveBeneficiary && styles.checkboxSelected]}>{saveBeneficiary ? <Ionicons name="checkmark" size={15} color={colors.surface} /> : null}</View><Text style={styles.checkText}>Save beneficiary</Text></Pressable></> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 34 + insets.bottom }]}>
          <View style={[styles.content, { paddingHorizontal: width < 375 ? 16 : 20, maxWidth: width >= 768 ? 760 : undefined }]}>
            <View style={styles.headerRow}><BackButton onPress={back} /><Text accessibilityRole="header" style={styles.headerTitle}>Transfer money</Text><View style={styles.headerSpacer} /></View>
            <Progress step={step} />
            {step === "recipient" ? recipientStep : step === "amount" ? <AmountStep options={options} draft={draft} sourceAccountId={sourceAccountId} amountInput={amountInput} method={method} paymentMessage={paymentMessage} privateNote={privateNote} balanceVisibility={balanceVisibility} onSourceChange={setSourceAccountId} onAmountChange={setAmountInput} onMethodChange={setMethod} onPaymentMessage={setPaymentMessage} onPrivateNote={setPrivateNote} /> : <ReviewStep draft={draft} quote={quote} onEditRecipient={() => { setDraft(null); setQuote(null); setStep("recipient"); }} onEditAmount={() => { setQuote(null); setStep("amount"); }} />}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy || !options || (step === "amount" && !draft) || (step === "review" && (!draft || !quote))} onPress={() => void (step === "recipient" ? createDraftAndContinue() : step === "amount" ? prepareReview() : confirm())} style={({ pressed }) => [styles.primaryButton, (busy || !options) && styles.disabledButton, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{step === "recipient" ? "Continue" : step === "amount" ? "Review transfer" : `Simulate transfer of ${quote ? formatIndianMinorUnits(quote.amountMinorUnits) : "₹ —"}`}</Text>}
            </Pressable>
            {step === "review" ? <Text style={styles.reviewHint}>Opening review does not submit a payment. Confirmation creates one persisted transfer attempt.</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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

  if (state === "loading") return <CenteredLoading label="Loading transfer status" />;
  if (!attempt) return <View style={styles.screen}><View style={[styles.content, { padding: 20 }]}><BackButton onPress={() => router.replace("/(app)/transfer")} /><InlineState title="Transfer unavailable" description="This transfer is not available for the signed-in customer." action="Back to transfers" onPress={() => router.replace("/(app)/transfer")} /></View></View>;

  const definitiveSuccess = attempt.status === "succeeded";
  const returned = attempt.status === "returned";
  const pending = ["pending", "status-unknown", "return-pending", "submitting", "accepted-processing"].includes(attempt.status);
  return <View style={styles.screen}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}><View style={[styles.content, { padding: 20, maxWidth: width >= 768 ? 760 : undefined }]}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/transfer")} /><View style={styles.resultHero}><View style={[styles.resultIcon, { backgroundColor: returned ? colors.greenSoft : definitiveSuccess ? colors.greenSoft : pending ? colors.orangeSoft : colors.dangerSoft }]}><Ionicons name={returned || definitiveSuccess ? "checkmark-circle-outline" : pending ? "time-outline" : "close-circle-outline"} size={44} color={returned || definitiveSuccess ? colors.green : pending ? colors.orange : colors.danger} /></View><Text accessibilityRole="header" style={styles.resultTitle}>{formatTransferStatus(attempt.status)}</Text><Text style={styles.resultSubtitle}>{attempt.status === "succeeded" ? "The synthetic demo ledger was updated." : attempt.status === "returned" ? "The original payment and its compensating return are linked in history." : attempt.status === "failed" ? "No demo ledger debit was recorded." : "The result is not final. Checking status does not submit another transfer."}</Text></View><View style={styles.reviewCard}><ResultRow label="Recipient" value={attempt.recipient.displayName} /><ResultRow label="Destination" value={attempt.recipient.maskedDestination} /><ResultRow label="Source account" value={`${attempt.sourceAccount.name} · •••• ${attempt.sourceAccount.lastFour}`} /><ResultRow label="Amount" value={formatIndianMinorUnits(attempt.amountMinorUnits)} /><ResultRow label="Method" value={methodLabel(attempt.method)} /><ResultRow label="Total debit" value={formatIndianMinorUnits(attempt.totalDebitMinorUnits)} /><ResultRow label="Created" value={formatDate(attempt.createdAt.slice(0, 10))} /><ResultRow label="Internal reference" value={attempt.internalReference} />{attempt.bankReference ? <ResultRow label="Bank reference" value={attempt.bankReference} /> : null}<View style={styles.demoBanner}><Ionicons name="information-circle-outline" size={19} color={colors.orange} /><Text style={styles.demoBannerText}>{attempt.status === "succeeded" || attempt.status === "returned" ? attempt.demoDisclosure : "Demo mode — no real money will be transferred."}</Text></View></View>{attempt.errorMessage ? <Text style={styles.errorText}>{attempt.errorMessage}</Text> : null}<View style={styles.resultActions}>{pending ? <Pressable accessibilityRole="button" onPress={() => void check()} disabled={busy} style={styles.primaryButton}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Check status</Text>}</Pressable> : null}<Pressable accessibilityRole="button" onPress={() => Share.share({ title: "Transfer acknowledgement", message: `Transfer ${formatTransferStatus(attempt.status)}\n${attempt.internalReference}\n${attempt.demoDisclosure}` })} style={styles.secondaryButton}><Ionicons name="share-outline" size={18} color={colors.greenDark} /><Text style={styles.secondaryButtonText}>Share acknowledgement</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/(app)/transfer")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Start another transfer</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/(app)/transfers/history")} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>View transfer history</Text></Pressable></View></View></ScrollView></View>;
}

export function TransferHistoryScreen() {
  const router = useRouter();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TransferAttemptStatusFilter>("all");
  const [history, setHistory] = useState<TransferHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { setState("loading"); void getTransferHistory({ customerId, filters: { search, status }, page }).then((next) => { setHistory(next); setState("ready"); }).catch(() => setState("error")); }, [customerId, page, search, status]);
  return <View style={styles.screen}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}><View style={[styles.content, { padding: 20, maxWidth: 820 }]}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/transfer")} /><Text accessibilityRole="header" style={styles.title}>Transfer history</Text><Text style={styles.subtitle}>Search the same persisted attempts used by result screens and recent activity.</Text><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.secondary} /><TextInput accessibilityLabel="Search transfer history" value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search recipient or reference" placeholderTextColor={colors.muted} style={styles.searchInput} /></View><View style={styles.chipRow}>{(["all", "succeeded", "pending", "failed", "status-unknown", "returned"] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: status === item }} onPress={() => { setStatus(item); setPage(1); }} style={[styles.chip, status === item && styles.chipSelected]}><Text style={[styles.chipText, status === item && styles.chipTextSelected]}>{item === "all" ? "All" : item === "status-unknown" ? "Unknown" : item === "succeeded" ? "Confirmed" : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>{state === "loading" ? <CenteredLoading label="Loading transfer history" /> : state === "error" ? <InlineState title="History unavailable" description="We could not load transfer history." action="Retry" onPress={() => setPage((current) => current)} /> : !history || history.items.length === 0 ? <InlineState title="No matching transfers" description="Completed, pending, failed, and returned attempts remain visible in this history." /> : <View style={styles.listCard}>{history.items.map((attempt) => <TransferRow key={attempt.id} attempt={attempt} onPress={() => router.push({ pathname: "/(app)/transfers/[transferId]", params: { transferId: attempt.id } })} />)}<View style={styles.pagination}><Text style={styles.paginationText}>{history.totalItems} records · page {history.page} of {history.totalPages}</Text><Pressable accessibilityRole="button" disabled={history.page >= history.totalPages} onPress={() => setPage((current) => current + 1)} style={[styles.secondaryButton, history.page >= history.totalPages && styles.disabledButton]}><Text style={styles.secondaryButtonText}>Next</Text></Pressable></View></View>}</View></ScrollView></View>;
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
  return <View><Text style={styles.formHeading}>Enter transfer amount</Text><Text style={styles.formDescription}>The source balance and provider constraints are checked again before review and confirmation.</Text><Field label="Amount in INR"><TextInput accessibilityLabel="Transfer amount in INR" value={props.amountInput} onChangeText={props.onAmountChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} style={styles.amountInput} /></Field><Text style={styles.fieldLabel}>Funding account</Text><AccountList accounts={props.options?.eligibleSourceAccounts ?? []} selectedId={props.sourceAccountId} onSelect={props.onSourceChange} balanceVisibility={props.balanceVisibility} /><Text style={styles.fieldLabel}>Payment method</Text><View style={styles.methodList}>{(props.options?.methods ?? []).map((item) => <Pressable key={item.method} accessibilityRole="radio" accessibilityState={{ selected: props.method === item.method, disabled: !item.available }} onPress={() => item.available && props.onMethodChange(item.method)} style={[styles.methodOption, props.method === item.method && styles.methodOptionSelected, !item.available && styles.disabledOption]}><View style={styles.methodRadio}>{props.method === item.method ? <View style={styles.radioDot} /> : null}</View><View style={styles.methodCopy}><Text style={styles.methodTitle}>{item.label}</Text><Text style={styles.methodDescription}>{item.description}</Text><Text style={styles.methodTiming}>{item.available ? item.estimatedProcessing : item.unavailableReason}</Text></View></Pressable>)}</View><Field label="Payment message (sent with transfer, optional)"><TextInput accessibilityLabel="Payment message" value={props.paymentMessage} onChangeText={props.onPaymentMessage} maxLength={80} placeholder="Visible to recipient when supported" placeholderTextColor={colors.muted} style={styles.textInput} /></Field><Field label="Private note (app only, optional)"><TextInput accessibilityLabel="Private note" value={props.privateNote} onChangeText={props.onPrivateNote} maxLength={240} placeholder="Not sent to the recipient" placeholderTextColor={colors.muted} style={styles.textInput} /></Field></View>;
}

function ReviewStep({ draft, quote, onEditRecipient, onEditAmount }: { draft: TransferDraft | null; quote: TransferQuote | null; onEditRecipient: () => void; onEditAmount: () => void }) {
  if (!draft || !quote) return <InlineState title="Review unavailable" description="The transfer review needs to be prepared again." />;
  return <View><Text accessibilityRole="header" style={styles.formHeading}>Review transfer</Text><Text style={styles.formDescription}>Confirm the recipient, source, amount, and charges. No payment is submitted by opening this screen.</Text><ReviewCard title="Recipient" onEdit={onEditRecipient}><Text style={styles.reviewPrimary}>{quote.recipient.displayName}</Text><Text style={styles.reviewSecondary}>{quote.recipient.maskedDestination}{quote.recipient.bankName ? ` · ${quote.recipient.bankName}` : ""}</Text>{quote.recipient.bankReturnedName ? <Text style={styles.reviewHint}>Name returned by provider: {quote.recipient.bankReturnedName}{quote.recipient.enteredName && quote.recipient.enteredName !== quote.recipient.bankReturnedName ? ` · Name entered: ${quote.recipient.enteredName}` : ""}</Text> : null}<Text style={styles.reviewHint}>{quote.recipient.resolutionStatus === "resolved" ? "Recipient resolution returned by demo provider." : "Recipient lookup unavailable — do not treat syntax as verification."}</Text></ReviewCard><ReviewCard title="Source and method"><Text style={styles.reviewPrimary}>{quote.sourceAccount.name} · •••• {quote.sourceAccount.lastFour}</Text><Text style={styles.reviewSecondary}>{methodLabel(quote.method)} · {quote.estimatedProcessing}</Text></ReviewCard><ReviewCard title="Amount and charges" onEdit={onEditAmount}><ResultRow label="Amount" value={formatIndianMinorUnits(quote.amountMinorUnits)} /><ResultRow label="Fee" value={quote.feeMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(quote.feeMinorUnits)} /><ResultRow label="Tax" value={quote.taxMinorUnits === undefined ? "Unavailable" : formatIndianMinorUnits(quote.taxMinorUnits)} /><ResultRow label="Total debit" value={formatIndianMinorUnits(quote.totalDebitMinorUnits)} /></ReviewCard>{draft.paymentMessage ? <ReviewCard title="Payment message"><Text style={styles.reviewSecondary}>{draft.paymentMessage}</Text></ReviewCard> : null}{draft.privateNote ? <ReviewCard title="Private note"><Text style={styles.reviewSecondary}>{draft.privateNote}</Text><Text style={styles.reviewHint}>This note stays in the app and is not sent to the recipient.</Text></ReviewCard> : null}<View style={styles.demoBanner}><Ionicons name="information-circle-outline" size={20} color={colors.orange} /><Text style={styles.demoBannerText}>Demo mode — no real money will be transferred.</Text></View></View>;
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) { return <View style={styles.reviewCard}><View style={styles.reviewCardHeader}><Text style={styles.reviewSectionLabel}>{title}</Text>{onEdit ? <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editLink}><Text style={styles.editLinkText}>Edit</Text></Pressable> : null}</View>{children}</View>; }

function AccountList({ accounts, selectedId, onSelect, balanceVisibility = {}, emptyText = "No eligible accounts are available." }: { accounts: BankAccount[]; selectedId: string; onSelect: (id: string) => void; balanceVisibility?: Record<string, boolean>; emptyText?: string }) { return accounts.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : <View style={styles.accountList}>{accounts.map((account) => <Pressable key={account.id} accessibilityRole="radio" accessibilityLabel={`${account.name} ending ${account.lastFour}`} accessibilityState={{ selected: selectedId === account.id }} onPress={() => onSelect(account.id)} style={[styles.accountOption, selectedId === account.id && styles.accountOptionSelected]}><View style={[styles.radio, selectedId === account.id && styles.radioSelected]}>{selectedId === account.id ? <View style={styles.radioDot} /> : null}</View><View style={styles.accountCopy}><Text style={styles.accountName}>{account.nickname ?? account.name} · •••• {account.lastFour}</Text><Text style={styles.accountBalance}>{balanceVisibility[account.id] === false ? "Balance hidden" : `${formatIndianMinorUnits(accountBalance(account))} available`}</Text></View></Pressable>)}</View>; }

function RecipientChoices({ beneficiaries, selectedId, onSelect }: { beneficiaries: Beneficiary[]; selectedId: string; onSelect: (id: string) => void }) { return <View style={styles.accountList}>{beneficiaries.map((beneficiary) => <Pressable key={beneficiary.id} accessibilityRole="radio" accessibilityState={{ selected: selectedId === beneficiary.id }} onPress={() => onSelect(beneficiary.id)} style={[styles.accountOption, selectedId === beneficiary.id && styles.accountOptionSelected]}><View style={[styles.radio, selectedId === beneficiary.id && styles.radioSelected]}>{selectedId === beneficiary.id ? <View style={styles.radioDot} /> : null}</View><View style={styles.accountCopy}><Text style={styles.accountName}>{beneficiary.nickname ?? beneficiary.bankReturnedName ?? beneficiary.upiId ?? "Recipient"}</Text><Text style={styles.accountBalance}>{beneficiary.maskedAccountNumber ?? beneficiary.upiId} · {beneficiary.status.replace("-", " ")}</Text></View></Pressable>)}</View>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function BackButton({ onPress }: { onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress} style={styles.backButton}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>; }
function TransferOption({ icon, title, description, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; description: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name={icon} size={24} color={colors.greenDark} /></View><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionDescription}>{description}</Text><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>; }
function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) { return <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{actionLabel}</Text></Pressable></View>; }
function RecipientRow({ recipient, onPress }: { recipient: TransferRecipientSnapshot & { lastUsedAt: string }; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={styles.rowIcon}><Ionicons name={recipient.upiId ? "at-outline" : "person-outline"} size={20} color={colors.greenDark} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{recipient.displayName}</Text><Text style={styles.rowSubtitle}>{recipient.maskedDestination}{recipient.bankName ? ` · ${recipient.bankName}` : ""}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>; }
function BeneficiaryRow({ beneficiary, onPress }: { beneficiary: Beneficiary; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={styles.rowIcon}><Ionicons name={beneficiary.type === "upi" ? "at-outline" : "business-outline"} size={20} color={colors.greenDark} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{beneficiary.nickname ?? beneficiary.bankReturnedName ?? beneficiary.upiId ?? "Recipient"}</Text><Text style={styles.rowSubtitle}>{beneficiary.maskedAccountNumber ?? beneficiary.upiId} · {beneficiary.status.replace("-", " ")}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>; }
function TransferRow({ attempt, onPress }: { attempt: TransferAttempt; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={styles.rowIcon}><Ionicons name={attempt.status === "succeeded" || attempt.status === "returned" ? "checkmark-circle-outline" : attempt.status === "failed" ? "close-circle-outline" : "time-outline"} size={20} color={attempt.status === "succeeded" || attempt.status === "returned" ? colors.greenDark : attempt.status === "failed" ? colors.danger : colors.orange} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{attempt.recipient.displayName}</Text><Text style={styles.rowSubtitle}>{formatIndianMinorUnits(attempt.amountMinorUnits)} · {methodLabel(attempt.method)} · {formatTransferStatus(attempt.status)}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>; }
function ResultRow({ label, value }: { label: string; value: string }) { return <View style={styles.resultRow}><Text style={styles.resultLabel}>{label}</Text><Text style={styles.resultValue}>{value}</Text></View>; }
function InlineState({ title, description, action, onPress }: { title: string; description: string; action?: string; onPress?: () => void }) { return <View style={styles.inlineState}><Ionicons name="swap-horizontal-outline" size={26} color={colors.greenDark} /><Text style={styles.inlineTitle}>{title}</Text><Text style={styles.inlineDescription}>{description}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{action}</Text></Pressable> : null}</View>; }
function LandingSkeleton() { return <View style={styles.listCard}><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, styles.skeletonShort]} /><View style={styles.skeletonLine} /></View>; }
function CenteredLoading({ label }: { label: string }) { return <View style={styles.centered}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 16, lineHeight: 23 },
  demoBanner: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 13, borderRadius: 14, backgroundColor: colors.orangeSoft },
  demoBannerText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 13, lineHeight: 19 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "800" },
  sectionAction: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  optionGrid: { gap: 10, marginTop: 16 },
  optionCard: { minHeight: 100, padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  optionIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.greenSoft },
  optionTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: "800" },
  optionDescription: { maxWidth: "85%", marginTop: 3, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  listCard: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.greenSoft },
  rowCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rowSubtitle: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  inlineState: { alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inlineTitle: { marginTop: 9, color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  inlineDescription: { marginTop: 5, color: colors.secondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  skeletonLine: { height: 16, margin: 15, borderRadius: 8, backgroundColor: "#EEF1F3" },
  skeletonShort: { width: "45%", marginTop: 0 },
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
  accountList: { gap: 8 },
  accountOption: { minHeight: 66, flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  accountOptionSelected: { backgroundColor: colors.greenSoft, borderColor: "#AED9CE" },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  accountCopy: { flex: 1, marginLeft: 10 },
  accountName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  accountBalance: { marginTop: 3, color: colors.secondary, fontSize: 12 },
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
  resultHero: { alignItems: "center", paddingVertical: 22 },
  resultIcon: { width: 78, height: 78, alignItems: "center", justifyContent: "center", borderRadius: 39 },
  resultTitle: { marginTop: 14, color: colors.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  resultSubtitle: { maxWidth: 520, marginTop: 6, color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  resultActions: { marginTop: 6 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", marginTop: 20, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
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
