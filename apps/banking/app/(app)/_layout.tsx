import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isSignedIn) {
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
          headerShown: true,
          title: "Notifications",
          headerTintColor: "#14201D",
          headerStyle: {
            backgroundColor: "#FFFFFF",
          },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="scan-qr" options={{ headerShown: false }} />
      <Stack.Screen name="cards" options={{ headerShown: false }} />
      <Stack.Screen name="transfer" options={{ headerShown: false }} />
      <Stack.Screen name="services" options={{ headerShown: false }} />
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
