import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/src/components/feedback/Toast";
import { FeatureFlagProvider } from "@/src/providers/FeatureFlagProvider";
import { SessionProvider } from "@/src/providers/SessionProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <FeatureFlagProvider>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </FeatureFlagProvider>
    </SafeAreaProvider>
  );
}
