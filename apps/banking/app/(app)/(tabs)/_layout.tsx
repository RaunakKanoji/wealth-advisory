import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/navigation/app-header";

const ACTIVE_COLOR = "#00866A";
const INACTIVE_COLOR = "#9CA3AF";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader unreadCount={0} />,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: [
          styles.tabBar,
          {
            height: Platform.select({
              ios: 72 + insets.bottom,
              android: 66 + Math.max(insets.bottom, 10),
              default: 76,
            }),
            paddingBottom: Platform.select({
              ios: insets.bottom + 4,
              android: Math.max(insets.bottom, 10),
              default: 10,
            }),
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabBarLabel, { color, fontWeight: focused ? "600" : "500" }]}>
              Home
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={29}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: "Home tab",
        }}
      />

      <Tabs.Screen
        name="accounts"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabBarLabel, { color, fontWeight: focused ? "600" : "500" }]}>
              Accounts
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "business" : "business-outline"}
              size={29}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: "Accounts tab",
        }}
      />

      <Tabs.Screen
        name="coach"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabBarLabel, { color, fontWeight: focused ? "600" : "500" }]}>
              Coach
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              size={29}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: "Coach tab",
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabBarLabel, { color, fontWeight: focused ? "600" : "500" }]}>
              More
            </Text>
          ),
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="menu"
              size={32}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: "More tab",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E5E7EB",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarItem: {
    paddingVertical: 2,
    height: "100%",
  },
  tabBarIcon: {
    marginTop: 0,
  },
  tabBarLabel: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 3,
  },
});
