import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { accountColors, softCardShadow } from "./tokens";

export function AAConnectCard({ isLoading, onConnect }: { isLoading: boolean; onConnect: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={20} color={accountColors.brandGreenDark} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>Link other bank accounts</Text>
          <Text style={styles.description}>Connect through Account Aggregator. Share only the information you approve; consent is time-bound and revocable.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Link accounts using Account Aggregator" accessibilityState={{ busy: isLoading }} disabled={isLoading} onPress={onConnect} style={({ pressed }) => [styles.button, pressed && styles.pressed, isLoading && styles.disabled]}>
        {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Link accounts</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, padding: 16, borderRadius: 20, backgroundColor: accountColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: accountColors.border, ...softCardShadow },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  icon: { width: 38, height: 38, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: accountColors.brandGreenSoft },
  copy: { flex: 1, minWidth: 0, marginLeft: 12 },
  title: { color: accountColors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  description: { marginTop: 4, color: accountColors.textSecondary, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: accountColors.brandGreenDark },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.6 },
});
