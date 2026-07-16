import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import type { PropsWithChildren, ReactNode } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/src/components/feedback/Toast";
import { env } from "@/src/config/env";
import { ClerkSessionBridge } from "@/src/features/authentication/components/ClerkSessionBridge";
import { AuthenticationServiceProvider } from "@/src/features/authentication/services/authentication.context";
import { SessionProvider } from "@/src/features/session";
import { FeatureFlagProvider } from "@/src/providers/FeatureFlagProvider";

const isClerkMode = env.authenticationMode === "clerk";

// In clerk mode the whole tree sits inside ClerkProvider so both the
// service adapter (getClerkInstance) and the session bridge can reach the
// initialized instance. The token cache is secure-store backed on native;
// Clerk manages web sessions itself, so no cache is passed there.
function AuthenticationBackendProvider({ children }: { children: ReactNode }) {
  if (!isClerkMode) {
    return children;
  }
  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey ?? ""}
      tokenCache={Platform.OS === "web" ? undefined : tokenCache}
    >
      {children}
    </ClerkProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <AuthenticationBackendProvider>
        <FeatureFlagProvider>
          <AuthenticationServiceProvider>
            <SessionProvider>
              {isClerkMode ? <ClerkSessionBridge /> : null}
              <ToastProvider>{children}</ToastProvider>
            </SessionProvider>
          </AuthenticationServiceProvider>
        </FeatureFlagProvider>
      </AuthenticationBackendProvider>
    </SafeAreaProvider>
  );
}
