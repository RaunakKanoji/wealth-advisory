import { UserProfile } from "@clerk/expo/web";
import { StyleSheet, View } from "react-native";

import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { Screen } from "@/src/components/layout/Screen";
import { spacing } from "@/src/theme";

// Clerk-managed account screen for WEB builds (native resolves the .tsx
// variant with <UserProfileView/>). Renders Clerk's prebuilt <UserProfile/>
// card — profile details, security, active sessions — inside the app's
// detail shell, themed by the root ClerkProvider's appearance prop. hash
// routing keeps Clerk's internal steps on this route.
export function ClerkAccountScreen() {
  return (
    <Screen scroll>
      <DetailHeader title="Account & security" />
      <View style={styles.center}>
        <UserProfile routing="hash" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
});
