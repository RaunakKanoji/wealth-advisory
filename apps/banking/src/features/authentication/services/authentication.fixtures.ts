// DEVELOPMENT FIXTURES — deterministic, no real customer data. Used only by
// the dev authentication adapter (authentication.dev.ts) until the approved
// bank OTP provider is available.

export const DEV_VALID_OTP = "123456";
// Always reports as expired, regardless of actual elapsed time — a stable
// way to exercise the expired-code state without waiting out the real TTL.
export const DEV_EXPIRED_OTP = "111111";

export const DEV_RATE_LIMITED_IDENTIFIER = "9999999999";
export const DEV_SERVICE_UNAVAILABLE_IDENTIFIER = "0000000000";

export const DEV_OTP_TTL_MS = 5 * 60 * 1000;
export const DEV_RESEND_COOLDOWN_MS = 30 * 1000;
