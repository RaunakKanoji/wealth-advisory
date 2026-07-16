import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { OfflineBanner } from "@/src/components/feedback/OfflineBanner";
import { colors } from "@/src/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  edges?: Edge[];
  backgroundColor?: string;
}>;

export function Screen({
  children,
  scroll = false,
  edges = ["top", "bottom"],
  backgroundColor = colors.background,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
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
