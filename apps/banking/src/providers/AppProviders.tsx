import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/src/components/feedback/Toast";
import { FeatureFlagProvider } from "@/src/providers/FeatureFlagProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <FeatureFlagProvider>
        <ToastProvider>{children}</ToastProvider>
      </FeatureFlagProvider>
    </SafeAreaProvider>
  );
}
