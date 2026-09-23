import { useLocalSearchParams } from "expo-router";
import React from "react";

import { GoalDetailScreen } from "@/components/coach";

export default function CoachGoalDetailRoute() {
  const { goalId } = useLocalSearchParams<"/(app)/coach/goal/[goalId]">();

  return <GoalDetailScreen goalId={goalId} />;
}
