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

type AppHeaderProps = {
  sourceRoute?: string;
  unreadCount?: number;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  showBottomDivider?: boolean;
};

const headerTokens = {
  background: "#FFFFFF",
  border: "#E5E7EB",
  icon: "#4B5563",
  brandGreen: "#00866A",
  avatarBackground: "#EAF5F2",
  avatarBorder: "#B8DED5",
  badge: "#EF4444",
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
  const { width: screenWidth } = useWindowDimensions();

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const initials = getInitials(user?.firstName, user?.lastName, email);

  // Responsive design adjustments based on standard specifications
  const isSmallScreen = screenWidth < 375;
  const isTablet = screenWidth >= 768;

  const logoHeight = isTablet ? 54 : isSmallScreen ? 40 : 48;
  const logoWidth = logoHeight * 3.208;
  const paddingHorizontal = isTablet ? 32 : isSmallScreen ? 16 : 20;
  const minHeight = isTablet ? 96 : isSmallScreen ? 78 : 92;
  const actionGap = isTablet ? 26 : isSmallScreen ? 14 : 20;

  // Icon and avatar size reductions
  const bellIconSize = isTablet ? 32 : isSmallScreen ? 24 : 28;
  const unreadBadgeTop = isTablet ? 6 : isSmallScreen ? 10 : 8;
  const unreadBadgeRight = isTablet ? 6 : isSmallScreen ? 10 : 8;

  const avatarSize = isTablet ? 46 : isSmallScreen ? 36 : 40;
  const avatarFontSize = isTablet ? 20 : isSmallScreen ? 14 : 16;
  const avatarLineHeight = isTablet ? 26 : isSmallScreen ? 18 : 22;

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
        <Image
          source={require("@/assets/branding/idbi-bank-logo.png")}
          resizeMode="contain"
          style={logoStyle}
          accessibilityLabel="IDBI Bank"
        />

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
            {isLoaded && user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={[styles.avatarText, avatarTextStyle]}>
                {isLoaded ? initials : ""}
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
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
