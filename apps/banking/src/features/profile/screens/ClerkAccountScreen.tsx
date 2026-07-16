import Constants, { ExecutionEnvironment } from "expo-constants";
import { StyleSheet, View } from "react-native";

import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { Screen } from "@/src/components/layout/Screen";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

// Clerk-managed account screen for NATIVE targets (web builds resolve the
// .web.tsx variant). Renders the native <UserProfileView/> — profile details,
// MFA, passkeys, connected accounts, active sessions — inside the app's
// detail shell. The Clerk native module only exists in development builds;
// Expo Go shows guidance instead. isDismissible={false} because our
// DetailHeader already provides Back (per the UserProfileView reference for
// full-screen usage).

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function NativeProfileView() {
  try {
    const { UserProfileView } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@clerk/expo/native") as typeof import("@clerk/expo/native");
    return <UserProfileView isDismissible={false} style={styles.flex} />;
  } catch {
    return <ExpoGoNotice />;
  }
}

function ExpoGoNotice() {
  return (
    <View style={styles.notice}>
      <Text variant="body" color={colors.textSecondary} style={styles.noticeText}>
        Clerk&apos;s native account manager isn&apos;t available in Expo Go. Run a development
        build (`npx expo run:ios` or `npx expo run:android`) — or open the app on the web —
        to manage your account.
      </Text>
    </View>
  );
}

export function ClerkAccountScreen() {
  return (
    <Screen>
      <DetailHeader title="Account & security" />
      {isExpoGo ? <ExpoGoNotice /> : <NativeProfileView />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
