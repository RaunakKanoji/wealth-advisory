// Normalized authentication errors. Screens and hooks consume ONLY this
// shape — never raw provider/backend errors, stack traces, or request IDs.

export type AuthenticationErrorCode =
  | "INVALID_IDENTIFIER"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "RESEND_NOT_AVAILABLE"
  | "NETWORK_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "MISSING_CHALLENGE"
  | "UNKNOWN";

export interface AuthenticationError {
  code: AuthenticationErrorCode;
  message: string;
  retryable: boolean;
}

// Customer-safe copy per code. No provider names, no request identifiers,
// no token/expiry internals.
const ERROR_MESSAGES: Record<AuthenticationErrorCode, string> = {
  INVALID_IDENTIFIER:
    "We couldn't find an account with this mobile number. Check the number registered with IDBI Bank.",
  INVALID_OTP: "That code didn't match. Check the code and try again.",
  OTP_EXPIRED: "This code has expired. Request a new code to continue.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Please request a new code and try again.",
  RESEND_NOT_AVAILABLE: "Please wait a moment before requesting another code.",
  NETWORK_ERROR: "We couldn't reach the network. Check your connection and try again.",
  SERVICE_UNAVAILABLE: "Sign-in is temporarily unavailable. Please try again shortly.",
  SESSION_EXPIRED: "Your session has expired to protect your account. Please sign in again.",
  MISSING_CHALLENGE: "Your verification session ended. Start again from sign-in.",
  UNKNOWN: "Something went wrong. Please try again.",
};

const RETRYABLE_CODES: ReadonlySet<AuthenticationErrorCode> = new Set([
  "INVALID_OTP",
  "RESEND_NOT_AVAILABLE",
  "NETWORK_ERROR",
  "SERVICE_UNAVAILABLE",
]);

/** Typed error thrown by every AuthenticationService implementation. */
export class AuthenticationServiceError extends Error implements AuthenticationError {
  readonly code: AuthenticationErrorCode;
  readonly retryable: boolean;

  constructor(code: AuthenticationErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AuthenticationServiceError";
    this.code = code;
    this.retryable = RETRYABLE_CODES.has(code);
  }
}

export function isAuthenticationError(error: unknown): error is AuthenticationServiceError {
  return error instanceof AuthenticationServiceError;
}

/** Collapses any thrown value into a customer-safe AuthenticationError. */
export function normalizeAuthenticationError(error: unknown): AuthenticationError {
  if (isAuthenticationError(error)) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    code: "UNKNOWN",
    message: ERROR_MESSAGES.UNKNOWN,
    retryable: false,
  };
}

export function getAuthenticationErrorMessage(code: AuthenticationErrorCode): string {
  return ERROR_MESSAGES[code];
}
