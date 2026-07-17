import { env } from "@/src/config/env";
import { SignInScreen } from "@/src/features/authentication";
import { ClerkPrebuiltAuthScreen } from "@/src/features/authentication/screens/ClerkPrebuiltAuthScreen";

// clerk mode renders Clerk's prebuilt auth UI (web SignIn card / native
// AuthView in dev builds, guidance in Expo Go); mock mode uses the
// deterministic development flow.
export default function SignIn() {
  return env.authenticationMode === "clerk" ? (
    <ClerkPrebuiltAuthScreen mode="signIn" />
  ) : (
    <SignInScreen />
  );
}
