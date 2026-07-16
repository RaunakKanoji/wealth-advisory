import Constants, { ExecutionEnvironment } from "expo-constants";
import type { ReactNode } from "react";

// Clerk's native <UserButton/> for NATIVE targets (web builds resolve the
// .web.tsx variant). The native module only exists in development builds —
// in Expo Go the caller-provided fallback (the app's own avatar shortcut)
// renders instead. Tapping the Clerk button opens the native
// <UserProfileView/> managed by the Clerk SDK.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type ClerkUserButtonProps = {
  /** Rendered when Clerk's native UI is unavailable (Expo Go). */
  fallback: ReactNode;
};

export function ClerkUserButton({ fallback }: ClerkUserButtonProps) {
  if (isExpoGo) {
    return fallback;
  }
  try {
    // Lazy require — never evaluate the native module lookup in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { UserButton } = require("@clerk/expo/native") as typeof import("@clerk/expo/native");
    return <UserButton />;
  } catch {
    return fallback;
  }
}
