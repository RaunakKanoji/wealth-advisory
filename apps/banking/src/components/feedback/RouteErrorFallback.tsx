import type { ErrorBoundaryProps } from "expo-router";

import { ErrorState } from "@/src/components/feedback/ErrorState";
import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { Screen } from "@/src/components/layout/Screen";

// Customer-safe fallback for unhandled render errors (demo: app/error.tsx).
// The caught error is deliberately not rendered — Expo Router logs it in
// development, and the customer only ever sees reassuring, generic copy.
// Route files opt in with: `export { RouteErrorFallback as ErrorBoundary }`.
export function RouteErrorFallback({ retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <ErrorState
        message={FEEDBACK_COPY.appError.message}
        retryLabel={FEEDBACK_COPY.appError.retryLabel}
        onRetry={() => {
          void retry();
        }}
      />
    </Screen>
  );
}
