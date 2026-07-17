import { Stack } from "expo-router";

// Authenticated shell. Access control lives in the root navigator's
// Stack.Protected guard (app/_layout.tsx) — the single ClerkProvider also
// lives there; never nest another provider or guard in group layouts.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
