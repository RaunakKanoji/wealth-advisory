import { Redirect, Stack, usePathname } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import {
  getAppGroupRedirect,
  setIntendedDestination,
  useSession,
} from "@/src/features/session";

export default function AppLayout() {
  const { status } = useSession();
  const pathname = usePathname();

  // While a persisted session is being restored, hold the shell in a loading
  // state instead of bouncing the customer to sign-in and back.
  if (status === "bootstrapping") {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  const redirect = getAppGroupRedirect(status);

  if (redirect) {
    // Remember where the customer was headed so a fully onboarded sign-in
    // can resume there (intended-destination handling, kept lightweight).
    if (status === "unauthenticated" || status === "expired") {
      setIntendedDestination(pathname);
    }
    return <Redirect href={redirect} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
