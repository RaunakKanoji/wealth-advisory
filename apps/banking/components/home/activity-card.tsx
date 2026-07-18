import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BankingActivity } from "../../types/banking";
import ActivityRow from "./activity-row";

type ActivityCardProps = {
  activities: BankingActivity[];
};

export default function ActivityCard({ activities }: ActivityCardProps) {
  const router = useRouter();

  const handleViewAllPress = () => {
    router.push("/(app)/activity");
  };

  const handleActivityRowPress = (id: string) => {
    router.push({
      pathname: "/(app)/activity/[transactionId]",
      params: { transactionId: id },
    });
  };

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Activity</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all account activity"
          onPress={handleViewAllPress}
          style={({ pressed }) => [
            styles.viewAllButton,
            pressed && styles.viewAllPressed,
          ]}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

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
                onPress={() => handleActivityRowPress(activity.id)}
              />
              {/* Optional thin divider between rows (not after the last item) */}
              {index < activities.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F0F1F3",
    // Premium soft card shadow
    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllPressed: {
    opacity: 0.7,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF8500",
  },
  listContainer: {
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E8EBEF",
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
    color: "#111827",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#7B8492",
    marginTop: 4,
    textAlign: "center",
  },
});
