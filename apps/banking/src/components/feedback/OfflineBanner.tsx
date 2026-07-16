import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { OfflineState } from "@/src/components/feedback/OfflineState";
import { useAccessibilityAnnouncement } from "@/src/components/feedback/useAccessibilityAnnouncement";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";

// Live connectivity banner (demo: shell/offline-banner.tsx). Mounted by
// Screen/KeyboardScreen so every surface shows it while offline; announced
// once per offline transition, not once per screen.
export function OfflineBanner() {
  const { offline } = useNetworkStatus();
  useAccessibilityAnnouncement(offline ? FEEDBACK_COPY.offline.message : null);

  if (!offline) {
    return null;
  }
  return <OfflineState />;
}
