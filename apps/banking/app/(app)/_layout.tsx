import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
