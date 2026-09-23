import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SectionHeader, Surface } from "@/components/design-system";
import { appColors } from "@/components/theme/tokens";
import { BankingActivity } from "../../types/banking";
import ActivityRow from "./activity-row";

type ActivityCardProps = {
  activities: BankingActivity[];
  balanceVisible?: boolean;
};

export default function ActivityCard({ activities, balanceVisible = true }: ActivityCardProps) {
  const router = useRouter();

  const handleViewAllPress = () => {
    router.push("/(app)/activity");
  };

  const handleActivityRowPress = (id: string, accountId?: string) => {
    router.push({
      pathname: "/(app)/activity/[transactionId]",
      params: { transactionId: id, ...(accountId ? { accountId } : {}) },
    });
  };

  return (
    <Surface style={styles.card}>
      <SectionHeader
        title="Activity"
        actionLabel="View all"
        accessibilityLabel="View all account activity"
        onActionPress={handleViewAllPress}
      />

      {/* Activities List */}
      <View style={styles.listContainer}>
        {activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent activity</Text>
            <Text style={styles.emptySubtext}>
              Your latest transactions will appear here.
            </Text>
          </View>
        ) : (
          activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <ActivityRow
                activity={activity}
                balanceVisible={balanceVisible}
                onPress={() => handleActivityRowPress(activity.id, activity.accountId)}
              />
              {/* Optional thin divider between rows (not after the last item) */}
              {index < activities.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
  },
  listContainer: {
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: appColors.divider,
    marginVertical: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: appColors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: appColors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
});
