import type { BankAccount } from "./banking";
import type { ParsedPaymentQr } from "@/lib/payment-qr-parser";

export type PaymentInputMethod = "camera" | "upload" | "manual";

export type PaymentExecutionMode = "demo" | "live";

export type DemoPaymentOutcome = "succeeded" | "failed" | "pending";

export type RecipientInformationSource =
  | "Name supplied by QR"
  | "Customer-entered label"
  | "Test recipient — demo data"
  | "Recipient lookup unavailable";

export type PaymentRecipient = {
  address: string;
  displayName?: string;
  informationSource: RecipientInformationSource;
  isVerified: false;
};

export type PaymentDraft = {
  id: string;
  customerId: string;
  inputMethod: PaymentInputMethod;
  recipient: PaymentRecipient;
  amountMinorUnits: number | null;
  amountSource: ParsedPaymentQr["amountSource"];
  currency: "INR";
  note?: string;
  merchantCategory?: string;
  requestReference?: string;
  fundingAccountId?: string;
  reviewRevision: number;
  createdAt: string;
  expiresAt: string;
};

export type PaymentAttemptStatus =
  | "draft"
  | "awaiting-review"
  | "awaiting-authorisation"
  | "submitted"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled-before-submission"
  | "status-unknown";

export type PaymentAttempt = {
  id: string;
  customerId: string;
  mode: PaymentExecutionMode;
  status: PaymentAttemptStatus;
  inputMethod: PaymentInputMethod;
  recipient: PaymentRecipient;
  amountMinorUnits: number;
  currency: "INR";
  fundingAccount: Pick<BankAccount, "id" | "name" | "lastFour" | "type">;
  note?: string;
  internalReference: string;
  createdAt: string;
  updatedAt: string;
  demoDisclosure: "No money was transferred.";
  errorMessage?: string;
  /** Internal bridge to the shared transfer attempt used by QR and typed flows. */
  sharedTransferAttemptId?: string;
};
