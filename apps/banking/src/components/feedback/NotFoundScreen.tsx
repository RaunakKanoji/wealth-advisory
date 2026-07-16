import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/src/components/feedback/EmptyState";
import { Screen } from "@/src/components/layout/Screen";
import { Heading } from "@/src/components/ui/Heading";
import { spacing } from "@/src/theme";

// Safe fallback for unknown routes (app/+not-found.tsx). Recovery goes
// through "/" so the root index — not this screen — decides where the
// customer belongs based on session and onboarding state.
export function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.container}>
        <Heading level="pageTitle">Page not found</Heading>
        <EmptyState
          message="The page you're looking for doesn't exist or may have moved."
          actionLabel="Go to home"
          onAction={() => router.replace("/")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: spacing.xxxl,
    gap: spacing.md,
  },
});
