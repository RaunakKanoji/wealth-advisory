import { AuthView } from "@clerk/expo/native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { appColors } from "@/components/theme/tokens";
import { useDemoSession } from "@/lib/demo-session";
import { isExplicitDemoAuthEnabled } from "@/lib/env";

export default function NativeAuthScreen() {
  const { isStarting, error, startDemoSession } = useDemoSession();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.brandBlock}>
        <Image source={require("@/assets/branding/idbi-bank-logo.png")} resizeMode="contain" style={styles.logo} accessibilityLabel="IDBI Bank" />
        <Text style={styles.title}>Intelligent Wealth Advisory</Text>
        <Text style={styles.subtitle}>Understand your money, spending and financial goals with a personal AI Wealth Coach.</Text>
      </View>

      {isExplicitDemoAuthEnabled ? (
        <View style={styles.demoCard}>
          <Text style={styles.demoEyebrow}>JUDGE DEMO</Text>
          <Text style={styles.demoTitle}>Explore the complete experience</Text>
          <Text style={styles.demoDescription}>Try linked accounts, spending insights, goals and the Wealth Coach with synthetic financial data.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore demo"
            accessibilityState={{ busy: isStarting, disabled: isStarting }}
            disabled={isStarting}
            onPress={() => { void startDemoSession().catch(() => undefined); }}
            style={({ pressed }) => [styles.demoButton, pressed && styles.pressed, isStarting && styles.disabled]}
          >
            {isStarting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.demoButtonText}>Explore Demo</Text>}
          </Pressable>
          {isStarting ? <Text style={styles.progressText}>Preparing your demo workspace…</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.signInLabel}>Sign in to your account</Text>
      <View style={styles.authView}>
        <AuthView mode="signIn" isDismissible={false} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 40,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 180,
    height: 48,
    marginBottom: 20,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 420,
    marginTop: 10,
    color: appColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  demoCard: {
    padding: 18,
    marginBottom: 24,
    borderRadius: 18,
    backgroundColor: appColors.primarySoft,
    borderWidth: 1,
    borderColor: appColors.primaryBorder,
  },
  demoEyebrow: {
    color: appColors.primaryPressed,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  demoTitle: {
    marginTop: 6,
    color: appColors.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },
  demoDescription: {
    marginTop: 6,
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  demoButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: appColors.primary,
  },
  demoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  progressText: {
    marginTop: 8,
    color: appColors.primaryPressed,
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    marginTop: 10,
    color: appColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  signInLabel: {
    marginBottom: 10,
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  authView: {
    minHeight: 520,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.65,
  },
});
