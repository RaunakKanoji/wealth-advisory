import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { ConsentProvider } from "@/src/features/consent";
import { getOnboardingGroupRedirect, useSession } from "@/src/features/session";

export default function OnboardingLayout() {
  const { status } = useSession();

  if (status === "bootstrapping") {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  const redirect = getOnboardingGroupRedirect(status);
  if (redirect) {
    return <Redirect href={redirect} />;
  }

  return (
    <ConsentProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ConsentProvider>
  );
}
