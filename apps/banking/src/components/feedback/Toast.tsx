import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/src/theme";

const TOAST_DURATION_MS = 4000;

type Toast = {
  id: number;
  text: string;
};

type ToastContextValue = {
  showToast: (text: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Ported from the demo's ToastLayer (components/feedback/toast.tsx): polite
// announcement, auto-dismiss after 4s, anchored near the bottom of the
// screen. The demo's aria-live region maps to accessibilityLiveRegion
// (Android) plus announceForAccessibility (iOS/VoiceOver, which has no live
// regions). Toasts are informational only, so the layer never intercepts
// touches.
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text }]);
    AccessibilityInfo.announceForAccessibility(text);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={[styles.layer, { bottom: insets.bottom + spacing.xxl }]}
      >
        {toasts.map((toast) => (
          <View key={toast.id} style={styles.toast} testID="toast">
            <Text variant="supporting" color={colors.textInverse}>
              {toast.text}
            </Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  toast: {
    maxWidth: "100%",
    borderRadius: radius.control,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.raised,
  },
});
