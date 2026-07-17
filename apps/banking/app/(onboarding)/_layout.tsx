import { Stack } from "expo-router";

import { ConsentProvider } from "@/src/features/consent";

export default function OnboardingLayout() {
  return (
    <ConsentProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ConsentProvider>
  );
}
