import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { moreCardShadow, moreColors } from "./tokens";

type ProfileSummaryCardProps = {
  isLoaded: boolean;
  name: string;
  email: string | null;
  imageUrl: string | null;
  initials: string;
  avatarSize: number;
  onPress: () => void;
};

export function ProfileSummaryCard({
  isLoaded,
  name,
  email,
  imageUrl,
  initials,
  avatarSize,
  onPress,
}: ProfileSummaryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View profile for ${name || "IDBI Customer"}`}
      accessibilityHint="Opens your account profile"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        {isLoaded && imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatarImage}
            accessibilityLabel="Profile photo"
          />
        ) : isLoaded ? (
          <Text style={styles.initials}>{initials}</Text>
        ) : null}
      </View>

      <View style={styles.details}>
        {isLoaded ? (
          <>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
              {name}
            </Text>
            {email ? (
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.email}>
                {email}
              </Text>
            ) : null}
            <Text style={styles.viewProfile}>View Profile</Text>
          </>
        ) : (
          <View accessible={false}>
            <View style={[styles.skeleton, styles.nameSkeleton]} />
            <View style={[styles.skeleton, styles.emailSkeleton]} />
            <View style={[styles.skeleton, styles.linkSkeleton]} />
          </View>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={24}
        color={moreColors.chevron}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 150,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: 22,
    backgroundColor: moreColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: moreColors.border,
    ...moreCardShadow,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: moreColors.brandGreen,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  initials: {
    color: moreColors.surface,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  details: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 18,
  },
  name: {
    color: moreColors.textPrimary,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
  },
  email: {
    marginTop: 5,
    color: moreColors.chevron,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  viewProfile: {
    marginTop: 8,
    color: moreColors.brandGreen,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  skeleton: {
    backgroundColor: "#E8EBEF",
    borderRadius: 6,
  },
  nameSkeleton: {
    width: "68%",
    height: 22,
  },
  emailSkeleton: {
    width: "88%",
    height: 17,
    marginTop: 10,
  },
  linkSkeleton: {
    width: "46%",
    height: 17,
    marginTop: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
