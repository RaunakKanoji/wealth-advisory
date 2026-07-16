import { ConsentServiceError } from "@/src/features/consent/models/consent";
import type {
  ConsentCategory,
  ConsentReceipt,
  ConsentStatus,
  ConsentSubmission,
} from "@/src/features/consent/models/consent";
import {
  DEV_CONSENT_CATEGORY_DEFINITIONS,
  DEV_POLICY_VERSION,
  DEV_SERVICE_UNAVAILABLE_CUSTOMER_ID,
} from "@/src/features/consent/services/consent.fixtures";
import type { ConsentConfiguration, ConsentService } from "@/src/features/consent/services/consent.service";

export type DevConsentServiceOptions = {
  simulateSubmissionFailure?: boolean;
};

// Explicit development adapter — deterministic, in-memory, no real consent
// API involved. Does not silently fall back to mock behavior in a
// production configuration: this module is only ever wired in from
// consent.service.ts, which is the single place a real adapter would
// replace it.
export function createDevConsentService(
  options: DevConsentServiceOptions = {},
): ConsentService {
  let lastStatus: ConsentStatus = "not-started";
  let receiptSequence = 0;

  return {
    async getConsentConfiguration(): Promise<ConsentConfiguration> {
      if (lastStatus === "not-started") {
        lastStatus = "in-progress";
      }

      const categories: ConsentCategory[] = DEV_CONSENT_CATEGORY_DEFINITIONS.map(
        (definition) => ({
          ...definition,
          purposes: definition.purposes,
          selected: definition.required,
          policyVersion: DEV_POLICY_VERSION,
        }),
      );

      return { categories, policyVersion: DEV_POLICY_VERSION };
    },

    async submitConsent(input: ConsentSubmission): Promise<ConsentReceipt> {
      if (options.simulateSubmissionFailure || input.customerId === DEV_SERVICE_UNAVAILABLE_CUSTOMER_ID) {
        lastStatus = "failed";
        throw new ConsentServiceError(
          "service-unavailable",
          "Development fixture: consent service unavailable.",
        );
      }

      receiptSequence += 1;
      lastStatus = "submitted";

      return {
        receiptId: `dev-consent-receipt-${receiptSequence}`,
        customerId: input.customerId,
        decisions: input.decisions,
        policyVersion: input.policyVersion,
        submittedAt: new Date().toISOString(),
        channel: input.channel,
      };
    },

    async getConsentStatus(): Promise<ConsentStatus> {
      return lastStatus;
    },
  };
}
