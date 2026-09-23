import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors } from "@/components/theme/tokens";
import { useDemoSession } from "@/lib/demo-session";

type AppHeaderProps = {
  sourceRoute?: string;
  unreadCount?: number;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  showBottomDivider?: boolean;
};

const headerTokens = {
  background: appColors.surface,
  border: appColors.border,
  icon: appColors.textSecondary,
  brandGreen: appColors.primary,
  avatarBackground: appColors.primarySoft,
  avatarBorder: appColors.primaryBorder,
  badge: appColors.danger,
};

function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  if (first) {
    const slice = first.slice(0, 2);
    return slice.charAt(0).toUpperCase() + slice.slice(1);
  }

  if (email) {
    return email[0].toUpperCase();
  }

  return "U";
}

export function AppHeader({
  sourceRoute,
  unreadCount = 0,
  onNotificationPress,
  onProfilePress,
  showBottomDivider = true,
}: AppHeaderProps) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const { width: screenWidth } = useWindowDimensions();
  const [logoReady, setLogoReady] = React.useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? demoSession?.email ?? null;
  const initials = getInitials(user?.firstName ?? demoSession?.displayName.split(" ")[0], user?.lastName ?? demoSession?.displayName.split(" ").slice(1).join(" "), email);
  const profileLoaded = isLoaded || Boolean(demoSession);

  // Responsive design adjustments based on standard specifications
  const isSmallScreen = screenWidth < 375;
  const isTablet = screenWidth >= 768;

  const logoHeight = isTablet ? 48 : isSmallScreen ? 34 : 40;
  const logoWidth = logoHeight * 3.208;
  const paddingHorizontal = isTablet ? 32 : isSmallScreen ? 16 : 20;
  const minHeight = isTablet ? 84 : isSmallScreen ? 72 : 76;
  const actionGap = isTablet ? 18 : isSmallScreen ? 6 : 10;

  // Icon and avatar size reductions
  const bellIconSize = isTablet ? 28 : isSmallScreen ? 22 : 24;
  const unreadBadgeTop = isTablet ? 6 : isSmallScreen ? 10 : 8;
  const unreadBadgeRight = isTablet ? 6 : isSmallScreen ? 10 : 8;

  const avatarSize = isTablet ? 44 : isSmallScreen ? 34 : 38;
  const avatarFontSize = isTablet ? 18 : isSmallScreen ? 13 : 15;
  const avatarLineHeight = isTablet ? 24 : isSmallScreen ? 17 : 20;

  const logoStyle = {
    width: logoWidth,
    height: logoHeight,
  };

  const headerStyle = {
    paddingHorizontal,
    minHeight,
  };

  const actionStyle = {
    columnGap: actionGap,
  };

  const avatarStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
  };

  const avatarTextStyle = {
    fontSize: avatarFontSize,
    lineHeight: avatarLineHeight,
  };

  const dynamicHeaderStyle = {
    borderBottomWidth: showBottomDivider ? StyleSheet.hairlineWidth : 0,
  };

  const unreadBadgeStyle = {
    top: unreadBadgeTop,
    right: unreadBadgeRight,
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      router.push("/(app)/notifications");
    }
  };

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      const returnTo = sourceRoute === "accounts"
        ? "/(app)/(tabs)/accounts"
        : sourceRoute === "coach"
          ? "/(app)/(tabs)/coach"
          : sourceRoute === "more"
            ? "/(app)/(tabs)/more"
            : "/(app)/(tabs)";

      router.push({
        pathname: "/(app)/profile",
        params: { returnTo },
      });
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={[styles.header, headerStyle, dynamicHeaderStyle]}>
        <View style={[styles.brandLockup, logoStyle]}>
          {!logoReady ? (
            <View accessibilityLabel="IDBI Bank" style={styles.brandFallback}>
              <View style={styles.brandFallbackMark} />
              <Text style={styles.brandFallbackText}>IDBI BANK</Text>
            </View>
          ) : null}
          <Image
            source={require("@/assets/branding/idbi-bank-logo.png")}
            resizeMode="contain"
            onLoad={() => setLogoReady(true)}
            onError={() => setLogoReady(false)}
            style={[styles.logo, logoStyle, !logoReady && styles.logoPending]}
            accessibilityLabel="IDBI Bank"
          />
        </View>

        <View style={[styles.actions, actionStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `${unreadCount} unread notifications`
                : "Notifications"
            }
            accessibilityHint="Opens your notifications"
            hitSlop={8}
            onPress={handleNotificationPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={bellIconSize}
              color={headerTokens.icon}
            />

            {unreadCount > 0 ? (
              <View style={[styles.unreadBadge, unreadBadgeStyle]} />
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            accessibilityHint="Opens your account profile"
            hitSlop={8}
            onPress={handleProfilePress}
            style={({ pressed }) => [
              styles.avatarButton,
              avatarStyle,
              pressed && styles.pressed,
            ]}
          >
            {profileLoaded && user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={[styles.avatarText, avatarTextStyle]}>
                {profileLoaded ? initials : ""}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: headerTokens.background,
  },
  header: {
    backgroundColor: headerTokens.background,
    borderBottomColor: headerTokens.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    flexShrink: 0,
  },
  brandLockup: {
    flexShrink: 0,
    justifyContent: "center",
  },
  logoPending: {
    opacity: 0,
  },
  brandFallback: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  brandFallbackMark: {
    width: 24,
    height: 24,
    marginRight: 7,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#f58220",
  },
  brandFallbackText: {
    color: "#008a70",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  unreadBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: headerTokens.badge,
    borderWidth: 2,
    borderColor: headerTokens.background,
  },
  avatarButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: headerTokens.avatarBackground,
    borderWidth: 1.5,
    borderColor: headerTokens.avatarBorder,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: headerTokens.brandGreen,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.65,
  },
});
