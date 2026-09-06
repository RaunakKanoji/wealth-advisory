import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { CardLifecycleStatus, CardRecord } from "@/types/cards";

const colors = {
  green: "#007E5D",
  greenDark: "#006647",
  greenSoft: "#E9F5F2",
  orange: "#F45B2A",
  text: "#111827",
  muted: "#6F7888",
  background: "#F7F8FA",
  border: "#E8EBEF",
};

function productLabel(card: CardRecord): string {
  return card.productKind === "credit" ? "CREDIT" : card.productKind === "debit" ? "DEBIT" : "CARD";
}

export function cardStatusLabel(status: CardLifecycleStatus): string {
  switch (status) {
    case "temporarily-disabled": return "Temporarily off";
    case "issuer-restricted": return "Issuer restricted";
    case "blocked": return "Permanently blocked";
    case "expired": return "Expired";
    case "active": return "Active";
    default: return "Status unavailable";
  }
}

function statusTone(status: CardLifecycleStatus) {
  if (status === "active") return { backgroundColor: "#E8F6EF", color: "#087443" };
  if (status === "temporarily-disabled") return { backgroundColor: "#FFF2EA", color: "#A74A16" };
  return { backgroundColor: "#FDECEC", color: "#A62B32" };
}

function expiryLabel(card: CardRecord): string | undefined {
  if (!card.expiryMonth || !card.expiryYear) return undefined;
  return `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`;
}

type PaymentCardPreviewProps = {
  card: CardRecord;
  compact?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function PaymentCardPreview({ card, compact = false, onPress, accessibilityLabel }: PaymentCardPreviewProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;
  const status = statusTone(card.lifecycleStatus);
  const body = (
    <View style={[styles.card, compact && styles.cardCompact, isSmall && !compact && styles.cardSmall]}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.bankLabel}>IDBI BANK</Text>
          <Text style={styles.productName} numberOfLines={1}>{card.nickname ?? card.productName}</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.productBadge}><Text style={styles.productBadgeText}>{productLabel(card)}</Text></View>
          <View style={styles.formBadge}><Text style={styles.formBadgeText}>{card.formFactor}</Text></View>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}><Ionicons name="grid-outline" size={21} color="#E4B15C" /></View>
        <View style={styles.contactless}><Ionicons name="wifi-outline" size={24} color="rgba(255,255,255,0.72)" /></View>
      </View>

      <Text style={styles.maskedNumber} accessibilityLabel={`Card ending in ${card.lastFour}`}>
        ••••  ••••  ••••  {card.lastFour}
      </Text>

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.metaLabel}>CARDHOLDER</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{card.holderDisplayName ?? "Cardholder unavailable"}</Text>
        </View>
        {expiryLabel(card) ? (
          <View>
            <Text style={styles.metaLabel}>VALID THRU</Text>
            <Text style={styles.metaValue}>{expiryLabel(card)}</Text>
          </View>
        ) : null}
        {card.network ? <Text style={styles.network}>{card.network}</Text> : null}
      </View>

      <View style={[styles.status, { backgroundColor: status.backgroundColor }]}>
        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
        <Text style={[styles.statusText, { color: status.color }]}>{cardStatusLabel(card.lifecycleStatus)}</Text>
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Open ${card.nickname ?? card.productName} ending in ${card.lastFour}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 230,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    padding: 22,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: colors.green,
    shadowColor: "#003B2B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  cardSmall: {
    padding: 18,
    minHeight: 220,
  },
  cardCompact: {
    minHeight: 176,
    padding: 16,
    borderRadius: 18,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
  },
  bankLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  productName: {
    maxWidth: 190,
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 5,
  },
  productBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  productBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  formBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(245,91,42,0.9)",
  },
  formBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
  },
  chip: {
    width: 40,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: "#E8C276",
  },
  contactless: {
    marginLeft: 10,
    transform: [{ rotate: "90deg" }],
  },
  maskedNumber: {
    marginTop: 13,
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: 1.1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 20,
    marginTop: 16,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  metaValue: {
    maxWidth: 150,
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  network: {
    marginLeft: "auto",
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: "800",
  },
  status: {
    position: "absolute",
    right: 16,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    marginRight: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
  },
});
