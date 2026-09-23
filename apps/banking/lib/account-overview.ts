import type {
  AccountOverviewItem,
  AccountsOverview,
  AccountType,
  BankAccount,
} from "@/types/banking";

type SummaryAmounts = Omit<AccountsOverview["summary"], "accountCount">;

export type BuildAccountsOverviewOptions = {
  /** Use server-derived totals when present instead of recalculating them client-side. */
  summary?: SummaryAmounts;
  lastUpdated?: string | null;
  source?: string | null;
};

const transactionActions = ["transfer", "statement", "details"] as const;
const fixedDepositActions = ["maturity", "statement", "details"] as const;
const recurringDepositActions = ["schedule", "statement", "details"] as const;

function finiteMinorUnits(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function reportedLedgerMinorUnits(account: BankAccount): number | null {
  if (account.balanceDataAvailable === false) return null;
  return finiteMinorUnits(account.ledgerBalanceMinorUnits ?? account.balanceMinorUnits);
}

function fixedDepositCurrentValueMinorUnits(account: BankAccount): number | null {
  return finiteMinorUnits(account.fixedDeposit?.reportedCurrentValue?.minorUnits)
    ?? reportedLedgerMinorUnits(account);
}

function recurringDepositCurrentValueMinorUnits(account: BankAccount): number | null {
  return finiteMinorUnits(account.recurringDeposit?.reportedBalance.minorUnits)
    ?? reportedLedgerMinorUnits(account);
}

function typeLabel(type: AccountType): string {
  switch (type) {
    case "current":
      return "Current";
    case "salary":
      return "Salary";
    case "fixed-deposit":
      return "Fixed deposit";
    case "recurring-deposit":
      return "Recurring deposit";
    default:
      return "Savings";
  }
}

function commonOverviewFields(account: BankAccount) {
  return {
    account,
    id: account.id,
    displayName: account.nickname || account.name,
    typeLabel: typeLabel(account.type),
    lastFour: account.lastFour,
    isPrimary: account.isPrimary,
    status: account.status,
  };
}

/** Converts the generic service record into a product-specific presentation model. */
export function normalizeAccountOverviewItem(account: BankAccount): AccountOverviewItem {
  const common = commonOverviewFields(account);

  if (account.type === "fixed-deposit") {
    return {
      ...common,
      productKind: "fixed-deposit",
      type: "fixed-deposit",
      mainBalanceLabel: "Current value",
      mainBalanceMinorUnits: fixedDepositCurrentValueMinorUnits(account),
      principalMinorUnits: finiteMinorUnits(account.fixedDeposit?.principal.minorUnits),
      maturityValueMinorUnits: finiteMinorUnits(account.fixedDeposit?.maturityValue?.minorUnits),
      interestRate: account.fixedDeposit?.interestRate,
      maturityDate: account.fixedDeposit?.maturityDate ?? account.maturityDate,
      actions: fixedDepositActions,
    };
  }

  if (account.type === "recurring-deposit") {
    return {
      ...common,
      productKind: "recurring-deposit",
      type: "recurring-deposit",
      mainBalanceLabel: "Current value",
      mainBalanceMinorUnits: recurringDepositCurrentValueMinorUnits(account),
      monthlyContributionMinorUnits: finiteMinorUnits(
        account.recurringDeposit?.contributionAmount.minorUnits,
      ),
      contributionFrequency: account.recurringDeposit?.contributionFrequency,
      nextDepositDate: account.recurringDeposit?.nextContributionDate,
      maturityDate: account.recurringDeposit?.maturityDate ?? account.maturityDate,
      actions: recurringDepositActions,
    };
  }

  return {
    ...common,
    productKind: "transaction",
    type: account.type,
    mainBalanceLabel: "Available balance",
    // Available balance is not interchangeable with ledger balance. If the
    // source omits it, the UI must say unavailable rather than inventing zero.
    mainBalanceMinorUnits: account.balanceDataAvailable === false
      ? null
      : finiteMinorUnits(account.availableBalanceMinorUnits),
    currentBalanceMinorUnits: reportedLedgerMinorUnits(account),
    actions: transactionActions,
  };
}

function completeSum(values: readonly (number | null)[]): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}

function latestAccountUpdate(accounts: readonly BankAccount[]): string | null {
  const updates = accounts
    .map((account) => account.lastSuccessfulUpdate)
    .filter((value): value is string => Boolean(value))
    .sort();
  return updates.at(-1) ?? null;
}

function overviewSource(accounts: readonly BankAccount[]): string | null {
  const sources = [...new Set(accounts.map((account) => account.sourceEnvironment).filter(Boolean))];
  if (sources.length === 0) return null;
  return sources.length === 1 ? sources[0] : "Multiple linked sources";
}

/** Builds the canonical Accounts screen payload for demo or remote records. */
export function buildAccountsOverview(
  accounts: readonly BankAccount[],
  options: BuildAccountsOverviewOptions = {},
): AccountsOverview {
  const normalizedAccounts = accounts.map(normalizeAccountOverviewItem);
  const transactionBalances = normalizedAccounts
    .filter((account) => account.productKind === "transaction")
    .map((account) => account.mainBalanceMinorUnits);
  const depositBalances = normalizedAccounts
    .filter((account) => account.productKind !== "transaction")
    .map((account) => account.mainBalanceMinorUnits);
  const availableToSpendMinorUnits = completeSum(transactionBalances);
  const depositBalanceMinorUnits = completeSum(depositBalances);
  const derivedSummary: SummaryAmounts = {
    totalBalanceMinorUnits: completeSum([
      availableToSpendMinorUnits,
      depositBalanceMinorUnits,
    ]),
    availableToSpendMinorUnits,
    depositBalanceMinorUnits,
  };
  const hasLastUpdatedOverride = Object.prototype.hasOwnProperty.call(options, "lastUpdated");
  const hasSourceOverride = Object.prototype.hasOwnProperty.call(options, "source");

  return {
    summary: {
      ...(options.summary ?? derivedSummary),
      accountCount: normalizedAccounts.length,
    },
    accounts: normalizedAccounts,
    meta: {
      lastUpdated: hasLastUpdatedOverride
        ? options.lastUpdated ?? null
        : latestAccountUpdate(accounts),
      source: hasSourceOverride ? options.source ?? null : overviewSource(accounts),
    },
  };
}
