import { useClerk } from "@clerk/expo";
import { useCallback, useState } from "react";

export function useSignOut() {
  const { signOut: clerkSignOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await clerkSignOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [clerkSignOut, isSigningOut]);

  return { signOut, isSigningOut };
}
