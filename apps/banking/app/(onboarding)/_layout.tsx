import { Redirect, Stack } from "expo-router";

import { ConsentProvider } from "@/src/features/consent";
import { useSession } from "@/src/providers/SessionProvider";
import { getOnboardingGroupRedirect } from "@/src/providers/sessionRouteGuards";

export default function OnboardingLayout() {
  const { status } = useSession();
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
