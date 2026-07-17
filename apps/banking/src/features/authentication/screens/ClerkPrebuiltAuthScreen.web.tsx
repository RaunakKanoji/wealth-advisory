import { SignIn, SignUp } from "@clerk/expo/web";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";

// Clerk's prebuilt auth UI for WEB builds (Metro resolves this variant on
// web; native resolves ClerkPrebuiltAuthScreen.tsx). Renders Clerk's SignIn
// or SignUp card with every strategy enabled on the instance. The cross-links
// (signUpUrl / signInUrl) point at the app's OWN routes so the flow never
// leaves for Clerk's hosted accounts.dev portal. hash routing keeps Clerk's
// internal steps on the current route. Completion flips Clerk's auth state
// and ClerkSessionBridge + the (auth) layout guard route the customer onward.

export type ClerkAuthMode = "signIn" | "signUp";

type ClerkPrebuiltAuthScreenProps = {
  mode: ClerkAuthMode;
};

export function ClerkPrebuiltAuthScreen({ mode }: ClerkPrebuiltAuthScreenProps) {
  return (
    <Screen>
      <View style={styles.center}>
        {mode === "signIn" ? (
          <SignIn routing="hash" signUpUrl="/sign-up" />
        ) : (
          <SignUp routing="hash" signInUrl="/sign-in" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
