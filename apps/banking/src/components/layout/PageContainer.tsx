import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useBreakpoint } from "@/src/hooks/useBreakpoint";
import { spacing } from "@/src/theme";

// Mirrors the demo's responsive-app-shell max-width treatment
// (max-w-3xl -> max-w-4xl at md, px-4 -> px-6), ported to the
// compact/medium/expanded scale.
const MAX_WIDTH_BY_BREAKPOINT = {
  compact: undefined,
  medium: 720,
  expanded: 960,
} as const;

const HORIZONTAL_PADDING_BY_BREAKPOINT = {
  compact: spacing.lg,
  medium: spacing.xl,
  expanded: spacing.xl,
} as const;

export function PageContainer({ children }: PropsWithChildren) {
  const breakpoint = useBreakpoint();
  const maxWidth = MAX_WIDTH_BY_BREAKPOINT[breakpoint];

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.inner,
          { paddingHorizontal: HORIZONTAL_PADDING_BY_BREAKPOINT[breakpoint] },
          maxWidth ? { maxWidth, alignSelf: "center", width: "100%" } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: "100%",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
});
