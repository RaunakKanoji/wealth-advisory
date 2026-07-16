export type ConsentCategoryId =
  | "banking-information"
  | "investments"
  | "loans-and-liabilities"
  | "profile-and-kyc"
  | "marketing-and-engagement";

export type ConsentCategory = {
  id: ConsentCategoryId;
  title: string;
  summary: string;
  purposes: readonly string[];
  required: boolean;
  selected: boolean;
  policyVersion: string;
};

export type ConsentStatus = "not-started" | "in-progress" | "submitted" | "failed";

export type ConsentDecisionValue = "granted" | "declined";

export type ConsentDecision = {
  categoryId: ConsentCategoryId;
  decision: ConsentDecisionValue;
  required: boolean;
  policyVersion: string;
  decidedAt: string;
};

export type ConsentChannel = "mobile" | "web";

export type ConsentSubmission = {
  customerId: string;
  decisions: readonly ConsentDecision[];
  policyVersion: string;
  channel: ConsentChannel;
  acknowledgedAt: string;
};

export type ConsentReceipt = {
  receiptId: string;
  customerId: string;
  decisions: readonly ConsentDecision[];
  policyVersion: string;
  submittedAt: string;
  channel: ConsentChannel;
};

export type ConsentServiceErrorCode = "validation-failed" | "service-unavailable" | "network-error";

// Screens must never interpret raw backend/service errors directly — they
// only ever see this typed code plus the customer-safe message below.
export class ConsentServiceError extends Error {
  readonly code: ConsentServiceErrorCode;

  constructor(code: ConsentServiceErrorCode, message: string) {
    super(message);
    this.name = "ConsentServiceError";
    this.code = code;
  }
}

export function getConsentErrorMessage(code: ConsentServiceErrorCode): string {
  switch (code) {
    case "validation-failed":
      return "We couldn't process your permissions. Please review your selections and try again.";
    case "service-unavailable":
      return "We couldn't save your permissions right now. Please try again.";
    case "network-error":
      return "We couldn't reach the network. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
