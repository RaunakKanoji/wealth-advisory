import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { useDemoSession } from "@/lib/demo-session";
import { isExplicitDemoAuthEnabled } from "@/lib/env";

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session, isRestoring } = useDemoSession();

  if ((!isLoaded && !isExplicitDemoAuthEnabled) || isRestoring) return <AuthLoadingScreen />;
  if (isSignedIn || session) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    />
  );
}
