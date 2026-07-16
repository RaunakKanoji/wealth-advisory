import { createDevConsentService } from "@/src/features/consent/services/consent.dev";
import type {
  ConsentCategory,
  ConsentReceipt,
  ConsentStatus,
  ConsentSubmission,
} from "@/src/features/consent/models/consent";

export type ConsentConfiguration = {
  categories: readonly ConsentCategory[];
  policyVersion: string;
};

export interface ConsentService {
  getConsentConfiguration(): Promise<ConsentConfiguration>;
  submitConsent(input: ConsentSubmission): Promise<ConsentReceipt>;
  getConsentStatus(): Promise<ConsentStatus>;
}

// Swap this for a real consent-API-backed implementation once approved.
// Screens and state depend only on the ConsentService interface above, so
// nothing outside this file needs to change when that happens.
export const consentService: ConsentService = createDevConsentService();
