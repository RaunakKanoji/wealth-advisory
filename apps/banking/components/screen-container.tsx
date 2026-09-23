import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors } from "@/components/theme/tokens";

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  edges?: Edge[];
  backgroundColor?: string;
}>;

export function ScreenContainer({
  children,
  scroll = false,
  edges = ["top", "bottom"],
  backgroundColor = appColors.background,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
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
