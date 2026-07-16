/**
 * Customer-safe feedback copy (F008), normalized across the app.
 *
 * Raw error messages, codes, and stack traces must never reach the customer.
 * Surfaces show copy from here — or copy that was written for customers —
 * and keep the technical detail in logs behind the service boundary.
 */
export const FEEDBACK_COPY = {
  /** Recoverable failure inside a screen (fetch failed, action failed). */
  error: {
    message: "Something went wrong. Please try again.",
    retryLabel: "Retry",
  },
  /** Unhandled render error caught by a route error boundary. */
  appError: {
    message:
      "Your money is safe. Something went wrong on our side — please try again. If this keeps happening, we're already looking into it.",
    retryLabel: "Try again",
  },
  /** A dependent service is known to be down or not yet available. */
  unavailable: {
    message: "This service is temporarily unavailable. Please try again in a few minutes.",
    retryLabel: "Try again",
  },
  /** Device has no network connection. */
  offline: {
    message: "You're offline. Some information may be out of date.",
  },
} as const;
