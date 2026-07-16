import { useAuth, useUser } from "@clerk/expo";
import { useEffect } from "react";

import { readOnboardingStatus } from "@/src/features/authentication/services/authentication.clerk";
import { useSession } from "@/src/features/session";

// Rendered only when authenticationMode === "clerk" (see AppProviders).
// Clerk owns token persistence and restoration; this bridge mirrors Clerk's
// loaded auth state into the app's SessionProvider so routing guards work
// identically across adapters. Renders nothing.
export function ClerkSessionBridge() {
  // Per the native-components reference: pending session tasks must not be
  // treated as signed out, or AuthView's completion can be observed as a
  // sign-out mid-flow.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { user } = useUser();
  const { syncExternalSession } = useSession();

  useEffect(() => {
    if (!isLoaded) {
      return; // SessionProvider stays in "bootstrapping" until Clerk loads.
    }
    if (isSignedIn && user) {
      syncExternalSession({
        customerId: user.id,
        displayName: user.firstName ?? undefined,
        onboardingStatus: readOnboardingStatus(user.publicMetadata),
      });
    } else {
      syncExternalSession(null);
    }
  }, [isLoaded, isSignedIn, user, syncExternalSession]);

  return null;
}
