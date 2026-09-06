import type {
  AccountTransaction,
  BankAccount,
  FixedDepositDetails,
  RecurringDepositDetails,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
} from "@/types/banking";

/**
 * Fixed scenario date keeps the demo deterministic while making freshness
 * and date-range behaviour testable.
 */
export const DEMO_SCENARIO_DATE = "2026-09-06T12:00:00.000Z";
export const DEMO_SOURCE_LABEL = "Demo data" as const;
export const DEMO_CUSTOMER_A = "demo-customer-a";
export const DEMO_CUSTOMER_B = "demo-customer-b";

function inr(minorUnits: number) {
  return { minorUnits, currency: "INR" as const };
}

function makeAccount(
  input: Omit<BankAccount, "balance" | "balanceMinorUnits" | "currency" | "sourceEnvironment" | "lastSuccessfulUpdate" | "capabilities"> & {
    balanceMinorUnits: number;
    capabilities?: Partial<BankAccount["capabilities"]>;
  },
): BankAccount {
  return {
    ...input,
    balance: input.balanceMinorUnits / 100,
    currency: "INR",
    sourceEnvironment: DEMO_SOURCE_LABEL,
    lastSuccessfulUpdate: DEMO_SCENARIO_DATE,
    capabilities: {
      canSetPrimary: input.type === "savings" || input.type === "current",
      canManageCard: input.cardAvailable !== false,
      canExportTransactions: true,
      ...input.capabilities,
    },
  };
}

const savingsAccount = makeAccount({
  id: "savings-primary",
  name: "Savings Account",
  type: "savings",
  balanceMinorUnits: 10_000_000,
  availableBalance: 100_000,
  availableBalanceMinorUnits: 10_000_000,
  ledgerBalance: 101_250,
  ledgerBalanceMinorUnits: 10_125_000,
  lastFour: "1234",
  isPrimary: true,
  status: "active",
  cardAvailable: true,
  holderDisplayName: "Aarav Mehta",
  branch: "Andheri East",
  ifsc: "IBKL0000123",
  openingDate: "2021-04-16",
  ownershipMode: "Single holder",
  holdsMinorUnits: 125_000,
});

const currentAccount = makeAccount({
  id: "current-account",
  name: "Current Account",
  type: "current",
  balanceMinorUnits: 12_500_000,
  availableBalance: 125_000,
  availableBalanceMinorUnits: 12_500_000,
  ledgerBalance: 125_000,
  ledgerBalanceMinorUnits: 12_500_000,
  lastFour: "5678",
  isPrimary: false,
  status: "active",
  cardAvailable: true,
  holderDisplayName: "Aarav Mehta",
  branch: "Andheri East",
  ifsc: "IBKL0000123",
  openingDate: "2022-09-02",
  ownershipMode: "Single holder",
});

const fixedDepositDetails: FixedDepositDetails = {
  principal: inr(7_500_000),
  reportedCurrentValue: inr(7_575_000),
  startDate: "2025-06-12",
  maturityDate: "2027-06-12",
  maturityValue: inr(8_100_000),
};

const fixedDeposit = makeAccount({
  id: "fixed-deposit",
  name: "Fixed Deposit",
  type: "fixed-deposit",
  balanceMinorUnits: 7_500_000,
  lastFour: "9012",
  isPrimary: false,
  status: "active",
  cardAvailable: false,
  maturityDate: "2027-06-12",
  holderDisplayName: "Aarav Mehta",
  branch: "Andheri East",
  ifsc: "IBKL0000123",
  openingDate: "2025-06-12",
  ownershipMode: "Single holder",
  fixedDeposit: fixedDepositDetails,
});

const recurringDepositDetails: RecurringDepositDetails = {
  contributionAmount: inr(500_000),
  contributionFrequency: "Monthly",
  contributionsRecorded: 9,
  reportedBalance: inr(4_567_800),
  startDate: "2025-12-10",
  maturityDate: "2027-09-10",
  nextContributionDate: "2026-10-10",
};

const recurringDeposit = makeAccount({
  id: "recurring-deposit",
  name: "Recurring Deposit",
  type: "recurring-deposit",
  balanceMinorUnits: 4_567_800,
  lastFour: "3456",
  isPrimary: false,
  status: "active",
  cardAvailable: false,
  maturityDate: "2027-09-10",
  holderDisplayName: "Aarav Mehta",
  branch: "Andheri East",
  ifsc: "IBKL0000123",
  openingDate: "2025-12-10",
  ownershipMode: "Single holder",
  recurringDeposit: recurringDepositDetails,
});

/** Main synthetic customer: values match the existing Accounts overview. */
export const demoAccounts: BankAccount[] = [
  savingsAccount,
  currentAccount,
  fixedDeposit,
  recurringDeposit,
];

const customerBAccounts: BankAccount[] = [
  makeAccount({
    id: "customer-b-savings",
    name: "Savings Account",
    type: "savings",
    balanceMinorUnits: 2_250_000,
    availableBalance: 22_500,
    availableBalanceMinorUnits: 2_250_000,
    ledgerBalance: 22_500,
    ledgerBalanceMinorUnits: 2_250_000,
    lastFour: "7788",
    isPrimary: true,
    status: "active",
    cardAvailable: true,
    holderDisplayName: "Nisha Rao",
    branch: "Indiranagar",
    ifsc: "IBKL0000456",
    openingDate: "2023-01-20",
    ownershipMode: "Single holder",
  }),
];

type TransactionInput = {
  id: string;
  accountId: string;
  date: string;
  direction: TransactionDirection;
  amountMinorUnits: number;
  description: string;
  category: TransactionCategory;
  status?: TransactionStatus;
  counterparty?: string;
  channel?: AccountTransaction["channel"];
  reference?: string;
  transactionTime?: string;
  postedDate?: string;
  valueDate?: string;
  linkedTransactionId?: string;
};

function transaction(input: TransactionInput): AccountTransaction {
  return {
    id: input.id,
    sourceTransactionId: `demo-${input.id}`,
    accountId: input.accountId,
    amountMinorUnits: input.amountMinorUnits,
    currency: "INR",
    direction: input.direction,
    status: input.status ?? "posted",
    transactionDate: input.date,
    postedDate: input.postedDate ?? (input.status === "pending" ? undefined : input.date),
    valueDate: input.valueDate ?? input.date,
    transactionTime: input.transactionTime,
    counterparty: input.counterparty,
    description: input.description,
    bankDescription: input.description,
    channel: input.channel,
    originalCategory: input.category,
    reference: input.reference ?? `DEMO${input.id.replace(/[^0-9]/g, "").slice(-8)}`,
    linkedTransactionId: input.linkedTransactionId,
    sourceEnvironment: DEMO_SOURCE_LABEL,
  };
}

const savingsTransactions: AccountTransaction[] = [
  transaction({ id: "sav-20260901-salary", accountId: savingsAccount.id, date: "2026-09-01", direction: "credit", amountMinorUnits: 85_000_00, description: "Salary credit", counterparty: "Acme Technologies", category: "salary", channel: "NEFT", reference: "SAL20260901", transactionTime: "09:00" }),
  transaction({ id: "sav-20260902-rent", accountId: savingsAccount.id, date: "2026-09-02", direction: "debit", amountMinorUnits: 28_000_00, description: "Monthly rent transfer", counterparty: "Rohan Shah", category: "transfer", channel: "NEFT", reference: "RENT20260902", transactionTime: "10:14" }),
  transaction({ id: "sav-20260903-dining-1", accountId: savingsAccount.id, date: "2026-09-03", direction: "debit", amountMinorUnits: 6_000_00, description: "Restaurant dinner", counterparty: "Cedar Table", category: "food", channel: "UPI", reference: "UPI2026090301", transactionTime: "20:15" }),
  transaction({ id: "sav-20260905-dining-2", accountId: savingsAccount.id, date: "2026-09-05", direction: "debit", amountMinorUnits: 4_500_00, description: "Food delivery", counterparty: "QuickBite", category: "food", channel: "UPI", reference: "UPI2026090502", transactionTime: "21:08" }),
  transaction({ id: "sav-20260906-dining-3", accountId: savingsAccount.id, date: "2026-09-06", direction: "debit", amountMinorUnits: 4_500_00, description: "Weekend brunch", counterparty: "The Green Fork", category: "food", channel: "Card", reference: "CARD2026090603", transactionTime: "11:42" }),
  transaction({ id: "sav-20260803-dining-1", accountId: savingsAccount.id, date: "2026-08-03", direction: "debit", amountMinorUnits: 4_000_00, description: "Restaurant dinner", counterparty: "Cedar Table", category: "food", channel: "UPI", reference: "UPI2026080301", transactionTime: "20:22" }),
  transaction({ id: "sav-20260815-dining-2", accountId: savingsAccount.id, date: "2026-08-15", direction: "debit", amountMinorUnits: 3_000_00, description: "Food delivery", counterparty: "QuickBite", category: "food", channel: "UPI", reference: "UPI2026081502", transactionTime: "21:17" }),
  transaction({ id: "sav-20260824-dining-3", accountId: savingsAccount.id, date: "2026-08-24", direction: "debit", amountMinorUnits: 5_000_00, description: "Family lunch", counterparty: "The Green Fork", category: "food", channel: "Card", reference: "CARD2026082403", transactionTime: "13:02" }),
  transaction({ id: "sav-20260828-grocery", accountId: savingsAccount.id, date: "2026-08-28", direction: "debit", amountMinorUnits: 2_350_00, description: "Fresh Basket purchase", counterparty: "Fresh Basket", category: "shopping", channel: "UPI", reference: "UPI2026082801", transactionTime: "18:42" }),
  transaction({ id: "sav-20260820-utility", accountId: savingsAccount.id, date: "2026-08-20", direction: "debit", amountMinorUnits: 1_650_00, description: "Electricity bill", counterparty: "MSEDCL", category: "bill", channel: "UPI", reference: "BILL20260820", transactionTime: "08:25" }),
  transaction({ id: "sav-20260814-refund", accountId: savingsAccount.id, date: "2026-08-14", direction: "credit", amountMinorUnits: 1_240_00, description: "Refund - online purchase", counterparty: "Amazon India", category: "refund", channel: "Card", reference: "REF20260814", linkedTransactionId: "sav-20260810-amazon", transactionTime: "14:20" }),
  transaction({ id: "sav-20260810-amazon", accountId: savingsAccount.id, date: "2026-08-10", direction: "debit", amountMinorUnits: 1_240_00, description: "Online purchase", counterparty: "Amazon India", category: "shopping", channel: "Card", reference: "CARD20260810", linkedTransactionId: "sav-20260814-refund", transactionTime: "10:24" }),
  transaction({ id: "sav-20260807-upi-pending", accountId: savingsAccount.id, date: "2026-08-07", direction: "debit", amountMinorUnits: 780_00, description: "UPI payment pending", counterparty: "Cafe Coffee Day", category: "food", channel: "UPI", status: "pending", reference: "UPI2026080707", transactionTime: "13:04" }),
  transaction({ id: "sav-20260805-failed", accountId: savingsAccount.id, date: "2026-08-05", direction: "debit", amountMinorUnits: 5_000_00, description: "Transfer failed", counterparty: "Vikram Mehta", category: "transfer", channel: "IMPS", status: "failed", reference: "IMPS2026080505", transactionTime: "16:11" }),
  transaction({ id: "sav-20260731-interest", accountId: savingsAccount.id, date: "2026-07-31", direction: "credit", amountMinorUnits: 425_00, description: "Savings interest", counterparty: "IDBI Bank", category: "interest", channel: "Branch", reference: "INT20260731" }),
  transaction({ id: "sav-20260716-grocer", accountId: savingsAccount.id, date: "2026-07-16", direction: "debit", amountMinorUnits: 3_750_00, description: "Household shopping", counterparty: "Nature's Basket", category: "shopping", channel: "Card", reference: "CARD20260716" }),
  transaction({ id: "sav-20260630-salary", accountId: savingsAccount.id, date: "2026-06-30", direction: "credit", amountMinorUnits: 85_000_00, description: "Salary credit", counterparty: "Acme Technologies", category: "salary", channel: "NEFT", reference: "SAL20260630" }),
  transaction({ id: "sav-20260618-mobile", accountId: savingsAccount.id, date: "2026-06-18", direction: "debit", amountMinorUnits: 899_00, description: "Mobile bill payment", counterparty: "Jio", category: "bill", channel: "UPI", reference: "BILL20260618" }),
];

const currentTransactions: AccountTransaction[] = [
  transaction({ id: "cur-20260903-invoice", accountId: currentAccount.id, date: "2026-09-03", direction: "credit", amountMinorUnits: 125_000_00, description: "Invoice settlement", counterparty: "Northstar Retail Pvt Ltd", category: "other", channel: "NEFT", reference: "INV20260903" }),
  transaction({ id: "cur-20260902-vendor", accountId: currentAccount.id, date: "2026-09-02", direction: "debit", amountMinorUnits: 44_500_00, description: "Vendor payment", counterparty: "Meridian Supplies", category: "transfer", channel: "NEFT", reference: "VEN20260902" }),
  transaction({ id: "cur-20260826-office", accountId: currentAccount.id, date: "2026-08-26", direction: "debit", amountMinorUnits: 8_250_00, description: "Office utilities", counterparty: "Tata Power", category: "bill", channel: "Standing instruction", reference: "UTIL20260826" }),
  transaction({ id: "cur-20260812-cash", accountId: currentAccount.id, date: "2026-08-12", direction: "debit", amountMinorUnits: 10_000_00, description: "Cash withdrawal", counterparty: "IDBI Bank ATM", category: "cash", channel: "ATM", reference: "ATM20260812" }),
  transaction({ id: "cur-20260801-invoice", accountId: currentAccount.id, date: "2026-08-01", direction: "credit", amountMinorUnits: 92_000_00, description: "Invoice settlement", counterparty: "Harbor Foods", category: "other", channel: "NEFT", reference: "INV20260801" }),
  transaction({ id: "cur-20260722-upi", accountId: currentAccount.id, date: "2026-07-22", direction: "debit", amountMinorUnits: 2_450_00, description: "Business purchase", counterparty: "Metro Office Mart", category: "shopping", channel: "UPI", reference: "UPI20260722" }),
  transaction({ id: "cur-20260630-invoice", accountId: currentAccount.id, date: "2026-06-30", direction: "credit", amountMinorUnits: 110_000_00, description: "Invoice settlement", counterparty: "Northstar Retail Pvt Ltd", category: "other", channel: "NEFT", reference: "INV20260630" }),
  transaction({ id: "cur-20260618-vendor", accountId: currentAccount.id, date: "2026-06-18", direction: "debit", amountMinorUnits: 32_000_00, description: "Vendor payment", counterparty: "Meridian Supplies", category: "transfer", channel: "IMPS", reference: "VEN20260618" }),
];

const fixedDepositTransactions: AccountTransaction[] = [
  transaction({ id: "fd-20250612-open", accountId: fixedDeposit.id, date: "2025-06-12", direction: "debit", amountMinorUnits: 7_500_000, description: "Fixed deposit principal", counterparty: "IDBI Bank", category: "deposit", channel: "Branch", reference: "FD20250612" }),
  transaction({ id: "fd-20260612-anniversary", accountId: fixedDeposit.id, date: "2026-06-12", direction: "credit", amountMinorUnits: 75_000, description: "Reported deposit accrual", counterparty: "IDBI Bank", category: "interest", channel: "Branch", reference: "FDINT20260612" }),
];

const recurringDepositTransactions: AccountTransaction[] = [
  transaction({ id: "rd-20260910-contribution", accountId: recurringDeposit.id, date: "2026-09-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", status: "pending", reference: "RD20260910" }),
  transaction({ id: "rd-20260810-contribution", accountId: recurringDeposit.id, date: "2026-08-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260810" }),
  transaction({ id: "rd-20260710-contribution", accountId: recurringDeposit.id, date: "2026-07-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260710" }),
  transaction({ id: "rd-20260610-contribution", accountId: recurringDeposit.id, date: "2026-06-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260610" }),
  transaction({ id: "rd-20260510-contribution", accountId: recurringDeposit.id, date: "2026-05-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260510" }),
  transaction({ id: "rd-20260410-contribution", accountId: recurringDeposit.id, date: "2026-04-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260410" }),
  transaction({ id: "rd-20260310-contribution", accountId: recurringDeposit.id, date: "2026-03-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260310" }),
  transaction({ id: "rd-20260210-contribution", accountId: recurringDeposit.id, date: "2026-02-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260210" }),
  transaction({ id: "rd-20260110-contribution", accountId: recurringDeposit.id, date: "2026-01-10", direction: "debit", amountMinorUnits: 500_000, description: "Recurring deposit contribution", counterparty: "IDBI Bank", category: "deposit", channel: "Standing instruction", reference: "RD20260110" }),
];

const customerBTransactions: AccountTransaction[] = [
  transaction({ id: "b-sav-20260901-salary", accountId: customerBAccounts[0].id, date: "2026-09-01", direction: "credit", amountMinorUnits: 45_000_00, description: "Salary credit", counterparty: "Bluebell Studio", category: "salary", channel: "NEFT", reference: "BSAL20260901" }),
];

export const demoTransactions: AccountTransaction[] = [
  ...savingsTransactions,
  ...currentTransactions,
  ...fixedDepositTransactions,
  ...recurringDepositTransactions,
];

export const demoCustomerFixtures: Record<
  string,
  { accounts: BankAccount[]; transactions: AccountTransaction[] }
> = {
  [DEMO_CUSTOMER_A]: { accounts: demoAccounts, transactions: demoTransactions },
  [DEMO_CUSTOMER_B]: { accounts: customerBAccounts, transactions: customerBTransactions },
};

/** Explicit test/demo seed entry point. A future API can replace this adapter. */
export function getDemoCustomerFixture(customerId: string) {
  return demoCustomerFixtures[customerId] ?? demoCustomerFixtures[DEMO_CUSTOMER_A];
}

export function getDemoAccount(accountId: string, customerId = DEMO_CUSTOMER_A) {
  return getDemoCustomerFixture(customerId).accounts.find((account) => account.id === accountId);
}
