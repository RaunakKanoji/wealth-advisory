import { z } from "zod";

// Indian registered mobile-number validation (mobile-first; the
// CustomerIdentifierType model stays extensible for customer-ID later).
//
// Accepted input forms, all normalizing to "9876543210":
//   9876543210
//   +919876543210
//   +91 98765 43210
//   98765 43210
//
// The raw and normalized values live only in component/hook memory during
// the flow — never persisted, never logged, never placed in route params.

const ALLOWED_INPUT = /^[+\d ]*$/;

/**
 * Strips spaces and an optional +91 / 91 country prefix. Returns the bare
 * digits — validation of the result happens in the schema below.
 */
export function normalizeMobileNumber(raw: string): string {
  let digits = raw.replace(/ /g, "");
  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  }
  return digits;
}

export const mobileNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter the mobile number registered with IDBI Bank.")
  .refine((value) => ALLOWED_INPUT.test(value), {
    message: "Mobile numbers can only contain digits.",
  })
  .transform(normalizeMobileNumber)
  .refine((value) => /^\d{10}$/.test(value), {
    message: "Enter a valid 10-digit mobile number.",
  });

export type ValidatedMobileNumber = z.infer<typeof mobileNumberSchema>;
