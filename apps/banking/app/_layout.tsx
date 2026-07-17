import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { env } from "@/src/config/env";
import { clerkAppearance } from "@/src/features/authentication/clerk-appearance";
import { AppProviders } from "@/src/providers/AppProviders";

// Root error boundary: any unhandled render error anywhere in the app falls
// back to customer-safe copy with a retry (F008).
export { RouteErrorFallback as ErrorBoundary } from "@/src/components/feedback/RouteErrorFallback";

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isLoaded) {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(public)" />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(isSignedIn)}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      tokenCache={tokenCache}
      appearance={clerkAppearance}
    >
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ClerkProvider>
  );
}
