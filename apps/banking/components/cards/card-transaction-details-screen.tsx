import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { formatIndianMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { getCard, getCardTransaction } from "@/services/cards-service";
import type { CardRecord, CardTransaction } from "@/types/cards";

const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#111827",
  secondary: "#6F7888",
  muted: "#98A1AE",
  green: "#007E5D",
  greenSoft: "#E9F5F2",
  border: "#E8EBEF",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function CardTransactionDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { cardId: rawCardId, transactionId: rawTransactionId } = useLocalSearchParams<{
    cardId?: string | string[];
    transactionId?: string | string[];
  }>();
  const cardId = firstParam(rawCardId);
  const transactionId = firstParam(rawTransactionId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [card, setCard] = useState<CardRecord | null>(null);
  const [transaction, setTransaction] = useState<CardTransaction | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    if (!cardId || !transactionId) {
      setState("error");
      return () => { active = false; };
    }
    void Promise.all([
      getCard(cardId, { customerId }),
      getCardTransaction(cardId, transactionId, { customerId }),
    ]).then(([nextCard, nextTransaction]) => {
      if (!active) return;
      if (!nextCard || !nextTransaction) {
        setState("error");
        return;
      }
      setCard(nextCard);
      setTransaction(nextTransaction);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [cardId, customerId, transactionId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (cardId) router.replace({ pathname: "/(app)/cards/[cardId]", params: { cardId } });
    else router.replace("/(app)/cards");
  };

  const padding = width < 375 ? 16 : 20;
  const bottomPadding = 30 + insets.bottom + 72;
  if (state === "loading") return <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>Loading transaction</Text></View>;
  if (!card || !transaction) return <View style={styles.screen}><View style={[styles.content, { paddingHorizontal: padding, paddingTop: 12 }]}><BackButton onPress={goBack} /><StateCard /></View></View>;

  const isCredit = transaction.direction === "credit";
  return <View style={styles.screen}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 12 }}><View style={[styles.content, { paddingHorizontal: padding }]}><BackButton onPress={goBack} /><Text accessibilityRole="header" style={styles.title}>Transaction details</Text><Text style={styles.subtitle}>Card ending in {card.lastFour} · {card.productName}</Text><View style={styles.amountCard}><View style={styles.amountIcon}><Ionicons name={isCredit ? "arrow-down-outline" : "arrow-up-outline"} size={25} color={colors.green} /></View><Text style={[styles.amount, isCredit && styles.creditAmount]}>{isCredit ? "+" : "−"}{formatIndianMinorUnits(transaction.amountMinorUnits)}</Text><Text style={styles.status}>{transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)} · {transaction.transactionType.replace("-", " ")}</Text></View><View style={styles.detailCard}><DetailRow label="Merchant / description" value={transaction.merchant ?? transaction.description} /><DetailRow label="Transaction date" value={formatDate(transaction.transactionDate)} /><DetailRow label="Posted date" value={transaction.postedDate ? formatDate(transaction.postedDate) : "Not posted"} /><DetailRow label="Channel" value={transaction.channel ?? "Unavailable"} /><DetailRow label="Category" value={transaction.category ?? "Unavailable"} /><DetailRow label="Reference" value={transaction.reference ?? "Unavailable"} /><DetailRow label="Original currency" value={transaction.originalCurrency ?? transaction.currency} />{transaction.postedAmountMinorUnits !== undefined ? <DetailRow label="Posted account-currency amount" value={formatIndianMinorUnits(transaction.postedAmountMinorUnits)} /> : null}</View>{transaction.linkedTransactionId ? <View style={styles.relationship}><Ionicons name="link-outline" size={18} color={colors.green} /><Text style={styles.relationshipText}>This record is linked to another card event: {transaction.linkedTransactionId}. The relationship is retained rather than treated as a second purchase.</Text></View> : null}<View style={styles.disclosure}><Ionicons name="shield-checkmark-outline" size={18} color={colors.green} /><Text style={styles.disclosureText}>Only masked card metadata is shown. Full card credentials are never collected or displayed.</Text></View></View></ScrollView></View>;
}

function BackButton({ onPress }: { onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }
function StateCard() { return <View style={styles.stateCard}><Ionicons name="receipt-outline" size={28} color={colors.green} /><Text style={styles.stateTitle}>Transaction unavailable</Text><Text style={styles.stateDescription}>This transaction is unavailable or outside the selected card scope.</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.secondary, fontSize: 14 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "600" },
  title: { marginTop: 16, color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: "800" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 14, lineHeight: 20 },
  amountCard: { alignItems: "center", marginTop: 22, padding: 25, borderRadius: 22, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  amountIcon: { width: 55, height: 55, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: colors.greenSoft },
  amount: { marginTop: 13, color: colors.text, fontSize: 29, lineHeight: 37, fontWeight: "800" },
  creditAmount: { color: colors.green },
  status: { marginTop: 6, color: colors.secondary, fontSize: 13, textTransform: "capitalize" },
  detailCard: { marginTop: 16, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  detailRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 13 },
  detailValue: { maxWidth: "56%", color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right", textTransform: "capitalize" },
  relationship: { flexDirection: "row", alignItems: "flex-start", marginTop: 15, padding: 13, borderRadius: 13, backgroundColor: colors.greenSoft },
  relationshipText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 12, lineHeight: 18 },
  disclosure: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, padding: 13, borderRadius: 13, backgroundColor: colors.greenSoft },
  disclosureText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 12, lineHeight: 18 },
  stateCard: { alignItems: "center", marginTop: 24, padding: 26, borderRadius: 20, backgroundColor: colors.surface },
  stateTitle: { marginTop: 12, color: colors.text, fontSize: 18, fontWeight: "800" },
  stateDescription: { marginTop: 6, color: colors.secondary, fontSize: 13, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
