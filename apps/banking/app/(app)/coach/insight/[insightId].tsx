import { useLocalSearchParams } from "expo-router";
import React from "react";

import { CoachFlowScreen } from "@/components/coach/coach-flow-screen";

export default function CoachInsightDetailScreen() {
  const { insightId } = useLocalSearchParams<{ insightId?: string }>();
  const isRetirementGoal = insightId === "retirement-fund";

  return (
    <CoachFlowScreen
      title={isRetirementGoal ? "Retirement Fund" : "Insight details"}
      description={
        isRetirementGoal
          ? "Review your retirement goal progress and the next steps available to you."
          : "The detailed explanation and supporting actions for this Wealth Coach insight will appear here."
      }
    />
  );
}
