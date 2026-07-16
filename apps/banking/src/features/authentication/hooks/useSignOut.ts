import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { useAuthenticationService } from "@/src/features/authentication/services/authentication.context";
import { useSession } from "@/src/features/session";

// Full sign-out: adapter sign-out (mock clears challenges; Clerk revokes its
// session), then local session state + storage + intended destination are
// cleared, then the customer lands on Welcome with no authenticated screens
// left in history.
export function useSignOut() {
  const router = useRouter();
  const service = useAuthenticationService();
  const { signOut: clearSession } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await service.signOut();
    } catch {
      // Adapter failure must never trap the customer in an authenticated UI;
      // local state is cleared regardless.
    } finally {
      await clearSession();
      setIsSigningOut(false);
      router.replace("/(public)/welcome");
    }
  }, [isSigningOut, service, clearSession, router]);

  return { signOut, isSigningOut };
}
