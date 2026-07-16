import { z } from "zod";

export const consentCategoryIdSchema = z.enum([
  "banking-information",
  "investments",
  "loans-and-liabilities",
  "profile-and-kyc",
  "marketing-and-engagement",
]);

export const consentDecisionSchema = z.object({
  categoryId: consentCategoryIdSchema,
  decision: z.enum(["granted", "declined"]),
  required: z.boolean(),
  policyVersion: z.string().min(1),
  decidedAt: z.string().min(1),
});

export const consentSubmissionSchema = z.object({
  customerId: z.string().min(1),
  decisions: z.array(consentDecisionSchema).min(1),
  policyVersion: z.string().min(1),
  channel: z.enum(["mobile", "web"]),
  acknowledgedAt: z.string().min(1),
});
