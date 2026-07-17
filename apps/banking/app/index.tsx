import { useAuth, useUser } from "@clerk/expo";
import { Redirect } from "expo-router";

import { isOnboardingComplete } from "@/src/features/onboarding/services/onboarding-status";

// Thin root dispatcher. Clerk's load state is handled by the root navigator
// (app/_layout.tsx shows the loading screen until isLoaded), so by the time
// this renders the auth state is settled:
//   signed out            -> branded welcome entry in (auth)
//   signed in, onboarding -> consent-first onboarding journey
//   signed in, complete   -> the authenticated app shell
export default function Index() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { user } = useUser();

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }
  if (!isOnboardingComplete(user)) {
    return <Redirect href="/(onboarding)" />;
  }
  return <Redirect href="/(app)/(tabs)" />;
}
