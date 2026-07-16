import { UserButton } from "@clerk/expo/web";
import type { ReactNode } from "react";

// Clerk's prebuilt web <UserButton/> (avatar + account menu with manage
// account and sign out). Native builds resolve ClerkUserButton.tsx instead.

type ClerkUserButtonProps = {
  /** Unused on web — Clerk's web UserButton is always available. */
  fallback: ReactNode;
};

export function ClerkUserButton(_props: ClerkUserButtonProps) {
  return <UserButton />;
}
