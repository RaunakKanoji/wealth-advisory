import { Redirect, Stack } from "expo-router";

import { useSession } from "@/src/providers/SessionProvider";
import { getAuthGroupRedirect } from "@/src/providers/sessionRouteGuards";

export default function AuthLayout() {
  const { status } = useSession();
  const redirect = getAuthGroupRedirect(status);

  if (redirect) {
    return <Redirect href={redirect} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
