import { useLocalSearchParams } from "expo-router";
import React from "react";

import { CoachFlowScreen } from "@/components/coach/coach-flow-screen";

export default function CoachRecommendationDetailScreen() {
  const { recommendationId } = useLocalSearchParams<{ recommendationId?: string }>();
  const title = recommendationId === "start-sip" ? "Start a New SIP" : "Recommendation details";

  return (
    <CoachFlowScreen
      title={title}
      description="This educational recommendation will connect to the approved product or guidance flow when the backend service is enabled."
    />
  );
}
