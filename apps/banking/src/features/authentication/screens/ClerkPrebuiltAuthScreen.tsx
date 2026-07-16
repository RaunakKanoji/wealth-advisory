import Constants, { ExecutionEnvironment } from "expo-constants";
import { StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { SignInScreen } from "@/src/features/authentication/screens/SignInScreen";
import { colors, spacing } from "@/src/theme";

// Clerk's prebuilt auth UI for NATIVE targets (web builds resolve the
// .web.tsx variant instead). The native <AuthView/> is rendered by the
// clerk-ios / clerk-android SDKs, which only exist in a development build
// (npx expo prebuild && npx expo run:ios|android) — Expo Go does not contain
// them, so there we fall back to the bank's custom OTP flow, which works
// everywhere. Completion in either UI flips Clerk's auth state and
// ClerkSessionBridge + the (auth) layout guard route the customer onward.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function DevBuildAuthView() {
  try {
    // Lazy require so Expo Go never executes the native module lookup — a
    // static import would crash at bundle evaluation where clerk-ios/android
    // don't exist.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AuthView } = require("@clerk/expo/native") as typeof import("@clerk/expo/native");
    return (
      <View style={styles.container}>
        {/* Required full-screen auth per the AuthView reference: no native
            dismiss button — the customer must authenticate to continue.
            Completion is observed by ClerkSessionBridge, and the (auth)
            layout guard routes onward. */}
        <AuthView isDismissible={false} />
      </View>
    );
  } catch {
    return (
      <View style={styles.notice}>
        <Text variant="body" color={colors.textSecondary} style={styles.noticeText}>
          Clerk&apos;s native sign-in UI isn&apos;t available in this build. Rebuild with
          `npx expo run:ios` or `npx expo run:android`.
        </Text>
      </View>
    );
  }
}

export function ClerkPrebuiltAuthScreen() {
  if (isExpoGo) {
    // Expo Go cannot load Clerk's native UI module — use the custom flow.
    return <SignInScreen />;
  }
  return <DevBuildAuthView />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notice: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  noticeText: {
    textAlign: "center",
  },
});
