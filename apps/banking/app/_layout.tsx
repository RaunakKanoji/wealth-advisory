import { Stack } from "expo-router";

import { AppProviders } from "@/src/providers/AppProviders";

// Root error boundary: any unhandled render error anywhere in the app falls
// back to customer-safe copy with a retry (F008).
export { RouteErrorFallback as ErrorBoundary } from "@/src/components/feedback/RouteErrorFallback";

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AppProviders>
  );
}
