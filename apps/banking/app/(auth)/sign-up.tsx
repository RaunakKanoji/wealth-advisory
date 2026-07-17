import { Redirect } from "expo-router";

import { env } from "@/src/config/env";
import { ClerkPrebuiltAuthScreen } from "@/src/features/authentication/screens/ClerkPrebuiltAuthScreen";

// Account creation exists only in clerk mode (web SignUp card / native
// AuthView in dev builds). Mock mode is sign-in-only with deterministic
// development customers, so it redirects to sign-in.
export default function SignUp() {
  if (env.authenticationMode !== "clerk") {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return <ClerkPrebuiltAuthScreen mode="signUp" />;
}
