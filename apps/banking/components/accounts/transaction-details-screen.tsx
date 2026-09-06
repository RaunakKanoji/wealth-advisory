import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accountColors, softCardShadow } from "@/components/accounts/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { getAccount, getAccountPreference, getTransaction, updateTransactionAnnotation, TRANSACTION_CATEGORIES } from "@/services/accounts-service";
import type { TransactionCategory } from "@/types/banking";

const categoryLabels: Record<TransactionCategory, string> = {
  salary: "Salary",
  shopping: "Shopping",
  food: "Food",
  bill: "Bill",
  transfer: "Transfer",
  refund: "Refund",
  cash: "Cash",
  deposit: "Deposit",
  interest: "Interest",
  other: "Other",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function TransactionDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { transactionId: rawTransactionId, accountId: rawAccountId } = useLocalSearchParams<{
    transactionId?: string | string[];
    accountId?: string | string[];
  }>();
  const transactionId = firstParam(rawTransactionId);
  const accountId = firstParam(rawAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getTransaction>>>(undefined);
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getAccount>>>(undefined);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [category, setCategory] = useState<TransactionCategory>("other");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    if (!accountId || !transactionId) {
      setIsLoading(false);
      setLoadError("This transaction link is missing account context.");
      return () => {
        active = false;
      };
    }

    void Promise.all([
      getAccount(accountId, { customerId }),
      getTransaction(accountId, transactionId, { customerId }),
      getAccountPreference(accountId, { customerId }),
    ])
      .then(([nextAccount, nextTransaction, preference]) => {
        if (!active) return;
        if (!nextAccount || !nextTransaction) {
          setLoadError("This transaction is unavailable or does not belong to the selected account.");
          return;
        }
        setAccount(nextAccount);
        setTransaction(nextTransaction);
        setBalanceVisible(preference.balanceVisible !== false);
        setCategory(nextTransaction.annotation?.category ?? nextTransaction.originalCategory);
        setNote(nextTransaction.annotation?.note ?? "");
      })
      .catch(() => {
        if (active) setLoadError("We couldn’t load this transaction. Please try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accountId, customerId, transactionId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/accounts");
  };

  const copyReference = () => {
    if (!transaction?.reference) return;
    try {
      Clipboard.setString(transaction.reference);
      setSavedMessage("Reference copied");
      Alert.alert("Reference copied", "The transaction reference is ready to paste.");
    } catch {
      Alert.alert("Copy unavailable", "The reference could not be copied on this device.");
    }
  };

  const saveAnnotation = async () => {
    if (!account || !transaction) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const nextTransaction = await updateTransactionAnnotation(
        account.id,
        transaction.id,
        { category, note },
        { customerId },
      );
      setTransaction(nextTransaction);
      setIsEditOpen(false);
      setSavedMessage("Your category and note were saved");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Your annotation could not be saved");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={accountColors.brandGreenDark} size="large" /><Text style={styles.loadingText}>Loading transaction details…</Text></View>;
  }

  if (!transaction || !account || loadError) {
    return <View style={styles.screen}><View style={[styles.content, { paddingBottom: 28 + insets.bottom, paddingTop: 17 + insets.top }]}><BackHeader onBack={goBack} /><View style={styles.stateCard}><Text style={styles.stateTitle}>Transaction unavailable</Text><Text style={styles.stateDescription}>{loadError ?? "This transaction could not be found."}</Text><Pressable accessibilityRole="button" onPress={() => router.replace("/(app)/(tabs)/accounts")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Go to Accounts</Text></Pressable></View></View></View>;
  }

  const isCredit = transaction.direction === "credit";
  const displayedAmount = balanceVisible ? `${isCredit ? "+" : "−"}${formatIndianMinorUnits(transaction.amountMinorUnits)}` : "Amount hidden";

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom, paddingTop: 17 + insets.top }]}>
        <BackHeader onBack={goBack} />
        <View style={styles.heroCard}>
          <View style={[styles.heroIcon, isCredit ? styles.creditIcon : styles.debitIcon]}><Ionicons name={isCredit ? "arrow-down-outline" : "arrow-up-outline"} size={27} color={isCredit ? "#007E5D" : "#6B7280"} /></View>
          <Text accessibilityRole="header" style={styles.heroTitle}>{transaction.counterparty ?? transaction.description}</Text>
          <Text style={[styles.heroAmount, isCredit ? styles.creditAmount : styles.debitAmount]}>{displayedAmount}</Text>
          <View style={styles.statusPill}><Text style={styles.statusText}>{transaction.status}</Text></View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Transaction information</Text>
          <InfoRow label="Account" value={`${account.nickname ?? account.name} · •••• ${account.lastFour}`} />
          <InfoRow label="Transaction date" value={`${formatDate(transaction.transactionDate)}${transaction.transactionTime ? ` · ${transaction.transactionTime}` : ""}`} />
          {transaction.postedDate ? <InfoRow label="Posted date" value={formatDate(transaction.postedDate)} /> : null}
          {transaction.valueDate ? <InfoRow label="Value date" value={formatDate(transaction.valueDate)} /> : null}
          <InfoRow label="Payment channel" value={transaction.channel} />
          <InfoRow label="Bank description" value={transaction.bankDescription} />
          <InfoRow label="Category" value={categoryLabels[transaction.annotation?.category ?? transaction.originalCategory]} />
          {transaction.reference ? <InfoRow label="Reference" value={transaction.reference} last /> : null}
        </View>

        {transaction.annotation?.note ? <View style={styles.noteCard}><Text style={styles.cardTitle}>Your note</Text><Text style={styles.noteText}>{transaction.annotation.note}</Text><Text style={styles.annotationHint}>Personal annotation · not supplied by the bank</Text></View> : null}

        <View style={styles.actionStack}>
          {transaction.reference ? <Pressable accessibilityRole="button" accessibilityLabel="Copy transaction reference" onPress={copyReference} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Ionicons name="copy-outline" size={19} color={accountColors.brandGreenDark} /><Text style={styles.secondaryButtonText}>Copy reference</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit transaction category and personal note" onPress={() => { setCategory(transaction.annotation?.category ?? transaction.originalCategory); setNote(transaction.annotation?.note ?? ""); setFormError(null); setIsEditOpen(true); }} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Ionicons name="create-outline" size={19} color={accountColors.brandGreenDark} /><Text style={styles.secondaryButtonText}>Edit category or note</Text></Pressable>
        </View>
        {savedMessage ? <Text style={styles.successText} accessibilityLiveRegion="polite">{savedMessage}</Text> : null}
        {transaction.linkedTransactionId ? <Text style={styles.linkedText}>Linked refund or reversal: {transaction.linkedTransactionId}</Text> : null}
      </ScrollView>

      <Modal visible={isEditOpen} transparent animationType="slide" onRequestClose={() => setIsEditOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.editModal}><View style={styles.modalHeader}><Text accessibilityRole="header" style={styles.modalTitle}>Edit personal annotation</Text><Pressable accessibilityRole="button" accessibilityLabel="Close annotation editor" onPress={() => setIsEditOpen(false)} style={styles.closeButton}><Ionicons name="close" size={23} color={accountColors.textPrimary} /></Pressable></View><Text style={styles.modalDescription}>The bank record remains unchanged. Your category and note are stored separately.</Text><Text style={styles.fieldLabel}>Category</Text><View style={styles.categoryGrid}>{TRANSACTION_CATEGORIES.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Set category to ${categoryLabels[item]}`} accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={({ pressed }) => [styles.categoryChip, category === item && styles.categoryChipSelected, pressed && styles.pressed]}><Text style={[styles.categoryChipText, category === item && styles.categoryChipTextSelected]}>{categoryLabels[item]}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>Personal note</Text><TextInput accessibilityLabel="Personal transaction note" value={note} onChangeText={setNote} placeholder="Add context for yourself" placeholderTextColor="#98A1AE" maxLength={240} multiline style={styles.noteInput} /><Text style={styles.characterHint}>{note.length}/240 characters</Text>{formError ? <Text style={styles.formError} accessibilityRole="alert">{formError}</Text> : null}<Pressable accessibilityRole="button" accessibilityState={{ busy: isSaving }} disabled={isSaving} onPress={() => void saveAnnotation()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSaving && styles.disabledButton]}>{isSaving ? <ActivityIndicator color="#FFFFFF" /> : null}<Text style={styles.primaryButtonText}>Save annotation</Text></Pressable></View></View>
      </Modal>
    </View>
  );
}

function BackHeader({ onBack }: { onBack: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Back to account" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} /><Text style={styles.backText}>Back</Text></Pressable>;
}

function InfoRow({ label, value, last = false }: { label: string; value?: string; last?: boolean }) {
  return <View style={[styles.infoRow, !last && styles.infoRowBorder]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value ?? "Not available from this data source"}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: accountColors.background },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", paddingHorizontal: 20, paddingTop: 17 },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: accountColors.textPrimary, fontSize: 16, fontWeight: "700" },
  heroCard: { alignItems: "center", marginTop: 13, padding: 24, borderRadius: 23, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  heroIcon: { width: 59, height: 59, alignItems: "center", justifyContent: "center", borderRadius: 30 },
  creditIcon: { backgroundColor: accountColors.brandGreenSoft },
  debitIcon: { backgroundColor: "#F2F3F5" },
  heroTitle: { maxWidth: "100%", marginTop: 15, color: accountColors.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: "700", textAlign: "center" },
  heroAmount: { marginTop: 11, fontSize: 29, lineHeight: 37, fontWeight: "700" },
  creditAmount: { color: accountColors.brandGreenDark },
  debitAmount: { color: accountColors.textPrimary },
  statusPill: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "#FFF4D8" },
  statusText: { color: "#8A5A10", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  infoCard: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border, ...softCardShadow },
  cardTitle: { color: accountColors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  infoCardTitle: { paddingTop: 8, paddingBottom: 7 },
  infoRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12, paddingVertical: 9 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: accountColors.divider },
  infoLabel: { flex: 1, color: accountColors.textSecondary, fontSize: 13, lineHeight: 18 },
  infoValue: { flex: 1.2, color: accountColors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "right" },
  noteCard: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: "#FFF8F3", borderWidth: 1, borderColor: "#F7D8C5" },
  noteText: { marginTop: 8, color: accountColors.textPrimary, fontSize: 14, lineHeight: 21 },
  annotationHint: { marginTop: 8, color: accountColors.textSecondary, fontSize: 11 },
  actionStack: { marginTop: 16, rowGap: 10 },
  secondaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, borderRadius: 12, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.brandGreenBorder },
  secondaryButtonText: { color: accountColors.brandGreenDark, fontSize: 14, fontWeight: "700" },
  successText: { marginTop: 13, color: accountColors.brandGreenDark, fontSize: 13, fontWeight: "600", textAlign: "center" },
  linkedText: { marginTop: 13, color: accountColors.textSecondary, fontSize: 12, textAlign: "center" },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 18, paddingHorizontal: 18, borderRadius: 12, backgroundColor: accountColors.brandGreenDark },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  disabledButton: { opacity: 0.6 },
  stateCard: { alignItems: "center", marginTop: 24, padding: 24, borderRadius: 20, backgroundColor: accountColors.surface, borderWidth: 1, borderColor: accountColors.border },
  stateTitle: { color: accountColors.textPrimary, fontSize: 19, fontWeight: "700", textAlign: "center" },
  stateDescription: { marginTop: 8, color: accountColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: accountColors.background },
  loadingText: { marginTop: 12, color: accountColors.textSecondary, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.32)" },
  editModal: { maxHeight: "90%", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: accountColors.surface },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: accountColors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: "700" },
  modalDescription: { marginTop: 5, color: accountColors.textSecondary, fontSize: 13, lineHeight: 19 },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  fieldLabel: { marginTop: 19, marginBottom: 8, color: accountColors.textSecondary, fontSize: 13, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  categoryChip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 11, borderRadius: 18, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: accountColors.border },
  categoryChipSelected: { backgroundColor: accountColors.brandGreenDark, borderColor: accountColors.brandGreenDark },
  categoryChipText: { color: accountColors.textSecondary, fontSize: 12, fontWeight: "600" },
  categoryChipTextSelected: { color: "#FFFFFF" },
  noteInput: { minHeight: 82, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: accountColors.border, color: accountColors.textPrimary, fontSize: 14, textAlignVertical: "top" },
  characterHint: { marginTop: 5, color: accountColors.textSecondary, fontSize: 11, textAlign: "right" },
  formError: { marginTop: 8, color: "#B93A2B", fontSize: 12 },
  pressed: { opacity: 0.75 },
});
