import { AuthView } from "@clerk/expo/native";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";
import { AuthScreenHeader } from "@/src/features/authentication/components/AuthScreenHeader";
import { colors } from "@/src/theme";

// Native-only Clerk authentication (web builds resolve the .web.tsx variant,
// which renders the prebuilt SignIn/SignUp cards). AuthView owns credential
// entry, verification, and session activation, themed by clerk-theme.json at
// prebuild; the root Stack.Protected guard reacts to Clerk state and removes
// this route after authentication completes. Screen applies top AND bottom
// safe-area insets so the full flow is visible edge to edge, and the app's
// own header provides the back affordance (AuthView stays
// isDismissible={false} — full-screen usage per the AuthView reference).

export type ClerkAuthMode = "signIn" | "signUp";

type ClerkPrebuiltAuthScreenProps = {
  mode: ClerkAuthMode;
};

export function ClerkPrebuiltAuthScreen({ mode }: ClerkPrebuiltAuthScreenProps) {
  return (
    // Top inset only: the native AuthView applies its own bottom safe-area
    // inside its scroll content — adding ours as well squeezes its layout and
    // clips the bottom of the sheet (e.g. the development-mode watermark).
    // Surface (white) background so the header band blends seamlessly into
    // AuthView's white sheet.
    <Screen edges={["top"]} backgroundColor={colors.surface}>
      <AuthScreenHeader />
      <View style={styles.container}>
        <AuthView mode={mode} isDismissible={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
