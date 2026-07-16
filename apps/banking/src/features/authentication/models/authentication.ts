// Authentication contracts. These types are the boundary between the UI and
// whichever adapter (mock / Clerk / bank) fulfils the journey — screens and
// hooks must not know which implementation is active.
//
// Tokens in these shapes are never rendered, logged, placed in route params,
// sent to analytics, or included in crash reports.

export const OTP_LENGTH = 6;

export type CustomerIdentifierType = "mobile-number" | "customer-id";

export interface RequestOtpInput {
  identifierType: CustomerIdentifierType;
  identifier: string;
}

export interface RequestOtpResult {
  challengeId: string;
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface VerifyOtpInput {
  challengeId: string;
  otp: string;
}

export type CustomerOnboardingStatus =
  | "consent-required"
  | "profile-required"
  | "risk-profile-required"
  | "complete";

export interface AuthenticatedCustomer {
  customerId: string;
  displayName?: string;
  onboardingStatus: CustomerOnboardingStatus;
}

export interface AuthenticationSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface VerifyOtpResult {
  session: AuthenticationSession;
  customer: AuthenticatedCustomer;
}

/**
 * Masks a normalized 10-digit mobile number for customer-facing display:
 * "9876543210" -> "+91 ••••• ••210". The full number is never shown again
 * after the OTP request, and never placed in route parameters.
 */
export function maskMobileNumber(normalized: string): string {
  const last3 = normalized.slice(-3);
  return `+91 ••••• ••${last3}`;
}
