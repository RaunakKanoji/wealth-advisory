import { SignIn } from "@clerk/expo/web";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";

// Clerk's prebuilt auth UI for WEB builds (Metro resolves this variant on
// web; native resolves ClerkPrebuiltAuthScreen.tsx). Renders Clerk's hosted
// SignIn card with every strategy enabled on the instance (phone code,
// email, password, ...). Completion flips Clerk's auth state and
// ClerkSessionBridge + the (auth) layout guard route the customer onward —
// no navigation wiring is needed here. hash routing keeps the multi-step
// flow inside /sign-in without expo-router involvement.
export function ClerkPrebuiltAuthScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <SignIn routing="hash" />
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
