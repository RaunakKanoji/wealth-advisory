import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { useSession } from "@/src/providers/SessionProvider";
import { getAppGroupRedirect } from "@/src/providers/sessionRouteGuards";

export default function AppLayout() {
  const { status } = useSession();

  // While a persisted session is being restored, hold the shell in a loading
  // state instead of bouncing the customer to welcome and back.
  if (status === "restoring") {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  const redirect = getAppGroupRedirect(status);

  if (redirect) {
    return <Redirect href={redirect} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
