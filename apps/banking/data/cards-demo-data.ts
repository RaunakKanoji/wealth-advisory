import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B, DEMO_SCENARIO_DATE, DEMO_SOURCE_LABEL } from "@/data/accounts-demo-data";
import type {
  CardCapabilitySet,
  CardControl,
  CardLimit,
  CardRecord,
  CardTransaction,
  CreditFacilitySummary,
} from "@/types/cards";

const activeCapabilities: CardCapabilitySet = {
  canTemporarilyDisable: true,
  canReenable: true,
  canManageDomesticUsage: true,
  canManageInternationalUsage: true,
  canManageLimits: true,
  canHotlist: true,
  canRequestReplacement: true,
  canViewStatements: false,
};

const virtualCapabilities: CardCapabilitySet = {
  canTemporarilyDisable: true,
  canReenable: true,
  canManageDomesticUsage: true,
  canManageInternationalUsage: false,
  canManageLimits: true,
  canHotlist: true,
  canRequestReplacement: false,
  canViewStatements: false,
};

const creditCapabilities: CardCapabilitySet = {
  canTemporarilyDisable: true,
  canReenable: true,
  canManageDomesticUsage: true,
  canManageInternationalUsage: true,
  canManageLimits: true,
  canHotlist: true,
  canRequestReplacement: false,
  canViewStatements: true,
};

function controls(
  enabledChannels: `${"domestic" | "international"}:${"atm" | "in-store" | "online" | "contactless"}`[],
): CardControl[] {
  const groups = ["domestic", "international"] as const;
  const channels = ["atm", "in-store", "online", "contactless"] as const;

  return groups.flatMap((group) => channels.map((channel) => {
    const supported = enabledChannels.includes(`${group}:${channel}`);
    return {
      group,
      channel,
      state: supported ? "enabled" : "disabled",
      supported,
      unavailableReason: supported ? undefined : `${channel === "in-store" ? "In-store" : channel} use is not supported for this card`,
    } satisfies CardControl;
  }));
}

function limit(
  id: string,
  label: string,
  group: CardLimit["group"],
  channel: CardLimit["channel"],
  amountMinorUnits: number,
  maximumMinorUnits: number,
  period: CardLimit["period"] = "daily",
): CardLimit {
  return {
    id,
    label,
    group,
    channel,
    period,
    amountMinorUnits,
    maximumMinorUnits,
    currency: "INR",
    resetTimeZone: "Asia/Kolkata",
  };
}

const debitLimits: CardLimit[] = [
  limit("domestic-atm-daily", "ATM withdrawals", "domestic", "atm", 40_000_00, 100_000_00),
  limit("domestic-purchase-daily", "In-store purchases", "domestic", "in-store", 100_000_00, 200_000_00),
  limit("domestic-online-daily", "Online purchases", "domestic", "online", 75_000_00, 150_000_00),
  limit("international-purchase-daily", "International purchases", "international", "in-store", 50_000_00, 100_000_00),
];

const virtualLimits: CardLimit[] = [
  limit("domestic-online-daily", "Online purchases", "domestic", "online", 50_000_00, 100_000_00),
];

const creditLimits: CardLimit[] = [
  limit("domestic-purchase-daily", "In-store purchases", "domestic", "in-store", 75_000_00, 150_000_00),
  limit("domestic-online-daily", "Online purchases", "domestic", "online", 50_000_00, 100_000_00),
  limit("international-purchase-daily", "International purchases", "international", "in-store", 40_000_00, 80_000_00),
];

const creditFacility: CreditFacilitySummary = {
  id: "credit-facility-demo-a",
  facilityLabel: "Demo credit facility",
  currentOutstandingMinorUnits: 18_450_00,
  availableCreditMinorUnits: 81_550_00,
  approvedCreditLimitMinorUnits: 100_000_00,
  statementTotalDueMinorUnits: 6_240_00,
  minimumAmountDueMinorUnits: 1_250_00,
  paymentDueDate: "2026-09-18",
  statementPeriod: "20 Aug – 19 Sep 2026",
  paymentStatus: "due",
};

function card(input: Omit<CardRecord, "sourceEnvironment" | "lastSuccessfulUpdate" | "sourceRevision">): CardRecord {
  return {
    ...input,
    sourceEnvironment: DEMO_SOURCE_LABEL,
    sourceRevision: 1,
    lastSuccessfulUpdate: DEMO_SCENARIO_DATE,
  };
}

export const demoCardsCustomerA: CardRecord[] = [
  card({
    id: "card-debit-primary",
    providerReference: "demo-card-debit-primary-a",
    productKind: "debit",
    formFactor: "physical",
    productName: "Classic Debit Card",
    lastFour: "4321",
    holderDisplayName: "Aarav Mehta",
    expiryMonth: 11,
    expiryYear: 2029,
    network: "Visa",
    linkedAccountId: "savings-primary",
    lifecycleStatus: "active",
    capabilities: activeCapabilities,
    controls: controls([
      "domestic:atm",
      "domestic:in-store",
      "domestic:online",
      "domestic:contactless",
      "international:atm",
      "international:in-store",
      "international:online",
    ]),
    limits: debitLimits,
    demoControlOutcome: "applied",
  }),
  card({
    id: "card-debit-virtual",
    providerReference: "demo-card-virtual-debit-a",
    productKind: "debit",
    formFactor: "virtual",
    productName: "Virtual Debit Card",
    lastFour: "9087",
    holderDisplayName: "Aarav Mehta",
    expiryMonth: 4,
    expiryYear: 2028,
    network: "Visa",
    linkedAccountId: "savings-primary",
    lifecycleStatus: "active",
    capabilities: virtualCapabilities,
    controls: controls(["domestic:online"]),
    limits: virtualLimits,
    demoControlOutcome: "pending",
  }),
  card({
    id: "card-credit-demo",
    providerReference: "demo-card-credit-a",
    productKind: "credit",
    formFactor: "physical",
    productName: "Demo Credit Card",
    lastFour: "2468",
    holderDisplayName: "Aarav Mehta",
    expiryMonth: 8,
    expiryYear: 2030,
    network: "Mastercard",
    linkedCreditFacilityId: creditFacility.id,
    lifecycleStatus: "active",
    capabilities: creditCapabilities,
    controls: controls([
      "domestic:in-store",
      "domestic:online",
      "domestic:contactless",
      "international:in-store",
      "international:online",
    ]),
    limits: creditLimits,
    creditFacility,
    demoControlOutcome: "applied",
  }),
  card({
    id: "card-expired-demo",
    providerReference: "demo-card-expired-a",
    productKind: "debit",
    formFactor: "physical",
    productName: "Expired Debit Card",
    lastFour: "1357",
    holderDisplayName: "Aarav Mehta",
    expiryMonth: 2,
    expiryYear: 2024,
    linkedAccountId: "current-account",
    lifecycleStatus: "expired",
    capabilities: {
      canTemporarilyDisable: false,
      canReenable: false,
      canManageDomesticUsage: false,
      canManageInternationalUsage: false,
      canManageLimits: false,
      canHotlist: false,
      canRequestReplacement: false,
      canViewStatements: false,
    },
    controls: controls([]),
    limits: [],
    demoControlOutcome: "rejected",
  }),
];

export const demoCardsCustomerB: CardRecord[] = [
  card({
    id: "card-debit-customer-b",
    providerReference: "demo-card-debit-b",
    productKind: "debit",
    formFactor: "physical",
    productName: "Classic Debit Card",
    lastFour: "4321",
    holderDisplayName: "Nisha Rao",
    expiryMonth: 6,
    expiryYear: 2028,
    network: "Visa",
    linkedAccountId: "customer-b-savings",
    lifecycleStatus: "active",
    capabilities: activeCapabilities,
    controls: controls(["domestic:atm", "domestic:in-store", "domestic:online"]),
    limits: debitLimits,
    demoControlOutcome: "applied",
  }),
];

function transaction(input: Omit<CardTransaction, "sourceEnvironment">): CardTransaction {
  return { ...input, sourceEnvironment: DEMO_SOURCE_LABEL };
}

export const demoCardTransactions: CardTransaction[] = [
  transaction({
    id: "card-a-coffee-pending",
    sourceTransactionId: "card-source-coffee-20260904",
    cardId: "card-debit-primary",
    description: "Pending authorisation",
    merchant: "Cafe Coffee Day",
    amountMinorUnits: 780_00,
    currency: "INR",
    direction: "debit",
    status: "pending",
    transactionDate: "2026-09-04",
    transactionTime: "13:04",
    category: "food",
    channel: "in-store",
    transactionType: "authorisation",
    reference: "AUTH2026090401",
    associationKey: "coffee-20260904",
  }),
  transaction({
    id: "card-a-grocery",
    sourceTransactionId: "card-source-grocery-20260828",
    cardId: "card-debit-primary",
    description: "Grocery purchase",
    merchant: "Fresh Basket",
    amountMinorUnits: 2_350_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-08-28",
    postedDate: "2026-08-28",
    transactionTime: "18:42",
    category: "shopping",
    channel: "in-store",
    transactionType: "purchase",
    reference: "CARD2026082801",
  }),
  transaction({
    id: "card-a-amazon-auth",
    sourceTransactionId: "card-source-amazon-20260810",
    cardId: "card-debit-primary",
    description: "Online purchase authorisation",
    merchant: "Amazon India",
    amountMinorUnits: 1_240_00,
    currency: "INR",
    direction: "debit",
    status: "pending",
    transactionDate: "2026-08-10",
    transactionTime: "10:24",
    category: "shopping",
    channel: "online",
    transactionType: "authorisation",
    reference: "AUTH2026081001",
    associationKey: "amazon-20260810",
  }),
  transaction({
    id: "card-a-amazon-settled",
    sourceTransactionId: "card-source-amazon-20260810",
    cardId: "card-debit-primary",
    description: "Online purchase",
    merchant: "Amazon India",
    amountMinorUnits: 1_240_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-08-11",
    postedDate: "2026-08-11",
    transactionTime: "08:10",
    category: "shopping",
    channel: "online",
    transactionType: "purchase",
    reference: "CARD2026081001",
    associationKey: "amazon-20260810",
  }),
  transaction({
    id: "card-a-atm",
    sourceTransactionId: "card-source-atm-20260806",
    cardId: "card-debit-primary",
    description: "Cash withdrawal",
    merchant: "IDBI Bank ATM",
    amountMinorUnits: 5_000_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-08-06",
    postedDate: "2026-08-06",
    transactionTime: "16:11",
    category: "cash",
    channel: "atm",
    transactionType: "cash-withdrawal",
    reference: "ATM2026080601",
  }),
  transaction({
    id: "card-a-refund",
    sourceTransactionId: "card-source-amazon-refund-20260814",
    cardId: "card-debit-primary",
    description: "Refund for online purchase",
    merchant: "Amazon India",
    amountMinorUnits: 1_240_00,
    currency: "INR",
    direction: "credit",
    status: "posted",
    transactionDate: "2026-08-14",
    postedDate: "2026-08-14",
    transactionTime: "14:20",
    category: "refund",
    channel: "online",
    transactionType: "refund",
    reference: "REF2026081401",
    linkedTransactionId: "card-a-amazon-settled",
  }),
  transaction({
    id: "card-a-virtual-subscription",
    sourceTransactionId: "card-source-virtual-20260802",
    cardId: "card-debit-virtual",
    description: "Streaming subscription",
    merchant: "StreamBox",
    amountMinorUnits: 799_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-08-02",
    postedDate: "2026-08-02",
    category: "other",
    channel: "online",
    transactionType: "purchase",
    reference: "CARD2026080201",
  }),
  transaction({
    id: "card-a-credit-purchase",
    sourceTransactionId: "card-source-credit-20260901",
    cardId: "card-credit-demo",
    facilityId: creditFacility.id,
    description: "Retail purchase",
    merchant: "Croma",
    amountMinorUnits: 12_400_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-09-01",
    postedDate: "2026-09-01",
    category: "shopping",
    channel: "in-store",
    transactionType: "purchase",
    reference: "CC2026090101",
  }),
  transaction({
    id: "card-a-credit-fee",
    sourceTransactionId: "card-source-fee-20260820",
    cardId: "card-credit-demo",
    facilityId: creditFacility.id,
    description: "Foreign transaction fee",
    merchant: "Card issuer",
    amountMinorUnits: 320_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-08-20",
    postedDate: "2026-08-20",
    category: "other",
    channel: "online",
    transactionType: "fee",
    reference: "FEE2026082001",
  }),
  transaction({
    id: "card-a-credit-repayment",
    sourceTransactionId: "card-source-repayment-20260819",
    cardId: "card-credit-demo",
    facilityId: creditFacility.id,
    description: "Credit card bill repayment",
    merchant: "IDBI Bank",
    amountMinorUnits: 8_000_00,
    currency: "INR",
    direction: "credit",
    status: "posted",
    transactionDate: "2026-08-19",
    postedDate: "2026-08-19",
    category: "transfer",
    channel: "online",
    transactionType: "repayment",
    reference: "PAY2026081901",
  }),
  transaction({
    id: "card-b-grocery",
    sourceTransactionId: "card-source-b-grocery-20260902",
    cardId: "card-debit-customer-b",
    description: "Grocery purchase",
    merchant: "Green Grocers",
    amountMinorUnits: 1_890_00,
    currency: "INR",
    direction: "debit",
    status: "posted",
    transactionDate: "2026-09-02",
    postedDate: "2026-09-02",
    category: "shopping",
    channel: "in-store",
    transactionType: "purchase",
    reference: "CARD-B-2026090201",
  }),
];

export const demoCardFixtures: Record<string, CardRecord[]> = {
  [DEMO_CUSTOMER_A]: demoCardsCustomerA,
  [DEMO_CUSTOMER_B]: demoCardsCustomerB,
};

export function getDemoCards(customerId: string): CardRecord[] {
  return demoCardFixtures[customerId] ?? demoCardFixtures[DEMO_CUSTOMER_A];
}

export function getDemoCardTransactions(customerId: string): CardTransaction[] {
  const cardIds = new Set(getDemoCards(customerId).map((item) => item.id));
  return demoCardTransactions.filter((item) => cardIds.has(item.cardId));
}
