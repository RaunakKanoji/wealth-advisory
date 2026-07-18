import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { env } from "@/lib/env";
import { clerkAppearance } from "@/lib/clerk-appearance";

export { ConfigurationErrorScreen as ErrorBoundary } from "@/components/configuration-error-screen";

function RootNavigator() {
  const { isLoaded } = useAuth({ treatPendingAsSignedOut: false });

  if (!isLoaded) {
    return <AuthLoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      appearance={clerkAppearance}
    >
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
