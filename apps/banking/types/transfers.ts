import type { BankAccount, PaymentChannel, TransactionStatus } from "@/types/banking";

export type TransferDestinationType = "own-account" | "bank-account" | "upi";
export type TransferMethod = "internal" | "within-bank" | "imps" | "neft" | "upi";
export type TransferEnvironment = string;
export type BeneficiaryType = "bank-account" | "upi";
export type BeneficiaryStatus =
  | "draft"
  | "registration-pending"
  | "awaiting-authorisation"
  | "cooling-off"
  | "active"
  | "restricted"
  | "archived";
export type ResolutionStatus = "resolved" | "unavailable" | "not-requested";

export type Beneficiary = {
  id: string;
  customerId: string;
  type: BeneficiaryType;
  nickname?: string;
  bankReturnedName?: string;
  enteredName?: string;
  maskedAccountNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  status: BeneficiaryStatus;
  resolutionStatus: ResolutionStatus;
  lookupReference?: string;
  lookupAt?: string;
  registeredAt?: string;
  eligibleAt?: string;
  sourceEnvironment: TransferEnvironment;
  revision: number;
  updatedAt: string;
};

export type BeneficiaryInput =
  | {
      type: "bank-account";
      accountNumber: string;
      confirmAccountNumber: string;
      ifsc: string;
      recipientName: string;
      nickname?: string;
      saveBeneficiary?: boolean;
    }
  | {
      type: "upi";
      upiId: string;
      recipientName?: string;
      nickname?: string;
      saveBeneficiary?: boolean;
    };

export type TransferRecipientSnapshot = {
  type: TransferDestinationType;
  displayName: string;
  enteredName?: string;
  bankReturnedName?: string;
  maskedDestination: string;
  bankName?: string;
  ifsc?: string;
  upiId?: string;
  beneficiaryId?: string;
  resolutionStatus: ResolutionStatus;
  lookupReference?: string;
};

export type TransferDraftStatus =
  | "editing"
  | "validating-recipient"
  | "preparing-quote"
  | "ready-for-review"
  | "expired"
  | "cancelled-before-submission";

export type TransferDraft = {
  id: string;
  customerId: string;
  destinationType: TransferDestinationType;
  method?: TransferMethod;
  sourceAccountId?: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
  recipient: TransferRecipientSnapshot;
  amountMinorUnits?: number;
  paymentMessage?: string;
  privateNote?: string;
  status: TransferDraftStatus;
  reviewRevision: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  sourceEnvironment: TransferEnvironment;
};

export type TransferMethodOption = {
  method: TransferMethod;
  label: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  estimatedProcessing?: string;
};

export type TransferOptions = {
  destinationType: TransferDestinationType;
  methods: TransferMethodOption[];
  eligibleSourceAccounts: BankAccount[];
  eligibleOwnDestinationAccounts: BankAccount[];
  executionMode: "demo" | "live";
};

export type TransferQuote = {
  id: string;
  draftId: string;
  customerId: string;
  draftRevision: number;
  sourceAccount: Pick<BankAccount, "id" | "name" | "lastFour" | "type">;
  recipient: TransferRecipientSnapshot;
  method: TransferMethod;
  amountMinorUnits: number;
  feeMinorUnits?: number;
  taxMinorUnits?: number;
  totalDebitMinorUnits: number;
  currency: "INR";
  eligibility: "eligible";
  limitDescription?: string;
  estimatedProcessing?: string;
  requiredAuthorisation: "provider-controlled" | "demo-confirmation";
  expiresAt: string;
  sourceEnvironment: TransferEnvironment;
};

export type TransferAttemptStatus =
  | "submitting"
  | "accepted-processing"
  | "pending"
  | "succeeded"
  | "failed"
  | "status-unknown"
  | "return-pending"
  | "returned";

export type TransferAttempt = {
  id: string;
  customerId: string;
  draftId: string;
  idempotencyKey: string;
  requestFingerprint?: string;
  status: TransferAttemptStatus;
  destinationType: TransferDestinationType;
  method: TransferMethod;
  recipient: TransferRecipientSnapshot;
  sourceAccount: Pick<BankAccount, "id" | "name" | "lastFour" | "type">;
  amountMinorUnits: number;
  feeMinorUnits: number;
  taxMinorUnits: number;
  totalDebitMinorUnits: number;
  paymentMessage?: string;
  privateNote?: string;
  internalReference: string;
  providerReference?: string;
  bankReference?: string;
  createdAt: string;
  updatedAt: string;
  statusChecks: number;
  errorMessage?: string;
  demoDisclosure: "Demo transfer completed — no real money was transferred." | "Demo mode — no real money will be transferred.";
  sourceEnvironment: TransferEnvironment;
};

export type TransferHistoryFilters = {
  search?: string;
  fromDate?: string;
  toDate?: string;
  sourceAccountId?: string;
  method?: TransferMethod | "all";
  status?: TransferAttemptStatus | "all";
};

export type TransferHistoryPage = {
  items: TransferAttempt[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DemoLedgerEntry = {
  id: string;
  transferId: string;
  groupId: string;
  customerId: string;
  accountId?: string;
  direction: "credit" | "debit";
  amountMinorUnits: number;
  description: string;
  linkedEntryId?: string;
  status: TransactionStatus;
  transactionDate: string;
  reference: string;
  channel: PaymentChannel;
  sourceEnvironment: TransferEnvironment;
};
