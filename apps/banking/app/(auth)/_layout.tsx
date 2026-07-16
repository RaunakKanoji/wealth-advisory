import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { AuthenticationFlowProvider } from "@/src/features/authentication/state/AuthenticationFlowProvider";
import { getAuthGroupRedirect, useSession } from "@/src/features/session";

export default function AuthLayout() {
  const { status } = useSession();

  if (status === "bootstrapping") {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  const redirect = getAuthGroupRedirect(status);
  if (redirect) {
    return <Redirect href={redirect} />;
  }

  // Challenge state lives exactly as long as this group stays mounted —
  // leaving authentication (success, cancel, redirect) discards it.
  return (
    <AuthenticationFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthenticationFlowProvider>
  );
}
