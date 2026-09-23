import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { appColors, appRadii, appShadows } from "@/components/theme/tokens";
import { formatIndianMinorUnits, formatTransactionAmount } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useStableGetToken } from "@/lib/api/use-stable-get-token";
import { TRANSACTION_CATEGORIES } from "@/services/accounts-service";
import { activityDirectionLabel, activityTypeLabel, getActivityDetail, getRemoteActivityDetail, updateActivityAnnotation } from "@/services/transaction-explorer-service";
import type { TransactionCategory } from "@/types/banking";
import type { ActivityRecord } from "@/types/transaction-explorer";

const colors = {
  background: appColors.background,
  surface: appColors.surface,
  text: appColors.textPrimary,
  secondary: appColors.textSecondary,
  muted: appColors.textMuted,
  green: appColors.primary,
  greenDark: appColors.primaryPressed,
  greenSoft: appColors.primarySoft,
  border: appColors.border,
  orangeSoft: appColors.warningSoft,
  orange: appColors.warning,
  danger: appColors.danger,
};

function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

export function TransactionActivityDetailsScreen() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;

  if (!isUserLoaded) {
    return <TransactionActivityLoadingScreen />;
  }

  return (
    <CustomerTransactionActivityDetailsScreen
      key={customerId}
      customerId={customerId}
      isUserLoaded={isUserLoaded}
    />
  );
}

function CustomerTransactionActivityDetailsScreen({
  customerId,
  isUserLoaded,
}: {
  customerId: string;
  isUserLoaded: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getToken: clerkGetToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);
  const params = useLocalSearchParams<{ activityId?: string | string[]; transactionId?: string | string[]; accountId?: string | string[]; cardId?: string | string[] }>();
  const activityId = firstParam(params.activityId);
  const transactionId = firstParam(params.transactionId);
  const accountId = firstParam(params.accountId);
  const cardId = firstParam(params.cardId);
  const [activity, setActivity] = useState<ActivityRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [category, setCategory] = useState<TransactionCategory | undefined>();
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (isRemoteDataEnabled && !isFinancialAuthReady(isAuthLoaded, isSignedIn)) return;
    let active = true;
    setState("loading");
    const detail = isRemoteDataEnabled
      ? getRemoteActivityDetail({ activityId, transactionId, accountId, cardId }, { getToken })
      : getActivityDetail({ activityId, transactionId, accountId, cardId }, customerId);
    void detail.then((next) => {
      if (!active) return;
      setActivity(next ?? null);
      setState(next ? "ready" : "error");
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [accountId, activityId, cardId, customerId, getToken, isAuthLoaded, isSignedIn, transactionId]);

  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(app)/activity");
  const openEditor = () => {
    if (!activity) return;
    setCategory(activity.annotation?.category ?? activity.category);
    setNote(activity.annotation?.note ?? "");
    setSaveState("idle");
    setEditOpen(true);
  };
  const saveAnnotation = async () => {
    if (!activity || activity.sourceKind === "transfer-group") return;
    setSaveState("saving");
    try {
      const next = await updateActivityAnnotation(activity, { category, note: note.trim() || undefined }, customerId);
      if (next) setActivity(next);
      setSaveState("saved");
      setEditOpen(false);
    } catch {
      setSaveState("error");
    }
  };
  const askCoach = () => {
    if (!activity) return;
    const transactionReference = activity.sourceReferences.find((source) => (
      source.kind === (activity.sourceKind === "card-event" ? "card-transaction" : "account-transaction")
    )) ?? activity.sourceReferences.find((source) => source.kind === "account-transaction" || source.kind === "card-transaction");
    const coachParams: Record<string, string> = {
      period: "all",
      source: "transaction-detail",
      transactionId: transactionReference?.id ?? activity.id,
      prompt: "Explain this selected transaction, including its category, status, and bank-recorded evidence.",
    };
    if (activity.accountId) coachParams.accountId = activity.accountId;
    if (activity.cardId) coachParams.cardId = activity.cardId;
    if (activity.category !== "other") coachParams.category = activity.category;
    router.push({ pathname: "/(app)/coach/chat", params: coachParams });
  };

  const horizontalPadding = width < 375 ? 16 : 20;
  if (!isBalanceVisibilityHydrated || state === "loading") return <TransactionActivityLoadingScreen />;
  if (!activity || state === "error") return <View style={styles.screen}><View style={[styles.content, { paddingHorizontal: horizontalPadding, paddingTop: insets.top + 8 }]}><BackButton onPress={goBack} /><StateCard title="Transaction unavailable" description="This record is unavailable or outside the signed-in customer’s scope." /></View></View>;

  const isCredit = activity.direction === "credit";
  const isTransfer = activity.direction === "transfer";
  const displayedAmount = balanceVisible
    ? formatTransactionAmount(activity.amountMinorUnits, isTransfer ? "transfer" : isCredit ? "credit" : "debit")
    : "Amount hidden";
  const canAnnotate = !isRemoteDataEnabled && activity.sourceKind !== "transfer-group" && activity.sourceReferences.some((source) => source.kind === "account-transaction" || source.kind === "card-transaction");

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 34 + insets.bottom }}
      >
        <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
          <BackButton onPress={goBack} />
          <View style={styles.titleRow}>
            <View style={styles.titleColumn}>
              <Text accessibilityRole="header" style={styles.title}>Transaction details</Text>
              <Text style={styles.subtitle}>
                {activity.sourceKind === "transfer-group" ? "Grouped own-account movement" : activity.accountLabel ?? activity.cardLabel ?? "Source details"}
              </Text>
            </View>
            <Text style={styles.demoBadge}>{activity.sourceEnvironment.startsWith("Account Aggregator") ? "Account Aggregator" : isRemoteDataEnabled ? "Bank API" : "Demo"}</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={[styles.heroIcon, isCredit ? styles.creditIcon : isTransfer ? styles.transferIcon : styles.debitIcon]}>
              <Ionicons
                name={isTransfer ? "swap-horizontal-outline" : isCredit ? "arrow-down-outline" : "arrow-up-outline"}
                size={25}
                color={isCredit ? colors.greenDark : colors.secondary}
              />
            </View>
            <Text numberOfLines={2} style={styles.heroTitle}>{activity.title}</Text>
            <Text style={[styles.heroAmount, isCredit ? styles.creditAmount : isTransfer ? null : styles.debitAmount]}>
              {displayedAmount}
            </Text>
            <Text style={styles.status}>{activity.status} · {activityTypeLabel(activity.transactionType)} · {activityDirectionLabel(activity)}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={askCoach} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
              <Ionicons name="sparkles-outline" size={18} color={colors.greenDark} />
              <Text style={styles.actionText}>Ask Coach</Text>
            </Pressable>
            {canAnnotate ? (
              <Pressable accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                <Ionicons name="create-outline" size={18} color={colors.greenDark} />
                <Text style={styles.actionText}>Annotate</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/support")} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
              <Ionicons name="help-circle-outline" size={18} color={colors.greenDark} />
              <Text style={styles.actionText}>Get help</Text>
            </Pressable>
          </View>

          <InfoCard title="Transaction information">
            <InfoRow label="Description" value={activity.description} />
            <InfoRow label="Bank description" value={activity.bankDescription ?? activity.description} />
            <InfoRow label="Transaction date" value={formatDate(activity.transactionDate)} />
            <InfoRow label="Posted date" value={activity.postedDate ? formatDate(activity.postedDate) : "Not posted"} />
            <InfoRow label="Value date" value={activity.valueDate ? formatDate(activity.valueDate) : "Not supplied"} />
            <InfoRow label="Channel" value={activity.channel ?? "Not supplied"} />
            <InfoRow label="Original category" value={activity.originalCategory ?? activity.category} />
            <InfoRow label="Effective category" value={activity.category} />
            <InfoRow label="Currency" value={activity.currency} />
            {activity.originalCurrency ? <InfoRow label="Original currency" value={activity.originalCurrency} /> : null}
            {activity.postedAmountMinorUnits !== undefined ? <InfoRow label="Settled amount" value={balanceVisible ? formatIndianMinorUnits(activity.postedAmountMinorUnits) : "Amount hidden"} /> : null}
          </InfoCard>

          <InfoCard title="Source and references">
            <InfoRow label="Source environment" value={activity.sourceEnvironment} />
            <InfoRow label="Account" value={activity.accountLabel} />
            <InfoRow label="Card" value={activity.cardLabel} />
            <InfoRow label="Reference" value={activity.reference} />
            {activity.sourceReferences
              .filter((source) => source.kind.endsWith("transaction"))
              .map((source) => (
                <InfoRow
                  key={`${source.kind}:${source.id}`}
                  label={source.kind === "account-transaction" ? "Account reference" : "Card reference"}
                  value={source.id}
                />
              ))}
          </InfoCard>

          {activity.sourceKind === "transfer-group" ? (
            <View style={styles.relationshipCard}>
              <Text style={styles.sectionTitle}>Own-account movement</Text>
              <Text style={styles.relationshipText}>{activity.movementFrom ?? "Source account"} → {activity.movementTo ?? "Destination account"}</Text>
              <Text style={styles.relationshipHint}>Both underlying account-ledger entries are retained. This group is shown once only when both sides are in scope.</Text>
              {activity.ledgerEntries.map((entry) => (
                <InfoRow
                  key={entry.id}
                  label={`${entry.direction === "debit" ? "Debit" : "Credit"} entry`}
                  value={`${entry.accountId} · ${balanceVisible ? formatIndianMinorUnits(entry.amountMinorUnits) : "Amount hidden"} · ${entry.status}`}
                />
              ))}
            </View>
          ) : null}

          {activity.annotation?.note ? (
            <View style={styles.noteCard}>
              <Text style={styles.sectionTitle}>Personal note</Text>
              <Text style={styles.noteText}>{activity.annotation.note}</Text>
            </View>
          ) : null}

          <View style={styles.disclosure}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.greenDark} />
            <Text style={styles.disclosureText}>Personal annotations stay in this app’s customer-scoped preference store. They are not sent to the bank or Wealth Coach.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text accessibilityRole="header" style={styles.modalTitle}>Annotate transaction</Text>
              <Pressable accessibilityRole="button" onPress={() => setEditOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>Original category: {activity.originalCategory ?? activity.category}</Text>
            <Text style={styles.fieldLabel}>Effective category</Text>
            <View style={styles.categoryGrid}>
              {TRANSACTION_CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item }}
                  onPress={() => setCategory(item)}
                  style={[styles.categoryChip, category === item && styles.categoryChipSelected]}
                >
                  <Text style={[styles.categoryText, category === item && styles.categoryTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Personal note</Text>
            <TextInput
              accessibilityLabel="Personal transaction note"
              value={note}
              onChangeText={setNote}
              maxLength={240}
              multiline
              placeholder="Add context for yourself"
              placeholderTextColor={colors.muted}
              style={styles.noteInput}
            />
            <Text style={styles.characterHint}>{note.length}/240</Text>
            {saveState === "error" ? <Text style={styles.errorText} accessibilityRole="alert">The annotation could not be saved.</Text> : null}
            <Pressable accessibilityRole="button" disabled={saveState === "saving"} onPress={() => void saveAnnotation()} style={[styles.primaryButton, saveState === "saving" && styles.disabled]}>
              {saveState === "saving" ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.primaryButtonText}>Save annotation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TransactionActivityLoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>Loading transaction details</Text></View>;
}

function BackButton({ onPress }: { onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>; }
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.infoCard}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function InfoRow({ label: rowLabel, value, last = false }: { label: string; value?: string; last?: boolean }) { return <View style={[styles.infoRow, !last && styles.infoBorder]}><Text style={styles.infoLabel}>{rowLabel}</Text><Text style={styles.infoValue}>{value ?? "Not available from this data source"}</Text></View>; }
function StateCard({ title, description }: { title: string; description: string }) { return <View style={styles.stateCard}><Ionicons name="receipt-outline" size={28} color={colors.greenDark} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{description}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.secondary, fontSize: 14 },
  content: { width: "100%", maxWidth: 820, alignSelf: "center" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 2 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12 },
  titleColumn: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "800" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 13, lineHeight: 19 },
  demoBadge: { marginTop: 3, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, color: colors.orange, backgroundColor: colors.orangeSoft, fontSize: 11, fontWeight: "800" },
  heroCard: { alignItems: "center", marginTop: 20, padding: 24, borderRadius: appRadii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...appShadows.surface },
  heroIcon: { width: 57, height: 57, alignItems: "center", justifyContent: "center", borderRadius: 29 },
  creditIcon: { backgroundColor: colors.greenSoft },
  debitIcon: { backgroundColor: "#F0F2F4" },
  transferIcon: { backgroundColor: "#EEF1F4" },
  heroTitle: { maxWidth: "100%", marginTop: 13, color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  heroAmount: { marginTop: 9, color: colors.text, fontSize: 29, fontWeight: "800" },
  creditAmount: { color: colors.greenDark },
  debitAmount: { color: colors.danger },
  status: { marginTop: 7, color: colors.secondary, fontSize: 12, textTransform: "capitalize" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionButton: { minHeight: 44, flexGrow: 1, flexBasis: "30%", flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 5, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.greenSoft },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  infoCard: { marginTop: 15, paddingHorizontal: 15, paddingTop: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12, paddingVertical: 9 },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { flex: 1, color: colors.secondary, fontSize: 12 },
  infoValue: { flex: 1.35, color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "right" },
  relationshipCard: { marginTop: 15, padding: 15, borderRadius: 17, backgroundColor: colors.greenSoft },
  relationshipText: { marginTop: 7, color: colors.greenDark, fontSize: 13, fontWeight: "800" },
  relationshipHint: { marginTop: 5, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  noteCard: { marginTop: 15, padding: 15, borderRadius: 16, backgroundColor: "#FFF8F3" },
  noteText: { marginTop: 7, color: colors.text, fontSize: 13, lineHeight: 19 },
  disclosure: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, padding: 13, borderRadius: 13, backgroundColor: colors.greenSoft },
  disclosureText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 11, lineHeight: 17 },
  stateCard: { alignItems: "center", marginTop: 24, padding: 27, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateTitle: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: "800" },
  stateText: { marginTop: 6, color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.34)" },
  modal: { maxHeight: "90%", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  modalBody: { marginTop: 8, color: colors.secondary, fontSize: 13 },
  fieldLabel: { marginTop: 18, marginBottom: 8, color: colors.secondary, fontSize: 12, fontWeight: "800" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  categoryChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 11, borderRadius: 22, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  categoryChipSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  categoryText: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  categoryTextSelected: { color: "#FFFFFF" },
  noteInput: { minHeight: 85, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 11, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 13, textAlignVertical: "top" },
  characterHint: { marginTop: 5, color: colors.muted, fontSize: 11, textAlign: "right" },
  errorText: { marginTop: 9, color: colors.danger, fontSize: 12 },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 18, borderRadius: 12, backgroundColor: colors.greenDark },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 },
});
