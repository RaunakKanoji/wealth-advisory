import { useUser } from "@clerk/expo";
import React, { useEffect, useState } from "react";
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

// Imports from local modules
import AccountCarousel from "@/components/home/account-carousel";
import AccountPagination from "@/components/home/account-pagination";
import ActivityCard from "@/components/home/activity-card";
import HomeSkeletons from "@/components/home/home-skeletons";
import QuickActions from "@/components/home/quick-actions";
// import TotalBalanceCard from "@/components/home/total-balance-card";
import WealthCoachCard from "@/components/home/wealth-coach-card";
import {
  demoAccounts,
  demoActivities,
  demoInsight,
} from "@/data/home-demo-data";
import { BankAccount, BankingActivity, WealthInsight } from "@/types/banking";

export default function HomeScreen() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Screen State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [activities, setActivities] = useState<BankingActivity[]>([]);
  const [insight, setInsight] = useState<WealthInsight | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Time-aware greeting
  const [greeting, setGreeting] = useState("Welcome Back");

  // Determine display name following user requirements priority
  const displayName = (() => {
    if (!isUserLoaded || !user) return "Customer";
    if (user.firstName) return user.firstName;
    if (user.fullName) return user.fullName;
    if (user.primaryEmailAddress?.emailAddress) {
      return user.primaryEmailAddress.emailAddress.split("@")[0];
    }
    return "Customer";
  })();

  // Determine time-aware greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
    } else if (hour >= 17 && hour < 22) {
      setGreeting("Good Evening");
    } else {
      setGreeting("Welcome Back");
    }
  }, []);

  // Simulate data fetching
  const loadData = () => {
    setLoading(true);
    setError(false);
    setTimeout(() => {
      // Set loaded demo data
      setAccounts(demoAccounts);
      setActivities(demoActivities);
      setInsight(demoInsight);
      setLoading(false);
    }, 1200);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetry = () => {
    loadData();
  };



  // Calculate total balance across loaded accounts (Archived for now)
  // const totalBalance = accounts.reduce(
  //   (sum, acc) => sum + acc.availableBalance,
  //   0
  // );

  // Responsive breakpoints adjustments
  const isSmall = width < 375;
  const isTablet = width >= 768;

  const contentMaxWidth = isTablet ? 720 : "100%";
  const horizontalPadding = isSmall ? 16 : 20;
  const greetingFontSize = isSmall ? 27 : 30;
  const greetingLineHeight = isSmall ? 34 : 38;

  // Calculate bottom padding taking the absolute tab bar height into account
  const tabHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });
  const bottomPadding = 32 + tabHeight;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: bottomPadding,
            maxWidth: contentMaxWidth,
          },
        ]}
      >
        {loading ? (
          <HomeSkeletons />
        ) : error ? (
          // Compact inline error state inside the ScrollView
          <View style={[styles.errorCard, { marginHorizontal: horizontalPadding }]}>
            <Text style={styles.errorTitle}>We couldn’t load your accounts.</Text>
            <Text style={styles.errorDescription}>
              Please check your connection and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading accounts data"
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.composedContent}>


            {/* Time-Aware Greeting */}
            <View style={{ paddingHorizontal: horizontalPadding }}>
              <Text
                style={[
                  styles.greeting,
                  { fontSize: greetingFontSize, lineHeight: greetingLineHeight },
                ]}
                accessibilityRole="header"
              >
                {greeting}, {displayName}
              </Text>
            </View>

            {/* Account Card Carousel (Full Width) */}
            <View style={styles.carouselSection}>
              <AccountCarousel
                accounts={accounts}
                activeIndex={carouselIndex}
                onIndexChange={setCarouselIndex}
              />
              <AccountPagination
                total={accounts.length}
                activeIndex={carouselIndex}
                onDotPress={setCarouselIndex}
              />
            </View>

            {/* Rest of the Content Sections (Padded) */}
            <View style={{ paddingHorizontal: horizontalPadding }}>
              {/* Quick Actions */}
              <View style={styles.quickActionsSection}>
                <QuickActions />
              </View>

              {/* Total Balance Card (Archived for now) */}
              {/* <View style={styles.balanceSection}>
                <TotalBalanceCard balance={totalBalance} />
              </View> */}

              {/* Wealth Coach Insight Card */}
              {insight && (
                <View style={styles.coachSection}>
                  <WealthCoachCard insight={insight} />
                </View>
              )}

              {/* Recent Activity Card */}
              <View style={styles.activitySection}>
                <ActivityCard activities={activities} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  scrollContent: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 28,
  },
  composedContent: {
    width: "100%",
  },
  greeting: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 24,
  },
  carouselSection: {
    // Greeting to account card: 24, Card to dots: 18, Dots to quick actions: 28
    // account-pagination component has marginTop: 18
    marginBottom: 28,
  },
  quickActionsSection: {
    // Dots to quick actions: 28 (satisfied above), Quick actions to balance card: 30
    marginBottom: 30,
  },
  balanceSection: {
    // Balance card to coach card: 20
    marginBottom: 20,
  },
  coachSection: {
    // Coach card to activity card: 20
    marginBottom: 20,
  },
  activitySection: {
    // Activity card to bottom content padding: 32 (satisfied by bottomPadding on scrollContent)
  },
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EBEF",
    marginTop: 40,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: "#737D8C",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#00866A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
