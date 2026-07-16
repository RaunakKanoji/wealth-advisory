import { UnavailableState } from "@/src/components/feedback";
import { Screen } from "@/src/components/layout/Screen";
import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { env } from "@/src/config/env";
import { ClerkAccountScreen } from "@/src/features/profile/screens/ClerkAccountScreen";

// Clerk-managed account & security (prebuilt UserProfile UI). Only meaningful
// in clerk mode — mock mode has no account backend yet.
export default function AccountRoute() {
  if (env.authenticationMode !== "clerk") {
    return (
      <Screen>
        <DetailHeader title="Account & security" />
        <UnavailableState />
      </Screen>
    );
  }
  return <ClerkAccountScreen />;
}
