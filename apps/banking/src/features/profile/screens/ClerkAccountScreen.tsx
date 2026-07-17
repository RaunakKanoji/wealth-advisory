import { UserProfileView } from "@clerk/expo/native";
import { StyleSheet } from "react-native";

import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { Screen } from "@/src/components/layout/Screen";

// Clerk-managed account screen for NATIVE targets (web builds resolve the
// .web.tsx variant). Renders the native <UserProfileView/> — profile details,
// MFA, passkeys, connected accounts, active sessions — inside the app's
// detail shell. isDismissible={false} because the app's DetailHeader owns
// navigation for this full-screen presentation.

export function ClerkAccountScreen() {
  return (
    <Screen>
      <DetailHeader title="Account & security" />
      <UserProfileView isDismissible={false} style={styles.flex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
