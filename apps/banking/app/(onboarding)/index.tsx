import { Redirect } from "expo-router";

import { LoadingState } from "@/src/components/feedback/LoadingState";
import { Screen } from "@/src/components/layout/Screen";
import { useConsent } from "@/src/features/consent";

// Onboarding entry dispatcher. Consent is the first onboarding phase; once it
// is submitted the journey continues into the financial-profile and
// risk-profile steps. Kept as a thin redirect so the step screens own their
// own layout.
export default function OnboardingIndex() {
  const { state } = useConsent();

  if (state.phase === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading your onboarding progress" />
      </Screen>
    );
  }

  if (state.phase !== "submitted") {
    return <Redirect href="/(onboarding)/consent/introduction" />;
  }

  return <Redirect href="/(onboarding)/financial-profile" />;
}
