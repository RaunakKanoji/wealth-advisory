import Constants, { ExecutionEnvironment } from "expo-constants";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

// Clerk's prebuilt auth UI for NATIVE targets (web builds resolve the
// .web.tsx variant, which renders Clerk's <SignIn/> card). The native
// <AuthView/> is rendered by the clerk-ios / clerk-android SDKs, which only
// exist in a development build (npx expo prebuild && npx expo run:ios|android)
// — Expo Go does not contain them, so there we show guidance instead.
// Completion flips Clerk's auth state; ClerkSessionBridge and the (auth)
// layout guard route the customer onward.

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
            dismiss button — the customer must authenticate to continue. */}
        <AuthView isDismissible={false} />
      </View>
    );
  } catch {
    return <ExpoGoNotice />;
  }
}

function ExpoGoNotice() {
  const router = useRouter();

  return (
    <Screen>
      <PageContainer>
        <Stack gap="lg" style={styles.notice}>
          <Stack gap="sm">
            <Text variant="caption" color={colors.brandSecondaryStrong} style={styles.brand}>
              IDBI WEALTH ADVISORY
            </Text>
            <Heading level="pageTitle">Sign-in isn&apos;t available in Expo Go</Heading>
            <Text variant="body" color={colors.textSecondary}>
              This app uses Clerk&apos;s native sign-in, which needs a development build. Run
              `npx expo run:ios` or `npx expo run:android` — or open the app in a web browser —
              to sign in.
            </Text>
          </Stack>
          <Button
            label="Back to welcome"
            variant="secondary"
            onPress={() => router.replace("/(public)/welcome")}
          />
        </Stack>
      </PageContainer>
    </Screen>
  );
}

export function ClerkPrebuiltAuthScreen() {
  if (isExpoGo) {
    return <ExpoGoNotice />;
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
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  brand: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});
