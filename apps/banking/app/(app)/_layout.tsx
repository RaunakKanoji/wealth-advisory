import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { appColors } from "@/components/theme/tokens";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { useDemoSession } from "@/lib/demo-session";
import { isExplicitDemoAuthEnabled } from "@/lib/env";

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session, isRestoring } = useDemoSession();

  if ((!isLoaded && !isExplicitDemoAuthEnabled) || isRestoring) return <AuthLoadingScreen />;
  if (!isSignedIn && !session) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          contentStyle: {
            backgroundColor: appColors.background,
          },
        }}
      />
      <Stack.Screen name="scan-qr" options={{ headerShown: false }} />
      <Stack.Screen name="cards" options={{ headerShown: false }} />
      <Stack.Screen name="cards/[cardId]" options={{ headerShown: false }} />
      <Stack.Screen name="cards/transaction/[transactionId]" options={{ headerShown: false }} />
      <Stack.Screen name="coach" options={{ headerShown: false }} />
      <Stack.Screen name="transfer" options={{ headerShown: false }} />
      <Stack.Screen name="transfers/index" options={{ headerShown: false }} />
      <Stack.Screen name="transfers/new" options={{ headerShown: false }} />
      <Stack.Screen name="transfers/history" options={{ headerShown: false }} />
      <Stack.Screen name="transfers/[transferId]" options={{ headerShown: false }} />
      <Stack.Screen name="beneficiaries/index" options={{ headerShown: false }} />
      <Stack.Screen name="services" options={{ headerShown: false }} />
      <Stack.Screen name="services/info/[serviceId]" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/[accountId]" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/add" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/summary" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/statements" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/details" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/manage-card" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/actions" options={{ headerShown: false }} />
      <Stack.Screen name="accounts/open-new" options={{ headerShown: false }} />
      <Stack.Screen name="activity/index" options={{ headerShown: false }} />
      <Stack.Screen name="activity/[transactionId]" options={{ headerShown: false }} />
    </Stack>
  );
}
