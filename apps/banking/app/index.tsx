import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { useDemoSession } from "@/lib/demo-session";

// Thin root dispatcher. Clerk's load state is handled by the root navigator
// (app/_layout.tsx shows the loading screen until isLoaded), so by the time
// this renders the auth state is settled:
//   signed out            -> authentication entry in (auth)
//   signed in             -> authenticated app entry in (app)
export default function Index() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session, isRestoring } = useDemoSession();

  if (isRestoring) return <AuthLoadingScreen />;
  if (!isSignedIn && !session) {
    return <Redirect href="/(auth)" />;
  }
  return <Redirect href="/(app)/(tabs)" />;
}
