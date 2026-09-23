import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B, DEMO_SOURCE_LABEL } from "@/data/accounts-demo-data";
import { getDemoBeneficiaries } from "@/data/transfers-demo-data";
import { isValidUpiId, parseAmountToMinorUnits, type ParsedPaymentQr } from "@/lib/payment-qr-parser";
import { getAccounts } from "@/services/accounts-service";
import { recordDemoTransferLedger } from "@/services/demo-transfer-ledger";
import type { BankAccount } from "@/types/banking";
import type {
  Beneficiary,
  BeneficiaryInput,
  ResolutionStatus,
  TransferAttempt,
  TransferAttemptStatus,
  TransferDraft,
  TransferHistoryFilters,
  TransferHistoryPage,
  TransferMethod,
  TransferMethodOption,
  TransferOptions,
  TransferQuote,
  TransferRecipientSnapshot,
  TransferDestinationType,
} from "@/types/transfers";

const STATE_KEY_PREFIX = "idbi-transfer-state";
const DRAFT_TTL_MS = 10 * 60 * 1000;
const QUOTE_TTL_MS = 5 * 60 * 1000;
const MAX_NOTE_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 80;

type StoredBeneficiary = Beneficiary & { accountNumber?: string };
type StoredState = {
  seeded: boolean;
  beneficiaries: StoredBeneficiary[];
  drafts: TransferDraft[];
  quotes: TransferQuote[];
  attempts: TransferAttempt[];
  qrIntakes: TransferQrIntake[];
};

export type TransferQrIntake = {
  id: string;
  customerId: string;
  upiId: string;
  recipientName?: string;
  amountMinorUnits: number | null;
  paymentMessage?: string;
  requestReference?: string;
  createdAt: string;
  expiresAt: string;
};

const memory = new Map<string, StoredState>();

function customerScope(customerId?: string | null): string {
  return customerId?.trim() || DEMO_CUSTOMER_A;
}

function fixtureCustomerId(customerId?: string | null): string {
  return customerId === DEMO_CUSTOMER_B || customerId?.includes("customer-b") ? DEMO_CUSTOMER_B : DEMO_CUSTOMER_A;
}

function stateKey(customerId: string): string {
  return `${STATE_KEY_PREFIX}.${customerId.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

function id(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  return typeof uuid === "function" ? `${prefix}-${uuid()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function emptyState(): StoredState {
  return { seeded: false, beneficiaries: [], drafts: [], quotes: [], attempts: [], qrIntakes: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseState(value: string | null): StoredState {
  if (!value) return emptyState();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return emptyState();
    return {
      seeded: parsed.seeded === true,
      beneficiaries: Array.isArray(parsed.beneficiaries) ? parsed.beneficiaries.filter((item): item is StoredBeneficiary => isRecord(item) && typeof item.id === "string") : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts.filter((item): item is TransferDraft => isRecord(item) && typeof item.id === "string") : [],
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes.filter((item): item is TransferQuote => isRecord(item) && typeof item.id === "string") : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts.filter((item): item is TransferAttempt => isRecord(item) && typeof item.id === "string") : [],
      qrIntakes: Array.isArray(parsed.qrIntakes) ? parsed.qrIntakes.filter((item): item is TransferQrIntake => isRecord(item) && typeof item.id === "string") : [],
    };
  } catch {
    return emptyState();
  }
}

async function loadState(customerId?: string | null): Promise<StoredState> {
  const scope = customerScope(customerId);
  const cached = memory.get(scope);
  if (cached) return cached;

  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(stateKey(scope));
    if (!stored && Platform.OS === "web" && typeof localStorage !== "undefined") stored = localStorage.getItem(stateKey(scope));
  } catch {
    stored = Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage.getItem(stateKey(scope)) : null;
  }

  const state = parseState(stored);
  if (!state.seeded) {
    state.beneficiaries = getDemoBeneficiaries(fixtureCustomerId(scope)).map((item) => ({ ...item, customerId: scope }));
    state.seeded = true;
  }
  memory.set(scope, state);
  return state;
}

async function saveState(customerId: string, state: StoredState): Promise<void> {
  memory.set(customerId, state);
  const serialized = JSON.stringify(Platform.OS === "web" ? webSafeState(state) : state);
  try {
    await SecureStore.setItemAsync(stateKey(customerId), serialized);
  } catch {
    // Session memory remains usable when secure storage is unavailable.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(stateKey(customerId), serialized);
    } catch {
      // Browser storage may be disabled.
    }
  }
}

function maskUpiId(value: string): string {
  const at = value.indexOf("@");
  return at > 1 ? `${value.slice(0, 1)}***${value.slice(at)}` : "***@masked";
}

function webSafeRecipient(recipient: TransferRecipientSnapshot): TransferRecipientSnapshot {
  return {
    ...recipient,
    upiId: undefined,
    maskedDestination: recipient.upiId ? maskUpiId(recipient.upiId) : recipient.maskedDestination,
  };
}

function webSafeState(state: StoredState): StoredState {
  return {
    ...state,
    beneficiaries: state.beneficiaries.map(({ accountNumber: _accountNumber, upiId, ...item }) => ({
      ...item,
      upiId: upiId ? maskUpiId(upiId) : undefined,
    })),
    drafts: state.drafts.map(({ paymentMessage: _paymentMessage, privateNote: _privateNote, recipient, ...draft }) => ({
      ...draft,
      recipient: webSafeRecipient(recipient),
    })),
    quotes: state.quotes.map((quote) => ({ ...quote, recipient: webSafeRecipient(quote.recipient) })),
    attempts: state.attempts.map(({ paymentMessage: _paymentMessage, privateNote: _privateNote, recipient, ...attempt }) => ({
      ...attempt,
      recipient: webSafeRecipient(recipient),
    })),
    qrIntakes: [],
  };
}

function maskAccountNumber(accountNumber: string): string {
  return `•••• ${accountNumber.slice(-4)}`;
}

function sanitizeBeneficiary(item: StoredBeneficiary): Beneficiary {
  const { accountNumber: _accountNumber, ...safe } = item;
  return safe;
}

function bankNameForIfsc(ifsc: string): string | undefined {
  if (ifsc.startsWith("IBKL")) return "IDBI Bank";
  if (ifsc.startsWith("HDFC")) return "HDFC Bank";
  return undefined;
}

function validateIfsc(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) throw new Error("Enter a valid IFSC, for example IBKL0000123");
  return normalized;
}

function validateAccountNumber(value: string): string {
  const normalized = value.trim();
  if (!/^\d{6,24}$/.test(normalized)) throw new Error("Account number must contain 6 to 24 digits");
  return normalized;
}

function validateText(value: string | undefined, label: string, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (normalized && normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  if (normalized && /[\u0000-\u001F\u007F<>]/.test(normalized)) throw new Error(`${label} contains unsupported characters`);
  return normalized || undefined;
}

function snapshotFromStored(item: StoredBeneficiary): TransferRecipientSnapshot {
  const displayName = item.bankReturnedName ?? item.enteredName ?? item.nickname ?? "Recipient name unavailable";
  return {
    type: item.type,
    displayName,
    enteredName: item.enteredName,
    bankReturnedName: item.bankReturnedName,
    maskedDestination: item.type === "bank-account" ? item.maskedAccountNumber ?? "Account ending unavailable" : item.upiId ?? "UPI ID unavailable",
    bankName: item.bankName,
    ifsc: item.ifsc,
    upiId: item.upiId,
    beneficiaryId: item.id,
    resolutionStatus: item.resolutionStatus,
    lookupReference: item.lookupReference,
  };
}

function snapshotFromInput(input: BeneficiaryInput, lookupReference: string): { snapshot: TransferRecipientSnapshot; stored: StoredBeneficiary } {
  const timestamp = now();
  if (input.type === "bank-account") {
    const accountNumber = validateAccountNumber(input.accountNumber);
    const confirmation = validateAccountNumber(input.confirmAccountNumber);
    if (accountNumber !== confirmation) throw new Error("Account number and confirmation do not match");
    const ifsc = validateIfsc(input.ifsc);
    const enteredName = validateText(input.recipientName, "Recipient name", 120);
    if (!enteredName) throw new Error("Enter the recipient name returned or entered for review");
    const bankName = bankNameForIfsc(ifsc);
    const resolutionStatus: ResolutionStatus = bankName ? "resolved" : "unavailable";
    const stored: StoredBeneficiary = {
      id: id("beneficiary"),
      customerId: "",
      type: "bank-account",
      nickname: validateText(input.nickname, "Nickname", 40),
      bankReturnedName: bankName ? enteredName : undefined,
      enteredName,
      accountNumber,
      maskedAccountNumber: maskAccountNumber(accountNumber),
      ifsc,
      bankName,
      status: bankName ? "active" : "registration-pending",
      resolutionStatus,
      lookupReference: bankName ? lookupReference : undefined,
      lookupAt: bankName ? timestamp : undefined,
      registeredAt: bankName ? timestamp : undefined,
      revision: 1,
      sourceEnvironment: DEMO_SOURCE_LABEL,
      updatedAt: timestamp,
    };
    return { snapshot: snapshotFromStored(stored), stored };
  }

  const upiId = input.upiId.trim().toLowerCase();
  if (!isValidUpiId(upiId)) throw new Error("Enter a valid UPI ID such as name@bank");
  const recipientName = validateText(input.recipientName, "Recipient name", 120);
  const knownNames: Record<string, string> = {
    "success@demo": "Demo UPI Recipient",
    "pending@demo": "Demo Pending Recipient",
    "failed@demo": "Demo Failed Recipient",
    "unknown@demo": "Demo Status-Unknown Recipient",
    "return@demo": "Demo Return Recipient",
  };
  // The demo provider returns a deterministic display name for any valid UPI
  // address. Special demo aliases still make it possible to exercise pending,
  // failed, unknown, and returned result states without real payment traffic.
  const resolvedName = knownNames[upiId] ?? recipientName ?? upiId.split("@")[0];
  const stored: StoredBeneficiary = {
    id: id("beneficiary"),
    customerId: "",
    type: "upi",
    nickname: validateText(input.nickname, "Nickname", 40),
    bankReturnedName: resolvedName,
    enteredName: recipientName,
    upiId,
    status: resolvedName ? "active" : "registration-pending",
    resolutionStatus: resolvedName ? "resolved" : "unavailable",
    lookupReference: resolvedName ? lookupReference : undefined,
    lookupAt: resolvedName ? timestamp : undefined,
    registeredAt: resolvedName ? timestamp : undefined,
    revision: 1,
    sourceEnvironment: DEMO_SOURCE_LABEL,
    updatedAt: timestamp,
  };
  return { snapshot: snapshotFromStored(stored), stored };
}

function assertCustomer(recordCustomerId: string, customerId: string): void {
  if (recordCustomerId !== customerId) throw new Error("This transfer is not available for the signed-in customer");
}

async function eligibleAccounts(customerId: string): Promise<BankAccount[]> {
  const accounts = await getAccounts({ customerId });
  return accounts.filter((account) => account.status === "active" && ["savings", "current", "salary"].includes(account.type));
}

function accountSnapshot(account: BankAccount): Pick<BankAccount, "id" | "name" | "lastFour" | "type"> {
  return { id: account.id, name: account.name, lastFour: account.lastFour, type: account.type };
}

function methodOptions(destinationType: TransferDestinationType): TransferMethodOption[] {
  if (destinationType === "own-account") {
    return [{ method: "internal", label: "Internal transfer", description: "Move money between your eligible IDBI accounts.", available: true, estimatedProcessing: "Usually immediate in demo mode" }];
  }
  if (destinationType === "upi") {
    return [{ method: "upi", label: "UPI", description: "Use the validated UPI recipient details.", available: true, estimatedProcessing: "Demo result is deterministic" }];
  }
  return [
    { method: "within-bank", label: "Within IDBI Bank", description: "Transfer to an IDBI Bank beneficiary.", available: true, estimatedProcessing: "Demo result is deterministic" },
    { method: "imps", label: "IMPS", description: "Immediate payment service where supported.", available: true, estimatedProcessing: "Provider timing applies" },
    { method: "neft", label: "NEFT", description: "National electronic funds transfer.", available: true, estimatedProcessing: "Provider timing and processing windows apply" },
  ];
}

export function getTransferExecutionMode(): "demo" {
  return "demo";
}

export async function getEligibleTransferAccounts(customerId?: string | null): Promise<BankAccount[]> {
  return eligibleAccounts(customerScope(customerId));
}

export async function getTransferOptions(destinationType: TransferDestinationType, options?: { customerId?: string | null }): Promise<TransferOptions> {
  const customerId = customerScope(options?.customerId);
  const sources = await eligibleAccounts(customerId);
  return {
    destinationType,
    methods: methodOptions(destinationType),
    eligibleSourceAccounts: sources,
    eligibleOwnDestinationAccounts: destinationType === "own-account" ? sources : [],
    executionMode: "demo",
  };
}

export async function getBeneficiaries(options?: { customerId?: string | null; type?: "bank-account" | "upi" }): Promise<Beneficiary[]> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  return state.beneficiaries
    .filter((item) => item.status !== "archived" && (!options?.type || item.type === options.type))
    .map(sanitizeBeneficiary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createTransferQrIntake(parsed: ParsedPaymentQr, options?: { customerId?: string | null }): Promise<TransferQrIntake> {
  const customerId = customerScope(options?.customerId);
  const upiId = parsed.recipientAddress.trim().toLowerCase();
  if (!isValidUpiId(upiId)) throw new Error("The QR did not contain a valid UPI recipient");
  const timestamp = now();
  const intake: TransferQrIntake = {
    id: id("qr-intake"),
    customerId,
    upiId,
    recipientName: parsed.recipientLabel,
    amountMinorUnits: parsed.amountMinorUnits,
    paymentMessage: parsed.note,
    requestReference: parsed.requestReference,
    createdAt: timestamp,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS).toISOString(),
  };
  const state = await loadState(customerId);
  state.qrIntakes = [...state.qrIntakes.filter((item) => Date.parse(item.expiresAt) > Date.now()), intake];
  await saveState(customerId, state);
  return intake;
}

export async function getTransferQrIntake(intakeId: string, options?: { customerId?: string | null }): Promise<TransferQrIntake | undefined> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const intake = state.qrIntakes.find((item) => item.id === intakeId);
  if (!intake) return undefined;
  assertCustomer(intake.customerId, customerId);
  if (Date.parse(intake.expiresAt) <= Date.now()) throw new Error("This QR transfer intake expired. Scan the QR again.");
  return intake;
}

export async function getBeneficiary(beneficiaryId: string, options?: { customerId?: string | null }): Promise<Beneficiary | undefined> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const item = state.beneficiaries.find((candidate) => candidate.id === beneficiaryId && candidate.status !== "archived");
  return item ? sanitizeBeneficiary(item) : undefined;
}

export async function createBeneficiary(input: BeneficiaryInput, options?: { customerId?: string | null }): Promise<Beneficiary> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const result = snapshotFromInput(input, `LOOKUP-${id("demo").toUpperCase()}`);
  result.stored.customerId = customerId;
  state.beneficiaries = [...state.beneficiaries, result.stored];
  await saveState(customerId, state);
  return sanitizeBeneficiary(result.stored);
}

export async function updateBeneficiaryNickname(beneficiaryId: string, nickname: string, options?: { customerId?: string | null }): Promise<Beneficiary> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const index = state.beneficiaries.findIndex((item) => item.id === beneficiaryId && item.status !== "archived");
  if (index < 0) throw new Error("Beneficiary unavailable");
  const nextNickname = validateText(nickname, "Nickname", 40);
  state.beneficiaries[index] = { ...state.beneficiaries[index], nickname: nextNickname, revision: state.beneficiaries[index].revision + 1, updatedAt: now() };
  await saveState(customerId, state);
  return sanitizeBeneficiary(state.beneficiaries[index]);
}

export async function archiveBeneficiary(beneficiaryId: string, options?: { customerId?: string | null }): Promise<void> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const index = state.beneficiaries.findIndex((item) => item.id === beneficiaryId && item.status !== "archived");
  if (index < 0) throw new Error("Beneficiary unavailable");
  state.beneficiaries[index] = { ...state.beneficiaries[index], status: "archived", updatedAt: now(), revision: state.beneficiaries[index].revision + 1 };
  await saveState(customerId, state);
}

function resolveStoredBeneficiary(state: StoredState, beneficiaryId: string, customerId: string): StoredBeneficiary {
  const item = state.beneficiaries.find((candidate) => candidate.id === beneficiaryId && candidate.status !== "archived");
  if (!item) throw new Error("Beneficiary unavailable");
  assertCustomer(item.customerId, customerId);
  return item;
}

export async function createTransferDraft(input: {
  destinationType: TransferDestinationType;
  customerId?: string | null;
  sourceAccountId?: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
  recipientInput?: BeneficiaryInput;
  amountMinorUnits?: number;
  method?: TransferMethod;
  paymentMessage?: string;
  privateNote?: string;
}): Promise<TransferDraft> {
  const customerId = customerScope(input.customerId);
  const accounts = await eligibleAccounts(customerId);
  const sourceAccount = input.sourceAccountId ? accounts.find((account) => account.id === input.sourceAccountId) : accounts.find((account) => account.isPrimary) ?? accounts[0];
  if (!sourceAccount) throw new Error("No eligible funding account is available");
  const state = await loadState(customerId);
  let recipient: TransferRecipientSnapshot;
  let beneficiaryId = input.beneficiaryId;
  let destinationAccountId = input.destinationAccountId;

  if (input.destinationType === "own-account") {
    if (!destinationAccountId) throw new Error("Choose a destination account");
    const destination = accounts.find((account) => account.id === destinationAccountId);
    if (!destination) throw new Error("The destination account is not available to this customer");
    if (destination.id === sourceAccount.id) throw new Error("From and To accounts must be different");
    recipient = {
      type: "own-account",
      displayName: destination.nickname ?? destination.name,
      maskedDestination: `•••• ${destination.lastFour}`,
      resolutionStatus: "resolved",
    };
  } else if (input.beneficiaryId) {
    const stored = resolveStoredBeneficiary(state, input.beneficiaryId, customerId);
    if ((input.destinationType === "upi") !== (stored.type === "upi")) throw new Error("The selected beneficiary does not match this transfer type");
    recipient = snapshotFromStored(stored);
    beneficiaryId = stored.id;
  } else if (input.recipientInput) {
    const resolved = snapshotFromInput(input.recipientInput, `LOOKUP-${id("demo").toUpperCase()}`);
    recipient = resolved.snapshot;
    if (input.recipientInput.saveBeneficiary) {
      resolved.stored.customerId = customerId;
      state.beneficiaries = [...state.beneficiaries, resolved.stored];
      beneficiaryId = resolved.stored.id;
    }
  } else {
    throw new Error("Choose a recipient before continuing");
  }

  const paymentMessage = validateText(input.paymentMessage, "Payment message", MAX_MESSAGE_LENGTH);
  const privateNote = validateText(input.privateNote, "Private note", MAX_NOTE_LENGTH);
  const timestamp = now();
  const draft: TransferDraft = {
    id: id("draft"),
    customerId,
    destinationType: input.destinationType,
    method: input.method,
    sourceAccountId: sourceAccount.id,
    destinationAccountId,
    beneficiaryId,
    recipient,
    amountMinorUnits: input.amountMinorUnits,
    paymentMessage,
    privateNote,
    status: "editing",
    reviewRevision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS).toISOString(),
    sourceEnvironment: DEMO_SOURCE_LABEL,
  };
  state.drafts = [...state.drafts, draft];
  await saveState(customerId, state);
  return draft;
}

export async function updateTransferDraft(
  draftId: string,
  patch: Partial<Pick<TransferDraft, "sourceAccountId" | "destinationAccountId" | "amountMinorUnits" | "method" | "paymentMessage" | "privateNote">>,
  options?: { customerId?: string | null },
): Promise<TransferDraft> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const index = state.drafts.findIndex((item) => item.id === draftId);
  if (index < 0) throw new Error("Transfer draft unavailable");
  assertCustomer(state.drafts[index].customerId, customerId);
  const current = state.drafts[index];
  if (patch.sourceAccountId !== undefined) {
    const source = (await eligibleAccounts(customerId)).find((account) => account.id === patch.sourceAccountId);
    if (!source) throw new Error("Choose an eligible funding account");
  }
  if (patch.destinationAccountId !== undefined && current.destinationType === "own-account") {
    const accounts = await eligibleAccounts(customerId);
    const destination = accounts.find((account) => account.id === patch.destinationAccountId);
    if (!destination) throw new Error("Choose an eligible destination account");
    if (destination.id === (patch.sourceAccountId ?? current.sourceAccountId)) throw new Error("From and To accounts must be different");
    state.drafts[index] = { ...current, recipient: { ...current.recipient, displayName: destination.nickname ?? destination.name, maskedDestination: `•••• ${destination.lastFour}` }, destinationAccountId: patch.destinationAccountId, sourceAccountId: patch.sourceAccountId ?? current.sourceAccountId };
  }
  const next = {
    ...state.drafts[index],
    ...patch,
    paymentMessage: patch.paymentMessage === undefined ? state.drafts[index].paymentMessage : validateText(patch.paymentMessage, "Payment message", MAX_MESSAGE_LENGTH),
    privateNote: patch.privateNote === undefined ? state.drafts[index].privateNote : validateText(patch.privateNote, "Private note", MAX_NOTE_LENGTH),
    reviewRevision: current.reviewRevision + 1,
    status: "editing" as const,
    updatedAt: now(),
  };
  state.drafts[index] = next;
  await saveState(customerId, state);
  return next;
}

async function requireDraft(draftId: string, customerId: string): Promise<{ state: StoredState; draft: TransferDraft }> {
  const state = await loadState(customerId);
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error("Transfer draft unavailable");
  assertCustomer(draft.customerId, customerId);
  if (Date.parse(draft.expiresAt) <= Date.now()) throw new Error("This transfer draft expired. Start a new transfer.");
  return { state, draft };
}

function feeForMethod(method: TransferMethod): { feeMinorUnits: number; taxMinorUnits: number; timing: string } {
  switch (method) {
    case "imps": return { feeMinorUnits: 500, taxMinorUnits: 90, timing: "Provider timing applies; demo outcome is deterministic" };
    case "neft": return { feeMinorUnits: 250, taxMinorUnits: 45, timing: "Provider timing and processing windows apply" };
    case "within-bank": return { feeMinorUnits: 0, taxMinorUnits: 0, timing: "Demo result is deterministic" };
    case "internal": return { feeMinorUnits: 0, taxMinorUnits: 0, timing: "Usually immediate in demo mode" };
    default: return { feeMinorUnits: 0, taxMinorUnits: 0, timing: "Demo result is deterministic" };
  }
}

function allowedMethod(draft: TransferDraft, method: TransferMethod): boolean {
  return methodOptions(draft.destinationType).some((option) => option.method === method && option.available);
}

export async function quoteTransfer(draftId: string, options?: { customerId?: string | null }): Promise<TransferQuote> {
  const customerId = customerScope(options?.customerId);
  const { state, draft } = await requireDraft(draftId, customerId);
  const accounts = await eligibleAccounts(customerId);
  const source = accounts.find((account) => account.id === draft.sourceAccountId);
  if (!source) throw new Error("The selected funding account is no longer eligible");
  if (!draft.amountMinorUnits || !Number.isSafeInteger(draft.amountMinorUnits) || draft.amountMinorUnits <= 0) throw new Error("Enter a valid amount greater than zero");
  if (draft.amountMinorUnits > 100_000_000) throw new Error("The transfer amount exceeds the supported demo limit");
  const method = draft.method ?? (draft.destinationType === "own-account" ? "internal" : draft.destinationType === "upi" ? "upi" : "within-bank");
  if (!allowedMethod(draft, method)) throw new Error("The selected transfer method is unavailable");
  if (method === "within-bank" && draft.recipient.bankName && draft.recipient.bankName !== "IDBI Bank") {
    throw new Error("Within IDBI Bank transfer is unavailable for this recipient; choose IMPS or NEFT");
  }
  if (draft.destinationType === "own-account") {
    const destination = accounts.find((account) => account.id === draft.destinationAccountId);
    if (!destination || destination.id === source.id) throw new Error("Choose a different eligible destination account");
  } else if (draft.recipient.resolutionStatus !== "resolved") {
    throw new Error("Recipient lookup is unavailable. Verify the destination through an authorised provider before continuing.");
  } else if (draft.beneficiaryId) {
    const beneficiary = state.beneficiaries.find((item) => item.id === draft.beneficiaryId);
    if (!beneficiary || beneficiary.status !== "active") throw new Error("This beneficiary is not active yet. It cannot be used for a transfer.");
  }

  const charges = feeForMethod(method);
  const totalDebitMinorUnits = draft.amountMinorUnits + charges.feeMinorUnits + charges.taxMinorUnits;
  const available = source.availableBalanceMinorUnits;
  if (available !== undefined && totalDebitMinorUnits > available) throw new Error("The selected account does not have enough available balance");
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
  const quote: TransferQuote = {
    id: id("quote"),
    draftId,
    customerId,
    draftRevision: draft.reviewRevision,
    sourceAccount: accountSnapshot(source),
    recipient: draft.recipient,
    method,
    amountMinorUnits: draft.amountMinorUnits,
    feeMinorUnits: charges.feeMinorUnits,
    taxMinorUnits: charges.taxMinorUnits,
    totalDebitMinorUnits,
    currency: "INR",
    eligibility: "eligible",
    limitDescription: "Current available balance and demo method limits were checked for this quote.",
    estimatedProcessing: charges.timing,
    requiredAuthorisation: "demo-confirmation",
    expiresAt,
    sourceEnvironment: DEMO_SOURCE_LABEL,
  };
  state.quotes = [...state.quotes, quote];
  const draftIndex = state.drafts.findIndex((item) => item.id === draftId);
  state.drafts[draftIndex] = { ...draft, method, status: "ready-for-review", updatedAt: now() };
  await saveState(customerId, state);
  return quote;
}

export async function getTransferDraft(draftId: string, options?: { customerId?: string | null }): Promise<TransferDraft | undefined> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) return undefined;
  assertCustomer(draft.customerId, customerId);
  return draft;
}

function attemptFingerprint(draft: TransferDraft, quote: TransferQuote): string {
  return JSON.stringify({
    customerId: draft.customerId,
    draftId: draft.id,
    draftRevision: quote.draftRevision,
    sourceAccountId: quote.sourceAccount.id,
    destinationType: draft.destinationType,
    destinationAccountId: draft.destinationAccountId,
    beneficiaryId: draft.beneficiaryId,
    recipient: quote.recipient,
    amountMinorUnits: quote.amountMinorUnits,
    method: quote.method,
    feeMinorUnits: quote.feeMinorUnits ?? 0,
    taxMinorUnits: quote.taxMinorUnits ?? 0,
    paymentMessage: draft.paymentMessage ?? "",
  });
}

function outcomeForDraft(draft: TransferDraft): TransferAttemptStatus {
  const upi = draft.recipient.upiId?.toLowerCase();
  if (upi === "failed@demo") return "failed";
  if (upi === "pending@demo") return "pending";
  if (upi === "unknown@demo") return "status-unknown";
  if (upi === "return@demo") return "return-pending";
  return "succeeded";
}

async function updateStoredAttempt(customerId: string, state: StoredState, attempt: TransferAttempt): Promise<TransferAttempt> {
  state.attempts = state.attempts.map((item) => item.id === attempt.id ? attempt : item);
  await saveState(customerId, state);
  return attempt;
}

export async function executeTransfer(input: {
  draftId: string;
  quoteId: string;
  idempotencyKey: string;
  customerId?: string | null;
}): Promise<TransferAttempt> {
  const customerId = customerScope(input.customerId);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("A transfer confirmation key is required");
  const { state, draft } = await requireDraft(input.draftId, customerId);
  const quote = state.quotes.find((item) => item.id === input.quoteId && item.draftId === input.draftId);
  if (!quote) throw new Error("Transfer quote unavailable. Review the transfer again.");
  if (quote.customerId !== customerId || quote.draftRevision !== draft.reviewRevision) throw new Error("This review is stale. Review the latest transfer details again.");
  if (Date.parse(quote.expiresAt) <= Date.now()) throw new Error("This transfer quote expired. Review the transfer again.");
  const fingerprint = attemptFingerprint(draft, quote);
  const existing = state.attempts.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) throw new Error("This idempotency key was already used for different transfer details");
    return existing;
  }

  const timestamp = now();
  const attempt: TransferAttempt = {
    id: id("transfer"),
    customerId,
    draftId: draft.id,
    idempotencyKey,
    requestFingerprint: fingerprint,
    status: "submitting",
    destinationType: draft.destinationType,
    method: quote.method,
    recipient: quote.recipient,
    sourceAccount: quote.sourceAccount,
    amountMinorUnits: quote.amountMinorUnits,
    feeMinorUnits: quote.feeMinorUnits ?? 0,
    taxMinorUnits: quote.taxMinorUnits ?? 0,
    totalDebitMinorUnits: quote.totalDebitMinorUnits,
    paymentMessage: draft.paymentMessage,
    privateNote: draft.privateNote,
    internalReference: `DEMO-${id("ref").slice(-12).toUpperCase()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    statusChecks: 0,
    demoDisclosure: "Demo mode — no real money will be transferred.",
    sourceEnvironment: DEMO_SOURCE_LABEL,
  };
  state.attempts = [...state.attempts, attempt];
  await saveState(customerId, state);

  const outcome = outcomeForDraft(draft);
  if (outcome === "succeeded") {
    await recordDemoTransferLedger({
      transferId: attempt.id,
      customerId,
      sourceAccountId: quote.sourceAccount.id,
      destinationAccountId: draft.destinationType === "own-account" ? draft.destinationAccountId : undefined,
      amountMinorUnits: attempt.amountMinorUnits,
      feeMinorUnits: attempt.feeMinorUnits + attempt.taxMinorUnits,
      method: attempt.method,
      recipientLabel: attempt.recipient.displayName,
      internalReference: attempt.internalReference,
    });
  }
  return updateStoredAttempt(customerId, state, {
    ...attempt,
    status: outcome,
    updatedAt: now(),
    demoDisclosure: outcome === "succeeded" ? "Demo transfer completed — no real money was transferred." : "Demo mode — no real money will be transferred.",
    errorMessage: outcome === "failed" ? "The demo provider rejected this transfer." : undefined,
  });
}

export async function getTransfer(transferId: string, options?: { customerId?: string | null }): Promise<TransferAttempt | undefined> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const attempt = state.attempts.find((item) => item.id === transferId);
  if (!attempt) return undefined;
  assertCustomer(attempt.customerId, customerId);
  return attempt;
}

export async function checkTransferStatus(transferId: string, options?: { customerId?: string | null }): Promise<TransferAttempt> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const attempt = state.attempts.find((item) => item.id === transferId);
  if (!attempt) throw new Error("Transfer unavailable");
  assertCustomer(attempt.customerId, customerId);
  if (attempt.status === "submitting" || attempt.status === "accepted-processing") {
    return updateStoredAttempt(customerId, state, { ...attempt, status: "pending", updatedAt: now() });
  }
  if (!["pending", "status-unknown", "return-pending"].includes(attempt.status)) return attempt;
  const nextChecks = attempt.statusChecks + 1;
  if (attempt.status === "status-unknown" && nextChecks < 2) {
    return updateStoredAttempt(customerId, state, { ...attempt, statusChecks: nextChecks, updatedAt: now() });
  }
  if (attempt.status === "return-pending") {
    await recordDemoTransferLedger({
      transferId: attempt.id,
      customerId,
      sourceAccountId: attempt.sourceAccount.id,
      amountMinorUnits: attempt.amountMinorUnits,
      feeMinorUnits: attempt.feeMinorUnits + attempt.taxMinorUnits,
      method: attempt.method,
      recipientLabel: attempt.recipient.displayName,
      internalReference: attempt.internalReference,
      returned: true,
    });
    return updateStoredAttempt(customerId, state, { ...attempt, status: "returned", statusChecks: nextChecks, updatedAt: now() });
  }
  await recordDemoTransferLedger({
    transferId: attempt.id,
    customerId,
    sourceAccountId: attempt.sourceAccount.id,
    destinationAccountId: attempt.destinationType === "own-account" ? undefined : undefined,
    amountMinorUnits: attempt.amountMinorUnits,
    feeMinorUnits: attempt.feeMinorUnits + attempt.taxMinorUnits,
    method: attempt.method,
    recipientLabel: attempt.recipient.displayName,
    internalReference: attempt.internalReference,
  });
  return updateStoredAttempt(customerId, state, { ...attempt, status: "succeeded", statusChecks: nextChecks, updatedAt: now(), demoDisclosure: "Demo transfer completed — no real money was transferred." });
}

export async function getTransferHistory(options?: { customerId?: string | null; filters?: TransferHistoryFilters; page?: number; pageSize?: number }): Promise<TransferHistoryPage> {
  const customerId = customerScope(options?.customerId);
  const state = await loadState(customerId);
  const filters = options?.filters ?? {};
  const search = filters.search?.trim().toLocaleLowerCase() ?? "";
  const matching = state.attempts
    .filter((attempt) => {
      if (search && ![attempt.recipient.displayName, attempt.recipient.maskedDestination, attempt.recipient.upiId, attempt.internalReference].filter(Boolean).join(" ").toLocaleLowerCase().includes(search)) return false;
      if (filters.fromDate && attempt.createdAt.slice(0, 10) < filters.fromDate) return false;
      if (filters.toDate && attempt.createdAt.slice(0, 10) > filters.toDate) return false;
      if (filters.sourceAccountId && attempt.sourceAccount.id !== filters.sourceAccountId) return false;
      if (filters.method && filters.method !== "all" && attempt.method !== filters.method) return false;
      if (filters.status && filters.status !== "all" && attempt.status !== filters.status) return false;
      return true;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const pageSize = Math.min(20, Math.max(1, Math.floor(options?.pageSize ?? 8)));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(options?.page ?? 1)));
  return { items: matching.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: matching.length, totalPages };
}

export async function getRecentTransferRecipients(options?: { customerId?: string | null }): Promise<(TransferRecipientSnapshot & { lastUsedAt: string })[]> {
  const history = await getTransferHistory({ customerId: options?.customerId, pageSize: 50 });
  const seen = new Set<string>();
  return history.items.reduce<(TransferRecipientSnapshot & { lastUsedAt: string })[]>((result, attempt) => {
    const key = `${attempt.recipient.type}:${attempt.recipient.maskedDestination}:${attempt.recipient.upiId ?? ""}`;
    if (seen.has(key)) return result;
    seen.add(key);
    result.push({ ...attempt.recipient, lastUsedAt: attempt.createdAt });
    return result;
  }, []).slice(0, 5);
}

export function parseTransferAmount(value: string): number {
  return parseAmountToMinorUnits(value.trim());
}

export function formatTransferStatus(status: TransferAttempt["status"]): string {
  switch (status) {
    case "succeeded": return "Transfer confirmed";
    case "pending": return "Transfer pending";
    case "failed": return "Transfer unsuccessful";
    case "status-unknown": return "Transfer status not confirmed";
    case "return-pending": return "Return pending";
    case "returned": return "Return confirmed";
    case "accepted-processing": return "Transfer request submitted";
    default: return "Checking transfer status";
  }
}

export async function clearTransferServiceState(customerId?: string): Promise<void> {
  if (!customerId) {
    memory.clear();
    return;
  }
  const scope = customerScope(customerId);
  memory.delete(scope);
  try {
    await SecureStore.deleteItemAsync(stateKey(scope));
  } catch {
    // Best-effort cleanup for tests.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(stateKey(scope));
    } catch {
      // Best-effort cleanup for tests.
    }
  }
}
