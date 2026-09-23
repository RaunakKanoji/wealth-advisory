import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { appColors } from "@/components/theme/tokens";
import { useDemoSession } from "@/lib/demo-session";

export function DemoProfileScreen() {
  const router = useRouter();
  const { session, isStarting, error, endDemoSession, resetDemoData } = useDemoSession();
  const [isResetting, setIsResetting] = useState(false);

  const leaveDemo = async () => {
    await endDemoSession();
    router.replace("/(auth)");
  };

  const reset = () => {
    Alert.alert(
      "Reset demo data?",
      "This restores the seeded demo accounts, transactions, goals and Coach history. Real customer data is not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset demo",
          style: "destructive",
          onPress: () => {
            setIsResetting(true);
            void resetDemoData()
              .then(() => router.replace("/(auth)"))
              .catch(() => undefined)
              .finally(() => setIsResetting(false));
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer scroll backgroundColor={appColors.background}>
      <View style={styles.content}>
        <Text style={styles.title}>Demo account</Text>
        <Text style={styles.subtitle}>This account contains synthetic financial data for demonstration purposes.</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Ionicons name="sparkles-outline" size={28} color={appColors.primary} /></View>
          <Text style={styles.name}>{session?.displayName ?? "Aarav Mehta"}</Text>
          <Text style={styles.email}>{session?.email ?? "demo.a@example.test"}</Text>
          <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.statusText}>Backend-connected demo session</Text></View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={appColors.primary} />
          <Text style={styles.noticeText}>Your accounts, transactions, insights, goals and Coach answers come from the seeded demo user in the same banking API.</Text>
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Pressable accessibilityRole="button" accessibilityLabel="Reset demo data" disabled={isStarting || isResetting} onPress={reset} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isStarting || isResetting) && styles.disabled]}>
          {isResetting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Reset demo data</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out of demo" disabled={isStarting || isResetting} onPress={() => void leaveDemo()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>Leave demo</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { color: appColors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { marginTop: 8, color: appColors.textSecondary, fontSize: 15, lineHeight: 22 },
  profileCard: { alignItems: "center", marginTop: 24, padding: 24, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: appColors.border },
  avatar: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 32, backgroundColor: appColors.primarySoft },
  name: { marginTop: 14, color: appColors.textPrimary, fontSize: 22, fontWeight: "800" },
  email: { marginTop: 4, color: appColors.textSecondary, fontSize: 15 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  statusDot: { width: 8, height: 8, marginRight: 7, borderRadius: 4, backgroundColor: appColors.success },
  statusText: { color: appColors.success, fontSize: 12, fontWeight: "700" },
  notice: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: appColors.primarySoft },
  noticeText: { flex: 1, marginLeft: 8, color: appColors.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { marginTop: 14, color: appColors.danger, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 24, borderRadius: 12, backgroundColor: appColors.primary },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: appColors.primary },
  secondaryButtonText: { color: appColors.primary, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
