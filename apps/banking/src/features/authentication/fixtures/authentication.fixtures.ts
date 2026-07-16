import type { CustomerOnboardingStatus } from "@/src/features/authentication/models/authentication";

// DEVELOPMENT FIXTURES — deterministic, fictional, no real customer data.
// These values live only here, in the mock adapter, and in tests. Never
// reference them from screen components, and never treat them as secrets —
// they authenticate nothing outside the mock adapter.

export const DEV_VALID_OTP = "123456";
/** Always reports as expired — a stable way to exercise the expired-code
 *  state without waiting out the real TTL. */
export const DEV_EXPIRED_OTP = "000000";

type DevCustomerFixture = {
  customerId: string;
  displayName: string;
  onboardingStatus: CustomerOnboardingStatus;
};

/** Registered development customers, keyed by normalized mobile number. */
export const DEV_CUSTOMERS: Record<string, DevCustomerFixture> = {
  // Primary journey: fresh customer who still has to grant consent.
  "9876543210": {
    customerId: "dev-cust-0210",
    displayName: "Ananya",
    onboardingStatus: "consent-required",
  },
  // Consent done, financial profile pending.
  "9876543211": {
    customerId: "dev-cust-0211",
    displayName: "Rahul",
    onboardingStatus: "profile-required",
  },
  // Fully onboarded customer — lands straight on the dashboard.
  "9876543212": {
    customerId: "dev-cust-0212",
    displayName: "Priya",
    onboardingStatus: "complete",
  },
};

/** Registered number whose OTP request always fails as service-unavailable. */
export const DEV_SERVICE_UNAVAILABLE_IDENTIFIER = "9876543299";

export const DEV_OTP_TTL_MS = 5 * 60 * 1000;
export const DEV_RESEND_COOLDOWN_MS = 30 * 1000;
export const DEV_SESSION_TTL_MS = 30 * 60 * 1000;
export const DEV_MAX_VERIFY_ATTEMPTS = 5;

/** Artificial latency so loading states are visible during development. */
export const DEV_LATENCY_MS = 650;
