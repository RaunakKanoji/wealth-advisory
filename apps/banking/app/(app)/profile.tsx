import { useAuth } from "@clerk/expo";
import { UserProfileView } from "@clerk/expo/native";
import { useIsFocused } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function NativeProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const hasDismissed = React.useRef(false);

  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;

  const handleDismiss = () => {
    if (!isSignedIn) return;
    if (hasDismissed.current) return;
    if (!isFocused) return;

    // If the user already dismissed the modal via swipe-down, the pathname
    // has already changed back to the parent. Skip calling back() again
    // to avoid an unhandled GO_BACK navigation warning/crash.
    if (!pathnameRef.current.includes("profile")) return;

    hasDismissed.current = true;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <ScreenContainer edges={["top"]} backgroundColor="#FFFFFF">
      <UserProfileView
        isDismissible={true}
        onDismiss={handleDismiss}
        style={styles.flex}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
