import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PageHeader } from "@/components/design-system";
import {
  bankingServiceItems,
  priorityActionItems,
  supportActionItems,
} from "@/data/more-actions-config";
import { ProfileSummaryCard } from "@/components/more/profile-summary-card";
import { PriorityActionsGrid } from "@/components/more/priority-actions-grid";
import { ServiceSectionCard } from "@/components/more/service-section-card";
import { SupportSection } from "@/components/more/support-section";
import { moreColors } from "@/components/more/tokens";
import { useDemoSession } from "@/lib/demo-session";

function getDisplayName(
  isLoaded: boolean,
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null,
  email?: string | null,
) {
  if (!isLoaded) {
    return "";
  }

  const preferredFullName = fullName?.trim();
  const combinedName = [firstName?.trim(), lastName?.trim()]
    .filter(Boolean)
    .join(" ");

  return (
    preferredFullName ||
    combinedName ||
    firstName?.trim() ||
    email?.split("@")[0]?.trim() ||
    "IDBI Customer"
  );
}

function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null,
  email?: string | null,
) {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  if (first) {
    return first.slice(0, 2).toUpperCase();
  }

  const fullNameParts = fullName?.trim().split(/\s+/).filter(Boolean);
  if (fullNameParts && fullNameParts.length > 1) {
    return `${fullNameParts[0][0]}${fullNameParts[fullNameParts.length - 1][0]}`.toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "U";
}

export default function MoreScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallScreen = width < 375;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallScreen ? 16 : 20;
  const contentWidth = Math.min(width - horizontalPadding * 2, 720);
  const priorityCardWidth = (contentWidth - 12) / 2;
  const avatarSize = isSmallScreen ? 66 : 76;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });
  const email = user?.primaryEmailAddress?.emailAddress ?? demoSession?.email ?? null;
  const profileLoaded = isLoaded || Boolean(demoSession);
  const displayName = getDisplayName(
    profileLoaded,
    user?.firstName ?? demoSession?.displayName.split(" ")[0],
    user?.lastName ?? demoSession?.displayName.split(" ").slice(1).join(" "),
    user?.fullName ?? demoSession?.displayName,
    email,
  );
  const initials = getInitials(
    user?.firstName ?? demoSession?.displayName.split(" ")[0],
    user?.lastName ?? demoSession?.displayName.split(" ").slice(1).join(" "),
    user?.fullName ?? demoSession?.displayName,
    email,
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: 34 + (tabBarHeight ?? 76),
          },
        ]}
      >
        <View
          style={[
            styles.contentInner,
            {
              maxWidth: isTablet ? 720 : undefined,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <PageHeader
            title="More Actions"
            action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse all services"
              onPress={() => router.push("/(app)/services")}
              style={({ pressed }) => [styles.browseButton, pressed && styles.pressed]}
            >
              <Ionicons name="grid-outline" size={17} color={moreColors.brandGreenDark} />
              <Text style={styles.browseButtonText}>All Services</Text>
            </Pressable>
            }
          />

          <ProfileSummaryCard
            isLoaded={profileLoaded}
            name={displayName}
            email={email}
            imageUrl={user?.imageUrl ?? null}
            initials={initials}
            avatarSize={avatarSize}
            onPress={() =>
              router.push({
                pathname: "/(app)/profile",
                params: { returnTo: "/(app)/(tabs)/more" },
              })
            }
          />

          <View style={styles.prioritySection}>
            <PriorityActionsGrid
              items={priorityActionItems}
              cardWidth={priorityCardWidth}
            />
          </View>

          <View style={styles.servicesSection}>
            <ServiceSectionCard items={bankingServiceItems} />
          </View>

          {supportActionItems.length > 0 ? (
            <View style={styles.supportSection}>
              <SupportSection items={supportActionItems} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: moreColors.background,
  },
  scrollContent: {
    width: "100%",
    alignItems: "center",
    paddingTop: 24,
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
  },
  browseButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: moreColors.brandGreenSoft,
  },
  browseButtonText: {
    color: moreColors.brandGreenDark,
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  prioritySection: {
    marginTop: 18,
  },
  servicesSection: {
    marginTop: 22,
  },
  supportSection: {
    marginTop: 22,
  },
});
