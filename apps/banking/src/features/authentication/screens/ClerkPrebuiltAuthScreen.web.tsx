import { SignIn, SignUp } from "@clerk/expo/web";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";

// Clerk's prebuilt auth UI for WEB builds (native resolves the .tsx variant,
// which renders the native <AuthView/>). The cards inherit the IDBI theme
// from the root ClerkProvider's appearance prop, and the cross-links
// (signUpUrl / signInUrl) point at the app's OWN routes so the flow never
// leaves for Clerk's hosted portal. hash routing keeps Clerk's internal
// steps on the current route; completion flips Clerk auth state and the root
// Stack.Protected guard routes the customer onward.

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
