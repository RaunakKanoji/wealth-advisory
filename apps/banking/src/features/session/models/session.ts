import type {
  AuthenticatedCustomer,
  AuthenticationSession,
  CustomerOnboardingStatus,
} from "@/src/features/authentication/models/authentication";

// Established-session state — deliberately separate from the temporary OTP
// challenge state (features/authentication/state), which never mixes with it.

export type SessionStatus =
  | "bootstrapping"
  | "unauthenticated"
  | "authenticated"
  | "onboarding-required"
  | "expired"
  | "error";

export type SessionState = {
  status: SessionStatus;
  customer: AuthenticatedCustomer | null;
  /** Token material; null when an external provider (Clerk) owns tokens.
   *  Never rendered, logged, or placed in route params. */
  session: AuthenticationSession | null;
};

/** Maps the customer's onboarding progress to the session status that drives
 *  routing: only fully onboarded customers reach the authenticated shell. */
export function statusForOnboarding(onboarding: CustomerOnboardingStatus): SessionStatus {
  return onboarding === "complete" ? "authenticated" : "onboarding-required";
}
