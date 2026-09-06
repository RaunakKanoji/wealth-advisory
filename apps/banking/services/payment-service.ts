import {
  MAX_PAYMENT_MINOR_UNITS,
  parseAmountToMinorUnits,
  type ParsedPaymentQr,
} from "@/lib/payment-qr-parser";
import {
  getAccount,
  getAccounts,
} from "@/services/accounts-service";
import { recordDemoPaymentActivity } from "@/services/demo-payment-ledger";
import {
  checkTransferStatus,
  clearTransferServiceState,
  createTransferDraft,
  executeTransfer,
  quoteTransfer,
  updateTransferDraft,
} from "@/services/transfer-service";
import type { BankAccount } from "@/types/banking";
import type {
  PaymentAttempt,
  PaymentDraft,
  PaymentExecutionMode,
  PaymentInputMethod,
  PaymentRecipient,
} from "@/types/payments";

const DEMO_PAYMENT_MODE: PaymentExecutionMode = "demo";
const DRAFT_TTL_MS = 10 * 60 * 1000;
const DEMO_CUSTOMER_FALLBACK = "demo-customer-a";

const demoRecipients: Record<string, string> = {
  "merchant@demo": "Demo Store",
  "success@demo": "Demo Store",
  "failed@demo": "Demo Recipient",
  "pending@demo": "Demo Recipient",
};

const idempotentAttempts = new Map<string, { fingerprint: string; attempt: PaymentAttempt }>();
const attemptsById = new Map<string, PaymentAttempt>();

function scopedCustomerId(customerId?: string | null) {
  return customerId?.trim() || DEMO_CUSTOMER_FALLBACK;
}

function createOpaqueId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof randomUuid === "function") {
    return `${prefix}-${randomUuid()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getRecipientInformation(
  parsed: ParsedPaymentQr,
  inputMethod: PaymentInputMethod,
): PaymentRecipient {
  const demoName = demoRecipients[parsed.recipientAddress.toLowerCase()];
  if (demoName) {
    return {
      address: parsed.recipientAddress,
      displayName: demoName,
      informationSource: "Test recipient — demo data",
      isVerified: false,
    };
  }

  return {
    address: parsed.recipientAddress,
    displayName: parsed.recipientLabel,
    informationSource: parsed.recipientLabel
      ? inputMethod === "manual"
        ? "Customer-entered label"
        : "Name supplied by QR"
      : "Recipient lookup unavailable",
    isVerified: false,
  };
}

export function getPaymentExecutionMode(): PaymentExecutionMode {
  // A future live adapter belongs behind an authorised server configuration.
  // Client state, query parameters, and localStorage cannot enable it.
  return DEMO_PAYMENT_MODE;
}

export async function getEligibleFundingAccounts(customerId?: string | null): Promise<BankAccount[]> {
  const accounts = await getAccounts({ customerId: scopedCustomerId(customerId) });
  return accounts.filter(
    (account) =>
      account.status === "active"
      && (account.type === "savings" || account.type === "current" || account.type === "salary"),
  );
}

export async function preparePaymentDraft(
  parsed: ParsedPaymentQr,
  inputMethod: PaymentInputMethod,
  options?: { customerId?: string | null },
): Promise<PaymentDraft> {
  const customerId = scopedCustomerId(options?.customerId);
  const accounts = await getEligibleFundingAccounts(customerId);
  if (accounts.length === 0) {
    throw new Error("No eligible payment account is available");
  }

  const now = Date.now();
  return {
    id: createOpaqueId("draft"),
    customerId,
    inputMethod,
    recipient: getRecipientInformation(parsed, inputMethod),
    amountMinorUnits: parsed.amountMinorUnits,
    amountSource: parsed.amountSource,
    currency: "INR",
    note: parsed.note,
    merchantCategory: parsed.merchantCategory,
    requestReference: parsed.requestReference,
    fundingAccountId: accounts.find((account) => account.isPrimary)?.id ?? accounts[0].id,
    reviewRevision: 1,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DRAFT_TTL_MS).toISOString(),
  };
}

function validateDraft(
  draft: PaymentDraft,
  amountMinorUnits: number | null,
  fundingAccountId: string,
  customerId: string,
  accounts: BankAccount[],
) {
  if (draft.customerId !== customerId) {
    throw new Error("This payment draft is not available for the signed-in customer");
  }
  if (Date.parse(draft.expiresAt) <= Date.now()) {
    throw new Error("This payment review expired. Scan the QR again.");
  }
  if (draft.currency !== "INR" || amountMinorUnits === null) {
    throw new Error("Enter a valid INR amount before continuing");
  }
  if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > MAX_PAYMENT_MINOR_UNITS) {
    throw new Error("The payment amount is outside the supported range");
  }

  const account = accounts.find((item) => item.id === fundingAccountId);
  if (!account) {
    throw new Error("Choose an eligible payment account");
  }
  if (account.status !== "active" || !["savings", "current", "salary"].includes(account.type)) {
    throw new Error("That account cannot be used for this payment");
  }
  if (account.availableBalanceMinorUnits !== undefined && amountMinorUnits > account.availableBalanceMinorUnits) {
    throw new Error("The selected account does not have enough available balance");
  }

  return account;
}

function fingerprint(
  draft: PaymentDraft,
  amountMinorUnits: number,
  fundingAccountId: string,
) {
  return JSON.stringify({
    customerId: draft.customerId,
    recipientAddress: draft.recipient.address,
    amountMinorUnits,
    currency: draft.currency,
    fundingAccountId,
    note: draft.note ?? "",
    reviewRevision: draft.reviewRevision,
  });
}

export async function executeDemoPayment(input: {
  draft: PaymentDraft;
  amountMinorUnits: number | null;
  fundingAccountId: string;
  idempotencyKey: string;
  customerId?: string | null;
}): Promise<PaymentAttempt> {
  const customerId = scopedCustomerId(input.customerId);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new Error("A payment confirmation key is required");
  }

  const amountMinorUnits = input.amountMinorUnits;
  if (amountMinorUnits === null) {
    throw new Error("Enter an amount before confirming");
  }
  // Round-tripping through the exact parser keeps the execution boundary
  // consistent with amount entry and rejects accidental non-integer paise.
  parseAmountToMinorUnits((amountMinorUnits / 100).toFixed(2));

  const requestFingerprint = fingerprint(input.draft, amountMinorUnits, input.fundingAccountId);
  const existing = idempotentAttempts.get(`${customerId}:${idempotencyKey}`);

  if (existing) {
    if (existing.fingerprint !== requestFingerprint) {
      throw new Error("This confirmation key was already used for different payment details");
    }
    return existing.attempt;
  }
  const accounts = await getEligibleFundingAccounts(customerId);
  const account = validateDraft(input.draft, amountMinorUnits, input.fundingAccountId, customerId, accounts);
  const sharedDraft = await createTransferDraft({
    destinationType: "upi",
    customerId,
    sourceAccountId: account.id,
    recipientInput: {
      type: "upi",
      upiId: input.draft.recipient.address,
      recipientName: input.draft.recipient.displayName,
      saveBeneficiary: false,
    },
    paymentMessage: input.draft.note,
  });
  const preparedDraft = await updateTransferDraft(sharedDraft.id, {
    amountMinorUnits,
    method: "upi",
    paymentMessage: input.draft.note,
  }, { customerId });
  const quote = await quoteTransfer(preparedDraft.id, { customerId });
  const sharedAttempt = await executeTransfer({
    draftId: preparedDraft.id,
    quoteId: quote.id,
    idempotencyKey,
    customerId,
  });
  const status: PaymentAttempt["status"] = sharedAttempt.status === "succeeded" ? "succeeded" : sharedAttempt.status === "failed" ? "failed" : "pending";
  const now = new Date().toISOString();
  const attemptId = createOpaqueId("demo-attempt");
  const attempt: PaymentAttempt = {
    id: attemptId,
    customerId,
    mode: DEMO_PAYMENT_MODE,
    status,
    inputMethod: input.draft.inputMethod,
    recipient: input.draft.recipient,
    amountMinorUnits,
    currency: "INR",
    fundingAccount: {
      id: account.id,
      name: account.name,
      lastFour: account.lastFour,
      type: account.type,
    },
    note: input.draft.note,
    internalReference: sharedAttempt.internalReference,
    createdAt: now,
    updatedAt: now,
    demoDisclosure: "No money was transferred.",
    errorMessage: status === "failed" ? "The deterministic demo simulation failed." : undefined,
    sharedTransferAttemptId: sharedAttempt.id,
  };

  idempotentAttempts.set(`${customerId}:${idempotencyKey}`, {
    fingerprint: requestFingerprint,
    attempt,
  });
  attemptsById.set(attempt.id, attempt);

  if (status === "succeeded") {
    recordDemoPaymentActivity({
      id: `activity-${attempt.id}`,
      customerId,
      accountId: account.id,
      title: `Demo payment · ${attempt.recipient.displayName ?? attempt.recipient.address}`,
      timestamp: now,
      amount: amountMinorUnits / 100,
      amountMinorUnits,
      direction: "debit",
      category: "transfer",
    });
  }

  return attempt;
}

export async function checkDemoPaymentStatus(
  attemptId: string,
  customerId?: string | null,
): Promise<PaymentAttempt> {
  const attempt = attemptsById.get(attemptId);
  if (!attempt || attempt.customerId !== scopedCustomerId(customerId)) {
    throw new Error("Payment attempt unavailable");
  }

  if (!attempt.sharedTransferAttemptId || attempt.status !== "pending") return attempt;
  const sharedAttempt = await checkTransferStatus(attempt.sharedTransferAttemptId, { customerId: scopedCustomerId(customerId) });
  const nextStatus: PaymentAttempt["status"] = sharedAttempt.status === "succeeded" ? "succeeded" : sharedAttempt.status === "failed" ? "failed" : "pending";
  const nextAttempt = { ...attempt, status: nextStatus, updatedAt: sharedAttempt.updatedAt };
  attemptsById.set(attemptId, nextAttempt);
  for (const [key, value] of idempotentAttempts.entries()) {
    if (value.attempt.id === attemptId) idempotentAttempts.set(key, { ...value, attempt: nextAttempt });
  }
  return nextAttempt;
}

export async function validateFundingAccount(
  accountId: string,
  customerId?: string | null,
) {
  const account = await getAccount(accountId, { customerId: scopedCustomerId(customerId) });
  if (!account || account.status !== "active" || !["savings", "current", "salary"].includes(account.type)) {
    throw new Error("That account cannot be used for this payment");
  }
  return account;
}

/** Test-only reset for the in-memory demo adapter. */
export function clearDemoPaymentState() {
  idempotentAttempts.clear();
  attemptsById.clear();
  void clearTransferServiceState(DEMO_CUSTOMER_FALLBACK);
}
