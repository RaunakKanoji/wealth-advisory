import { AuthView } from "@clerk/expo/native";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";
import { AuthScreenHeader } from "@/src/features/authentication/components/AuthScreenHeader";

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
    <Screen>
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
