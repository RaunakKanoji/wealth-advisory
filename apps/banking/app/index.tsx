import { Redirect } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { useSession } from "@/src/providers/SessionProvider";
import { getRootRedirect } from "@/src/providers/sessionRouteGuards";

// Thin root dispatcher: routes the customer to the shell that matches their
// session status (public / onboarding / authenticated). The destination is
// driven by the dev shell-preview switch during development; see
// src/config/devSession.ts.
export default function Index() {
  const { status } = useSession();
  const redirect = getRootRedirect(status);

  if (!redirect) {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  return <Redirect href={redirect} />;
}
