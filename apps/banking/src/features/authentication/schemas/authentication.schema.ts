import { z } from "zod";

import { OTP_LENGTH } from "@/src/features/authentication/models/authentication";

export const identifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number or customer ID.")
  .refine(
    (value) => /^\d{10}$/.test(value) || /^[A-Za-z0-9]{6,20}$/.test(value),
    "Enter a valid 10-digit mobile number or customer ID.",
  );

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code.`);
