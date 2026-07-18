import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  edges?: Edge[];
  backgroundColor?: string;
}>;

export function ScreenContainer({
  children,
  scroll = false,
  edges = ["top", "bottom"],
  backgroundColor = "#F4F7F6", // light background default
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
