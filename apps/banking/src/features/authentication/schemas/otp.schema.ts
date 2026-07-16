import { z } from "zod";

import { OTP_LENGTH } from "@/src/features/authentication/models/authentication";

// OTP codes are numeric, exactly OTP_LENGTH digits, no spaces. Incomplete
// codes are rejected before any service call. OTP values are never
// persisted, logged, or placed in route params.

export function createOtpSchema(length: number = OTP_LENGTH) {
  return z
    .string()
    .regex(new RegExp(`^\\d{${length}}$`), `Enter the ${length}-digit code.`);
}

export const otpSchema = createOtpSchema();
