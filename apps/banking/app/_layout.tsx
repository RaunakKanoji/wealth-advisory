import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import React, { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";

import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { env, isExplicitDemoAuthEnabled, isRemoteDataEnabled } from "@/lib/env";
import { DemoSessionProvider, useDemoSession } from "@/lib/demo-session";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { apiRequest, resolveApiBaseUrl } from "@/lib/api/client";
import { installQueryLifecycle } from "@/lib/api/app-lifecycle";
import { queryClient } from "@/lib/api/query-client";

export { ConfigurationErrorScreen as ErrorBoundary } from "@/components/configuration-error-screen";

function RootNavigator() {
  const { isLoaded, isSignedIn, userId } = useAuth({ treatPendingAsSignedOut: false });
  const { session: demoSession, isRestoring: isDemoSessionRestoring } = useDemoSession();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded || isDemoSessionRestoring) return;
    if (__DEV__) {
      let apiHost = "not-configured";
      try {
        apiHost = new URL(resolveApiBaseUrl()).host || apiHost;
      } catch {
        // Keep development diagnostics safe for malformed configuration.
      }
      console.info("[AUTH] bootstrap", { authReady: isSignedIn === true || Boolean(demoSession), signedIn: isSignedIn === true, demoAuthEnabled: isExplicitDemoAuthEnabled, demoSession: Boolean(demoSession), apiHost, remoteDataEnabled: isRemoteDataEnabled });
      if (isRemoteDataEnabled) {
        void apiRequest<{ status: string }>("/api/health", { timeoutMs: 5_000 })
          .then((result) => console.info("[API] health", { status: result.status, apiHost }))
          .catch((error) => console.warn("[API] health failed", { apiHost, code: error instanceof Error ? error.name : "unknown" }));
      }
    }
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    if (isSignedIn !== true && !demoSession) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [demoSession, isDemoSessionRestoring, isLoaded, isSignedIn, userId]);

  // Appetize/demo builds must remain usable when Clerk cannot reach its
  // network during startup. The local demo session is the auth boundary for
  // that build; live builds still wait for Clerk to finish loading.
  if ((!isLoaded && !isExplicitDemoAuthEnabled) || isDemoSessionRestoring) {
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
  useEffect(() => installQueryLifecycle(queryClient), []);

  return (
    <ClerkProvider
      publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      appearance={clerkAppearance}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <DemoSessionProvider>
            <RootNavigator />
          </DemoSessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
