import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Announces `message` to the screen reader whenever it becomes non-null.
 *
 * iOS only: VoiceOver has no live regions, so views that appear with
 * `accessibilityRole="alert"` are silent there without an explicit
 * announcement. Android (and web) announce the alert role on their own —
 * announcing on both would read the message twice.
 */
export function useAccessibilityAnnouncement(message: string | null) {
  useEffect(() => {
    if (message && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
