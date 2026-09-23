import type { ApiAccount, ApiBeneficiary, ApiCard, ApiCardTransaction, ApiGoal, ApiInsight, ApiRecommendation, ApiTransaction, ApiTransfer, AccountsResponse, WealthSummaryResponse } from "./types";
import type { AccountsOverview, BankAccount, BankingActivity, TransactionCategory, TransactionStatus, WealthInsight } from "@/types/banking";
import type { CoachRecommendation, FinancialGoal, FinancialMetric, WealthCoachDashboard, WealthInsight as CoachWealthInsight } from "@/types/wealth-coach";
import type { Beneficiary, TransferAttempt } from "@/types/transfers";
import type { CardControl, CardLimit, CardProductKind, CardRecord, CardTransaction, CardTransactionPage, NormalizedCardTransactionFilters } from "@/types/cards";
import { buildAccountsOverview } from "@/lib/account-overview";
import { formatINR } from "@/lib/currency";

export function parseApiMoneyToMinorUnits(value: string): number {
  const parsed = parseOptionalApiMoneyToMinorUnits(value);
  if (parsed === null) throw new Error("Invalid API money amount");
  return parsed;
}

/** Preserves unavailable API money while keeping a genuine zero numeric. */
export function parseOptionalApiMoneyToMinorUnits(
  value: string | null | undefined,
): number | null {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null;

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const exact = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const signed = negative ? -exact : exact;
  const numeric = Number(signed);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

export function apiAccountToBankAccount(account: ApiAccount): BankAccount {
  const balanceMinorUnits = parseApiMoneyToMinorUnits(account.ledgerBalance);
  // The current backend emits numeric zeroes when an account has no balance
  // row. `asOf` is non-null for every real balance snapshot, so preserve that
  // distinction for presentation instead of displaying a fabricated ₹0.00.
  const balanceDataAvailable = account.asOf !== null;
  const type = account.type === "fixed_deposit"
    ? "fixed-deposit"
    : account.type === "recurring_deposit"
      ? "recurring-deposit"
      : account.type === "current"
        ? "current"
        : "savings";
  const isDeposit = type === "fixed-deposit" || type === "recurring-deposit";
  const reportedAvailableBalanceMinorUnits = parseOptionalApiMoneyToMinorUnits(
    account.availableBalance,
  );
  const availableBalanceMinorUnits = isDeposit || !balanceDataAvailable
    ? null
    : reportedAvailableBalanceMinorUnits;
  const holdsMinorUnits = parseOptionalApiMoneyToMinorUnits(account.holds);
  return {
    id: account.id,
    name: account.name ?? account.nickname,
    nickname: account.nickname,
    type,
    balance: balanceMinorUnits / 100,
    balanceMinorUnits,
    balanceDataAvailable,
    availableBalance: availableBalanceMinorUnits === null
      ? undefined
      : availableBalanceMinorUnits / 100,
    availableBalanceMinorUnits: availableBalanceMinorUnits ?? undefined,
    ledgerBalance: balanceDataAvailable ? balanceMinorUnits / 100 : undefined,
    ledgerBalanceMinorUnits: balanceDataAvailable ? balanceMinorUnits : undefined,
    lastFour: account.maskedAccountNumber.slice(-4),
    currency: account.currency === "INR" ? "INR" : "INR",
    isPrimary: account.isPrimary,
    status: account.status === "active" ? "active" : "inactive",
    holderDisplayName: account.nickname,
    branch: account.branchName ?? undefined,
    ifsc: account.ifsc ?? undefined,
    sourceEnvironment: account.sourceProvider === "seed" ? "Demo data" : `Account Aggregator · ${account.sourceProvider} (${account.sourceEnvironment})`,
    lastSuccessfulUpdate: account.asOf ?? "",
    holdsMinorUnits: balanceDataAvailable ? holdsMinorUnits ?? undefined : undefined,
    capabilities: {
      canSetPrimary: !isDeposit,
      canManageCard: !isDeposit,
      canExportTransactions: true,
    },
  };
}

/** Maps the owner-scoped Accounts API into the shared product-specific model. */
export function apiAccountsResponseToOverview(response: AccountsResponse): AccountsOverview {
  const accounts = response.accounts.map(apiAccountToBankAccount);
  const missingTransactionBalance = accounts.some((account) =>
    account.balanceDataAvailable === false
      && account.type !== "fixed-deposit"
      && account.type !== "recurring-deposit");
  const missingDepositBalance = accounts.some((account) =>
    account.balanceDataAvailable === false
      && (account.type === "fixed-deposit" || account.type === "recurring-deposit"));

  return buildAccountsOverview(accounts, {
    summary: {
      totalBalanceMinorUnits: missingTransactionBalance || missingDepositBalance
        ? null
        : parseOptionalApiMoneyToMinorUnits(response.summary.totalBalance),
      availableToSpendMinorUnits: missingTransactionBalance
        ? null
        : parseOptionalApiMoneyToMinorUnits(response.summary.availableToSpend),
      depositBalanceMinorUnits: missingDepositBalance
        ? null
        : parseOptionalApiMoneyToMinorUnits(response.summary.deposits),
    },
    lastUpdated: response.summary.updatedAt,
  });
}

function cardLifecycleStatus(value: string): CardRecord["lifecycleStatus"] {
  if (value === "temporarily_blocked") return "temporarily-disabled";
  if (value === "blocked") return "blocked";
  if (value === "expired") return "expired";
  if (value === "active") return "active";
  return "unknown";
}

function apiTransactionStatus(value: string): TransactionStatus {
  if (value === "pending") return "pending";
  if (value === "failed") return "failed";
  if (value === "reversed") return "reversed";
  return "posted";
}

export function apiCardToCardRecord(card: ApiCard): CardRecord {
  const formFactor = card.type === "virtual" ? "virtual" : "physical";
  const productKind: CardProductKind = card.type === "credit" ? "credit" : "debit";
  const controls: CardControl[] = card.controls ? [
    { group: "domestic", channel: "atm", state: card.controls.atmEnabled ? "enabled" : "disabled", supported: true },
    { group: "domestic", channel: "in-store", state: card.controls.domesticEnabled ? "enabled" : "disabled", supported: true },
    { group: "international", channel: "in-store", state: card.controls.internationalEnabled ? "enabled" : "disabled", supported: true },
    { group: "domestic", channel: "online", state: card.controls.onlineEnabled ? "enabled" : "disabled", supported: true },
    { group: "domestic", channel: "contactless", state: card.controls.contactlessEnabled ? "enabled" : "disabled", supported: true },
  ] : [];
  const limits: CardLimit[] = card.controls ? [
    { id: `${card.id}-pos`, label: "Daily POS limit", group: "domestic", channel: "in-store", period: "daily", amountMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyPosLimit), maximumMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyPosLimit), currency: "INR" },
    { id: `${card.id}-online`, label: "Daily online limit", group: "domestic", channel: "online", period: "daily", amountMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyOnlineLimit), maximumMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyOnlineLimit), currency: "INR" },
    { id: `${card.id}-atm`, label: "Daily ATM limit", group: "domestic", channel: "atm", period: "daily", amountMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyAtmLimit), maximumMinorUnits: parseApiMoneyToMinorUnits(card.controls.dailyAtmLimit), currency: "INR" },
  ] : [];
  return {
    id: card.id,
    providerReference: card.id,
    sourceEnvironment: "Bank API",
    productKind,
    formFactor,
    productName: card.nickname,
    nickname: card.nickname,
    lastFour: card.maskedCardNumber.slice(-4),
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    network: card.network,
    linkedAccountId: card.accountId ?? undefined,
    lifecycleStatus: cardLifecycleStatus(card.status),
    capabilities: {
      canTemporarilyDisable: true,
      canReenable: true,
      canManageDomesticUsage: true,
      canManageInternationalUsage: true,
      canManageLimits: Boolean(card.controls),
      canHotlist: true,
      canRequestReplacement: true,
      canViewStatements: true,
    },
    controls,
    limits,
    demoControlOutcome: "applied",
    sourceRevision: 1,
    lastSuccessfulUpdate: card.updatedAt,
  };
}

export function apiCardTransactionToCardTransaction(transaction: ApiCardTransaction): CardTransaction {
  const date = new Date(transaction.transactionAt);
  const transactionDate = Number.isNaN(date.getTime()) ? transaction.transactionAt.slice(0, 10) : date.toISOString().slice(0, 10);
  const transactionTime = Number.isNaN(date.getTime()) ? undefined : date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  return {
    id: transaction.id,
    sourceTransactionId: transaction.transactionId ?? transaction.id,
    cardId: transaction.cardId,
    merchant: transaction.merchantName,
    description: transaction.merchantName,
    amountMinorUnits: parseApiMoneyToMinorUnits(transaction.amount),
    currency: "INR",
    direction: "debit",
    status: apiTransactionStatus(transaction.status),
    transactionDate,
    transactionTime,
    transactionType: "purchase",
    sourceEnvironment: "Bank API",
    associationKey: transaction.transactionId ?? transaction.id,
    linkedTransactionId: transaction.transactionId ?? undefined,
    reference: transaction.transactionId ?? undefined,
  };
}

export function apiCardTransactionsToPage(items: ApiCardTransaction[], filters: NormalizedCardTransactionFilters, pageNumber = 1, pageSize = 6): CardTransactionPage {
  const allTransactions = items.map(apiCardTransactionToCardTransaction);
  const transactions = allTransactions.filter((item) => {
    const haystack = [item.merchant, item.description, item.reference, item.sourceTransactionId].filter(Boolean).join(" ").toLocaleLowerCase();
    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.transactionType !== "all" && item.transactionType !== filters.transactionType) return false;
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.period === "this-month" && !item.transactionDate.startsWith(new Date().toISOString().slice(0, 7))) return false;
    return !(filters.period === "last-month" && !item.transactionDate.startsWith(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7)));
  });
  const normalizedPageSize = Math.max(1, Math.min(20, Math.floor(pageSize)));
  const totalPages = Math.max(1, Math.ceil(transactions.length / normalizedPageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(pageNumber)));
  const pageItems = transactions.slice((page - 1) * normalizedPageSize, page * normalizedPageSize);
  const posted = transactions.filter((item) => item.status === "posted" || item.status === "reversed");
  const purchases = posted.filter((item) => item.transactionType === "purchase");
  const total = (type: CardTransaction["transactionType"]) => posted.filter((item) => item.transactionType === type).reduce((sum, item) => sum + item.amountMinorUnits, 0);
  return {
    items: pageItems,
    page,
    pageSize: normalizedPageSize,
    totalItems: transactions.length,
    totalPages,
    filters,
    summary: {
      postedPurchasesMinorUnits: total("purchase"),
      postedCashWithdrawalsMinorUnits: total("cash-withdrawal"),
      postedFeesMinorUnits: total("fee"),
      postedRefundsMinorUnits: total("refund"),
      includedPurchaseCount: purchases.length,
      scopeLabel: filters.period === "this-month" ? "This month · posted purchases only" : filters.period === "last-month" ? "Last month · posted purchases only" : "All available history · posted purchases only",
      coverageLabel: "Card activity returned by the connected banking service",
    },
  };
}

const knownCategories: TransactionCategory[] = ["salary", "shopping", "food", "bill", "transfer", "refund", "cash", "deposit", "interest", "other"];

function transactionCategory(value: string | null): TransactionCategory {
  if (value === "food_dining") return "food";
  if (value === "utilities") return "bill";
  return value && knownCategories.includes(value as TransactionCategory) ? value as TransactionCategory : "other";
}

export function apiTransactionToBankingActivity(transaction: ApiTransaction): BankingActivity {
  const amountMinorUnits = parseApiMoneyToMinorUnits(transaction.amount);
  const date = new Date(transaction.transactionAt);
  const dateLabel = Number.isNaN(date.getTime()) ? transaction.transactionAt : date.toISOString().slice(0, 10);
  const timeLabel = Number.isNaN(date.getTime()) ? "" : `, ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}`;
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    title: transaction.merchantName ?? transaction.description,
    timestamp: `${dateLabel}${timeLabel}`,
    amount: amountMinorUnits / 100,
    amountMinorUnits,
    direction: transaction.direction,
    category: transactionCategory(transaction.category),
  };
}

export function apiInsightToWealthInsight(insight: ApiInsight): WealthInsight {
  return {
    id: insight.id,
    title: normalizedInsightTitle(insight.type, insight.title),
    comparisonLabel: insight.summary,
    severity: insight.severity === "positive" || insight.severity === "attention" ? insight.severity : "neutral",
    createdAt: insight.createdAt,
  };
}

function normalizedInsightTitle(type: string, title: string): string {
  const cleanTitle = title.trim().replace(/[.!?]+$/, "");
  if (type !== "spending") return `${cleanTitle}.`;

  if (/\b(increased|decreased|spent|spending)\b/i.test(cleanTitle)) {
    return `${cleanTitle}.`;
  }

  const category = cleanTitle
    .replace(/\s+is\s+(trending\s+higher|trending\s+lower|up|down)$/i, "")
    .trim();
  const direction = /\b(lower|down|decreas|less)\b/i.test(cleanTitle) ? "decreased" : "increased";
  return `${category || "Your"} spending ${direction} this month.`;
}

function formatSnapshotPeriod(month: string, periodEnd?: string | null): string {
  const date = new Date(`${month.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "Reporting period unavailable";
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const endDate = periodEnd ? new Date(`${periodEnd.slice(0, 10)}T00:00:00.000Z`) : undefined;
  const endDay = endDate && !Number.isNaN(endDate.getTime()) && endDate.getUTCFullYear() === date.getUTCFullYear() && endDate.getUTCMonth() === date.getUTCMonth()
    ? endDate.getUTCDate()
    : lastDay;
  const reportedEndDay = Math.min(Math.max(endDay, 1), lastDay);
  const label = `1–${reportedEndDay} ${date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}`;
  const isCurrentMonth = date.getUTCFullYear() === new Date().getUTCFullYear() && date.getUTCMonth() === new Date().getUTCMonth();
  const isAvailableThroughToday = !endDate || endDate.getTime() <= Date.now();
  return isCurrentMonth && reportedEndDay < lastDay && isAvailableThroughToday ? `${label} · month to date` : label;
}

function coachInsightType(type: string): CoachWealthInsight["type"] {
  const mappedTypes: Record<string, CoachWealthInsight["type"]> = {
    bill: "bills",
    bills: "bills",
    cash_flow: "cash-flow",
    "cash-flow": "cash-flow",
    debt: "debt",
    emergency_fund: "emergency-fund",
    goal: "goal",
    investment: "investment",
    protection: "protection",
    savings: "savings",
    spending: "spending",
    subscription: "subscriptions",
    subscriptions: "subscriptions",
  };
  return mappedTypes[type] ?? "cash-flow";
}

export function apiInsightToCoachWealthInsight(insight: ApiInsight): CoachWealthInsight {
  const source = insight.source ?? {};
  const sourceNumber = (key: string): number | undefined => {
    const value = source[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number : undefined;
  };
  return {
    id: insight.id,
    type: coachInsightType(insight.type),
    title: normalizedInsightTitle(insight.type, insight.title),
    description: insight.summary,
    summary: insight.summary,
    metric: insight.metricValue && insight.metricUnit !== "%" ? Number(insight.metricValue) : undefined,
    metricUnit: insight.metricUnit === "%" ? "percentage" : insight.metricUnit === "INR" ? "currency" : insight.metricUnit === "number" ? "number" : undefined,
    percentage: insight.metricUnit === "%" && insight.metricValue ? Number(insight.metricValue) : undefined,
    comparison: insight.comparisonValue ? Number(insight.comparisonValue) : undefined,
    comparisonPeriod: insight.comparisonPeriod ?? undefined,
    amount: sourceNumber("differenceAmount"),
    currentAmount: sourceNumber("currentAmount"),
    previousAmount: sourceNumber("previousAmount"),
    differenceAmount: sourceNumber("differenceAmount"),
    direction: source.direction === "increase" || source.direction === "decrease" || source.direction === "unchanged" ? source.direction : undefined,
    category: typeof source.categoryLabel === "string" ? source.categoryLabel : typeof source.category === "string" ? source.category : undefined,
    period: typeof source.period === "string" ? source.period : undefined,
    source,
    severity: insight.severity === "positive" || insight.severity === "attention" ? insight.severity : "neutral",
    route: insight.actionRoute ?? undefined,
  };
}

function recommendationCategory(value: string): CoachRecommendation["category"] {
  if (value === "emergency-fund") return "emergency-fund";
  if (value === "retirement") return "retirement";
  if (value === "insurance") return "insurance";
  if (value === "tax") return "tax";
  return "investment";
}

export function apiRecommendationToCoachRecommendation(recommendation: ApiRecommendation): CoachRecommendation {
  const amount = recommendation.amount ? parseApiMoneyToMinorUnits(recommendation.amount) / 100 : undefined;
  const title = amount !== undefined && !/[₹\d]/.test(recommendation.title)
    ? `${recommendation.title} by ${formatINR(amount)}`
    : recommendation.title;
  return {
    id: recommendation.id,
    title,
    description: recommendation.description,
    reason: recommendation.reason,
    actionLabel: recommendation.actionLabel,
    priority: recommendation.priority,
    category: recommendationCategory(recommendation.category),
    route: recommendation.route,
    isEligible: recommendation.isEligible,
    amount,
  };
}

export function apiGoalToFinancialGoal(goal: ApiGoal): FinancialGoal {
  const targetAmount = parseApiMoneyToMinorUnits(goal.targetAmount) / 100;
  const currentAmount = parseApiMoneyToMinorUnits(goal.currentAmount) / 100;
  const progressPercentage = targetAmount > 0 ? Math.min(100, Math.max(0, Math.round((currentAmount / targetAmount) * 100))) : 0;
  return {
    id: goal.id,
    name: goal.title,
    targetAmount,
    currentAmount,
    progressPercentage,
    gapAmount: Math.max(targetAmount - currentAmount, 0),
    targetDate: goal.targetDate ?? undefined,
    monthlyContribution: goal.monthlyContribution ? parseApiMoneyToMinorUnits(goal.monthlyContribution) / 100 : undefined,
    status: progressPercentage >= 100 ? "completed" : goal.status === "attention" ? "attention" : goal.status === "on-track" || goal.status === "on_track" ? "on-track" : undefined,
  };
}

export function apiWealthSummaryToSnapshotDashboard(summary: WealthSummaryResponse): WealthCoachDashboard {
  const snapshot = summary.snapshot;
  const metrics: FinancialMetric[] = snapshot ? [
    { id: "income", label: "Income", value: parseApiMoneyToMinorUnits(snapshot.income) / 100, format: "currency", supportingLabel: "This month", trend: "positive", icon: "income" },
    { id: "expenses", label: "Expenses", value: parseApiMoneyToMinorUnits(snapshot.expenses) / 100, format: "currency", supportingLabel: "This month", trend: "neutral", icon: "expenses" },
    { id: "savings-rate", label: "Savings rate", value: Number(snapshot.savingsRate), format: "percentage", supportingLabel: "This month", trend: "positive", icon: "piggy-bank" },
  ] : [];
  return {
    metrics,
    insights: [],
    goals: [],
    recommendations: (summary.recommendations ?? []).map(apiRecommendationToCoachRecommendation),
    periodLabel: snapshot ? formatSnapshotPeriod(snapshot.month, snapshot.periodEnd) : undefined,
    scopeLabel: snapshot?.scopeLabel ?? (snapshot ? "Posted transactions · linked accounts" : undefined),
  };
}

export function apiWealthSummaryToDashboard(summary: WealthSummaryResponse): WealthCoachDashboard {
  return {
    ...apiWealthSummaryToSnapshotDashboard(summary),
    insights: summary.insights.map(apiInsightToCoachWealthInsight),
    goals: summary.goals.map(apiGoalToFinancialGoal),
    recommendations: (summary.recommendations ?? []).map(apiRecommendationToCoachRecommendation),
  };
}

export function apiBeneficiaryToBeneficiary(beneficiary: ApiBeneficiary, customerId: string): Beneficiary {
  return {
    id: beneficiary.id,
    customerId,
    type: beneficiary.type === "upi" ? "upi" : "bank-account",
    nickname: beneficiary.nickname ?? undefined,
    bankReturnedName: beneficiary.name,
    enteredName: beneficiary.name,
    maskedAccountNumber: beneficiary.maskedAccountNumber ?? undefined,
    ifsc: beneficiary.ifsc ?? undefined,
    upiId: beneficiary.upiId ?? undefined,
    status: beneficiary.status === "cooling_off" ? "cooling-off" : beneficiary.status === "disabled" ? "restricted" : "active",
    resolutionStatus: "resolved",
    eligibleAt: beneficiary.coolingOffUntil ?? undefined,
    registeredAt: beneficiary.createdAt,
    sourceEnvironment: "Demo data",
    revision: 1,
    updatedAt: beneficiary.updatedAt,
  };
}

export function apiTransferToAttempt(transfer: ApiTransfer, beneficiary?: Beneficiary): TransferAttempt {
  const destinationType = transfer.transferType === "own_account" ? "own-account" : transfer.transferType === "upi" ? "upi" : "bank-account";
  const method: TransferAttempt["method"] = transfer.transferType === "own_account"
    ? "internal"
    : transfer.transferType === "upi"
      ? "upi"
      : transfer.transferType === "bank"
        ? "within-bank"
        : transfer.transferType === "neft" || transfer.transferType === "imps"
          ? transfer.transferType
          : "within-bank";
  const status = transfer.status === "completed"
    ? "succeeded"
    : transfer.status === "failed"
      ? "failed"
      : transfer.status === "cancelled"
        ? "returned"
        : transfer.status === "submitted" || transfer.status === "processing"
          ? "accepted-processing"
          : "pending";
  const amountMinorUnits = parseApiMoneyToMinorUnits(transfer.amount);
  return {
    id: transfer.id,
    customerId: "remote",
    draftId: transfer.id,
    idempotencyKey: transfer.id,
    status,
    destinationType,
    method,
    recipient: {
      type: destinationType,
      displayName: beneficiary?.nickname ?? beneficiary?.bankReturnedName ?? beneficiary?.upiId ?? "Recipient",
      maskedDestination: beneficiary?.maskedAccountNumber ?? beneficiary?.upiId ?? "Destination unavailable",
      beneficiaryId: transfer.beneficiaryId ?? undefined,
      resolutionStatus: "resolved",
    },
    sourceAccount: { id: transfer.sourceAccountId, name: "Source account", lastFour: "----", type: "savings" },
    amountMinorUnits,
    feeMinorUnits: 0,
    taxMinorUnits: 0,
    totalDebitMinorUnits: amountMinorUnits,
    paymentMessage: transfer.note ?? undefined,
    internalReference: transfer.reference ?? transfer.id,
    providerReference: transfer.reference ?? undefined,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    statusChecks: 0,
    demoDisclosure: "Demo transfer completed — no real money was transferred.",
    sourceEnvironment: "Demo data",
  };
}
