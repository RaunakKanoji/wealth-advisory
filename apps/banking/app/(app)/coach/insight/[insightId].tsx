import { useLocalSearchParams } from "expo-router";

import { InsightDetailScreen } from "@/components/coach/insight-detail-screen";

export default function CoachInsightDetailRoute() {
  const { insightId } = useLocalSearchParams<"/(app)/coach/insight/[insightId]">();

  return <InsightDetailScreen insightId={insightId} />;
}
