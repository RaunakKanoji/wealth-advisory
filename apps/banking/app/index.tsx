import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";

// Thin root dispatcher. Clerk's load state is handled by the root navigator
// (app/_layout.tsx shows the loading screen until isLoaded), so by the time
// this renders the auth state is settled:
//   signed out            -> authentication entry in (auth)
//   signed in             -> authenticated app entry in (app)
export default function Index() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }
  return <Redirect href="/(app)" />;
}
