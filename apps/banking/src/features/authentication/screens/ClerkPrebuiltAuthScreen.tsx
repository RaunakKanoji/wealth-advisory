import { AuthView } from "@clerk/expo/native";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";

// Native-only Clerk authentication (web builds resolve the .web.tsx variant,
// which renders the prebuilt SignIn/SignUp cards). AuthView owns credential
// entry, verification, and session activation, themed by clerk-theme.json at
// prebuild; the root Stack.Protected guard reacts to Clerk state and removes
// this route after authentication completes. isDismissible={false} because
// authentication is required to continue (full-screen usage per the AuthView
// reference).

export type ClerkAuthMode = "signIn" | "signUp";

type ClerkPrebuiltAuthScreenProps = {
  mode: ClerkAuthMode;
};

export function ClerkPrebuiltAuthScreen({ mode }: ClerkPrebuiltAuthScreenProps) {
  return (
    <Screen>
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
