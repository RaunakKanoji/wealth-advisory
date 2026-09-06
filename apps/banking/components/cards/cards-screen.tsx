import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { PaymentCardPreview, cardStatusLabel } from "@/components/cards/payment-card-preview";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { getCards } from "@/services/cards-service";
import type { CardProductKind, CardRecord } from "@/types/cards";

type CardFilter = "all" | CardProductKind | "virtual";

const filters: { key: CardFilter; label: string }[] = [
  { key: "all", label: "All cards" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "virtual", label: "Virtual" },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function CardsOverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = firstParam(rawAccountId);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [filter, setFilter] = useState<CardFilter>("all");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const hasRedirected = useRef(false);

  const loadCards = useCallback(async (quiet = false) => {
    if (!quiet) setLoadState("loading");
    setError(null);
    try {
      const nextCards = await getCards({ customerId, accountId });
      setCards(nextCards);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("We couldn’t load your cards. Please try again.");
    }
  }, [accountId, customerId]);

  useEffect(() => {
    hasRedirected.current = false;
    void loadCards();
  }, [loadCards]);

  useFocusEffect(
    useCallback(() => {
      if (loadState === "ready") void loadCards(true);
    }, [loadCards, loadState]),
  );

  useEffect(() => {
    if (!accountId || loadState !== "ready" || cards.length !== 1 || hasRedirected.current) return;
    hasRedirected.current = true;
    router.replace({
      pathname: "/(app)/cards/[cardId]",
      params: { cardId: cards[0].id, fromAccountId: accountId },
    });
  }, [accountId, cards, loadState, router]);

  const visibleCards = useMemo(
    () => cards.filter((card) => filter === "all" || (filter === "virtual" ? card.formFactor === "virtual" : card.productKind === filter)),
    [cards, filter],
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)");
  };

  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + tabBarHeight }]}
      >
        <View style={[styles.content, { maxWidth: isTablet ? 760 : undefined, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={23} color={stylesTokens.textPrimary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cards help"
              onPress={() => router.push("/(app)/support")}
              style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}
            >
              <Ionicons name="help-circle-outline" size={22} color={stylesTokens.brandGreenDark} />
              <Text style={styles.helpText}>Help</Text>
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleColumn}>
              <Text accessibilityRole="header" style={styles.title}>My Cards</Text>
              <Text style={styles.description}>
                Manage your debit, credit, and virtual cards in one place.
              </Text>
            </View>
            {loadState === "ready" ? <Text style={styles.countLabel}>{cards.length} {cards.length === 1 ? "card" : "cards"}</Text> : null}
          </View>

          {loadState === "loading" ? (
            <CardsLoading />
          ) : loadState === "error" ? (
            <StateCard title="Cards unavailable" description={error ?? "Please try again."} actionLabel="Retry" onAction={() => void loadCards()} />
          ) : cards.length === 0 ? (
            <StateCard
              title={accountId ? "No cards linked to this account" : "No cards are available for this profile"}
              description={accountId ? "Choose another account to view its supported cards." : "No card records are currently available for this customer."}
            />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterScroll}>
                {filters.map((item) => {
                  const selected = item.key === filter;
                  const count = item.key === "all"
                    ? cards.length
                    : cards.filter((card) => item.key === "virtual" ? card.formFactor === "virtual" : card.productKind === item.key).length;
                  if (count === 0 && item.key !== "all") return null;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${item.label.toLowerCase()}`}
                      accessibilityState={{ selected }}
                      onPress={() => setFilter(item.key)}
                      style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                    >
                      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label} {count}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {visibleCards.length === 0 ? (
                <StateCard title="No matching cards" description="Try another card filter." />
              ) : (
                <View style={styles.cardList}>
                  {visibleCards.map((card) => (
                    <View key={card.id} style={styles.cardListItem}>
                      <PaymentCardPreview
                        card={card}
                        compact
                        onPress={() => router.push({ pathname: "/(app)/cards/[cardId]", params: { cardId: card.id } })}
                        accessibilityLabel={`Open ${card.nickname ?? card.productName}, ${card.productKind} ${card.formFactor}, ending in ${card.lastFour}, ${cardStatusLabel(card.lifecycleStatus)}`}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open details for ${card.nickname ?? card.productName}`}
                        onPress={() => router.push({ pathname: "/(app)/cards/[cardId]", params: { cardId: card.id } })}
                        style={({ pressed }) => [styles.cardSummaryRow, pressed && styles.pressed]}
                      >
                        <View style={styles.cardSummaryText}>
                          <Text style={styles.cardSummaryTitle}>{card.nickname ?? card.productName}</Text>
                          <Text style={styles.cardSummaryDescription}>
                            {card.productKind === "unknown" ? "Product type unavailable" : `${card.productKind === "credit" ? "Credit" : "Debit"} · ${card.formFactor}`}
                            {card.linkedAccountId ? " · Linked account" : card.linkedCreditFacilityId ? " · Shared credit facility" : ""}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={21} color="#A1A9B5" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.disclosure}>
            <Ionicons name="information-circle-outline" size={18} color={stylesTokens.brandGreenDark} />
            <Text style={styles.disclosureText}>Demo card — changes affect this prototype only.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function CardsLoading() {
  return (
    <View style={styles.loadingGroup} accessibilityLabel="Loading cards">
      <View style={[styles.skeleton, styles.skeletonCard]} />
      <View style={[styles.skeleton, styles.skeletonLine]} />
      <View style={[styles.skeleton, styles.skeletonLineShort]} />
      <View style={[styles.skeleton, styles.skeletonCard]} />
    </View>
  );
}

function StateCard({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}><Ionicons name="card-outline" size={27} color={stylesTokens.brandGreenDark} /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stylesTokens = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  textPrimary: "#111827",
  textSecondary: "#6F7888",
  textMuted: "#98A1AE",
  brandGreen: "#007E5D",
  brandGreenDark: "#006647",
  brandGreenSoft: "#E9F5F2",
  brandOrange: "#F45B2A",
  brandOrangeSoft: "#FFF2EA",
  border: "#E8EBEF",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stylesTokens.background },
  scrollContent: { width: "100%", alignItems: "center", paddingTop: 12 },
  content: { width: "100%", alignSelf: "center" },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: stylesTokens.textPrimary, fontSize: 16, fontWeight: "600" },
  helpButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  helpText: { marginLeft: 5, color: stylesTokens.brandGreenDark, fontSize: 14, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12, marginBottom: 20 },
  titleColumn: { flex: 1, minWidth: 0 },
  title: { color: stylesTokens.textPrimary, fontSize: 30, lineHeight: 38, fontWeight: "700" },
  description: { maxWidth: 560, marginTop: 6, color: stylesTokens.textSecondary, fontSize: 16, lineHeight: 23 },
  countLabel: { marginLeft: 12, marginBottom: 3, color: stylesTokens.textMuted, fontSize: 14, fontWeight: "600" },
  filterScroll: { marginBottom: 18 },
  filterContent: { columnGap: 8 },
  filterChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 20, backgroundColor: stylesTokens.surface, borderWidth: 1, borderColor: stylesTokens.border },
  filterChipSelected: { backgroundColor: stylesTokens.brandGreenSoft, borderColor: "#B8DED5" },
  filterText: { color: stylesTokens.textSecondary, fontSize: 13, fontWeight: "600" },
  filterTextSelected: { color: stylesTokens.brandGreenDark },
  cardList: { rowGap: 18 },
  cardListItem: { borderRadius: 24, backgroundColor: stylesTokens.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: stylesTokens.border, padding: 12, shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardSummaryRow: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingTop: 10 },
  cardSummaryText: { flex: 1, minWidth: 0 },
  cardSummaryTitle: { color: stylesTokens.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  cardSummaryDescription: { marginTop: 3, color: stylesTokens.textSecondary, fontSize: 13, lineHeight: 18 },
  disclosure: { flexDirection: "row", alignItems: "flex-start", marginTop: 22, padding: 13, borderRadius: 14, backgroundColor: stylesTokens.brandGreenSoft },
  disclosureText: { flex: 1, marginLeft: 9, color: stylesTokens.brandGreenDark, fontSize: 13, lineHeight: 19 },
  stateCard: { alignItems: "center", marginTop: 10, padding: 26, borderRadius: 24, backgroundColor: stylesTokens.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: stylesTokens.border, shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  stateIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: stylesTokens.brandGreenSoft },
  stateTitle: { marginTop: 16, color: stylesTokens.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "700", textAlign: "center" },
  stateDescription: { maxWidth: 460, marginTop: 7, color: stylesTokens.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  primaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 20, paddingHorizontal: 24, borderRadius: 13, backgroundColor: stylesTokens.brandGreen },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  loadingGroup: { rowGap: 12 },
  skeleton: { backgroundColor: "#E9EDF0", borderRadius: 18 },
  skeletonCard: { height: 230 },
  skeletonLine: { width: "64%", height: 17, marginTop: 4 },
  skeletonLineShort: { width: "38%", height: 14 },
  pressed: { opacity: 0.72 },
});
