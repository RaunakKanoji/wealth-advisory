export const OTP_LENGTH = 6;

export type AuthChannel = "sms" | "app";

export type RequestOtpInput = {
  identifier: string;
};

export type RequestOtpResult = {
  requestId: string;
  identifier: string;
  channel: AuthChannel;
  expiresAt: string;
  resendAvailableAt: string;
};

export type VerifyOtpInput = {
  requestId: string;
  identifier: string;
  code: string;
};

export type AuthenticatedUser = {
  id: string;
  identifier: string;
};

export type VerifyOtpResult = {
  user: AuthenticatedUser;
};

export type ResendOtpInput = {
  requestId: string;
  identifier: string;
};

export type AuthenticationErrorCode =
  | "invalid-identifier"
  | "invalid-otp"
  | "expired-otp"
  | "rate-limited"
  | "network-error"
  | "service-unavailable";

// Screens must never interpret raw backend/service errors directly — they
// only ever see this typed code plus the customer-safe message below.
export class AuthenticationServiceError extends Error {
  readonly code: AuthenticationErrorCode;

  constructor(code: AuthenticationErrorCode, message: string) {
    super(message);
    this.name = "AuthenticationServiceError";
    this.code = code;
  }
}

export function getAuthenticationErrorMessage(code: AuthenticationErrorCode): string {
  switch (code) {
    case "invalid-identifier":
      return "Enter a valid mobile number or customer ID to continue.";
    case "invalid-otp":
      return "That code didn't match. Check the code and try again.";
    case "expired-otp":
      return "This code has expired. Request a new one to continue.";
    case "rate-limited":
      return "Too many attempts. Please wait a moment before trying again.";
    case "network-error":
      return "We couldn't reach the network. Check your connection and try again.";
    case "service-unavailable":
      return "Sign-in is temporarily unavailable. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Masks all but the last 3 characters for customer-facing display — never
// render the full identifier once it's been collected. Does not affect what
// gets sent to the service, only what's shown on screen.
export function maskIdentifier(identifier: string): string {
  const digitsOnly = identifier.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    const last3 = digitsOnly.slice(-3);
    return `+91 ••••• ••${last3}`;
  }
  const last3 = identifier.slice(-3);
  return `••••${last3}`;
}
