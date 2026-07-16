import { Redirect } from "expo-router";

import { ErrorState } from "@/src/components/feedback/ErrorState";
import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { getRootRedirect, useSession } from "@/src/features/session";

// Thin root dispatcher: routes the customer to the shell that matches their
// session status. Holds a loading state while the stored session is being
// restored, and offers a retry when bootstrap fails recoverably.
export default function Index() {
  const { status, retryBootstrap } = useSession();
  const redirect = getRootRedirect(status);

  if (status === "error") {
    return (
      <Screen>
        <ErrorState
          message="We couldn't restore your session. Check your connection and try again."
          onRetry={retryBootstrap}
        />
      </Screen>
    );
  }

  if (!redirect) {
    return (
      <Screen>
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }

  return <Redirect href={redirect} />;
}
