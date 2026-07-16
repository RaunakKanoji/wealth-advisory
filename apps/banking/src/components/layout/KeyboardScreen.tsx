import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { OfflineBanner } from "@/src/components/feedback/OfflineBanner";
import { colors } from "@/src/theme";

type KeyboardScreenProps = PropsWithChildren<{
  edges?: Edge[];
  backgroundColor?: string;
}>;

export function KeyboardScreen({
  children,
  edges = ["top", "bottom"],
  backgroundColor = colors.background,
}: KeyboardScreenProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
      <OfflineBanner />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
