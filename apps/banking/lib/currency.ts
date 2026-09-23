type CurrencyInput = number | string | null | undefined;

/** Formats a value with the app-wide Indian Rupee display rule. */
export function formatINR(value: CurrencyInput): string {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return "—";
  const sign = numericValue < 0 ? "-" : "";
  return `${sign}₹${formatIndianNumber(Math.abs(numericValue))}`;
}

function formatINRWithSign(value: CurrencyInput, showSign = false): string {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return "—";
  if (numericValue < 0) return formatINR(numericValue);
  return `${showSign && numericValue > 0 ? "+" : ""}${formatINR(numericValue)}`;
}

function toFiniteNumber(value: CurrencyInput): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatIndianNumber(value: number): string {
  try {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    const [whole, fraction] = value.toFixed(2).split(".");
    const groupedWhole = whole.length > 3
      ? `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`
      : whole;
    return `${groupedWhole}.${fraction}`;
  }
}

/**
 * Legacy named export retained for callers that use the older utility name.
 * `showDecimals` is ignored deliberately: financial displays always show two decimals.
 */
export function formatIndianCurrency(
  value: CurrencyInput,
  options?: {
    showDecimals?: boolean;
    showSign?: boolean;
  }
): string {
  return formatINRWithSign(value, options?.showSign);
}

export function formatIndianCurrencyWithoutSpace(value: CurrencyInput): string {
  return formatINR(value);
}

/** Normalizes rupee amounts embedded in API prose without altering surrounding copy. */
export function formatINRInText(value: string): string {
  return value.replace(/₹\s*(-?\d[\d,]*(?:\.\d{1,2})?)/g, (match, rawAmount: string) => {
    const amount = Number(rawAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount)) return match;
    return formatINR(amount);
  });
}

/** Formats an exact paise amount without doing ledger arithmetic in floats. */
export function formatIndianMinorUnits(
  minorUnits: number,
  options?: { showSign?: boolean },
): string {
  const numericMinorUnits = toFiniteNumber(minorUnits);
  if (numericMinorUnits === null) return "—";
  return formatINRWithSign(numericMinorUnits / 100, options?.showSign);
}

/** Formats a transaction amount with one consistent sign and INR decimals. */
export function formatTransactionAmount(
  minorUnits: number,
  direction: "credit" | "debit" | "transfer",
): string {
  const absoluteMinorUnits = Math.abs(minorUnits);
  if (direction === "debit") return formatIndianMinorUnits(-absoluteMinorUnits);
  if (direction === "credit") return formatIndianMinorUnits(absoluteMinorUnits, { showSign: true });
  return formatIndianMinorUnits(absoluteMinorUnits);
}

/** Major-unit counterpart for legacy home activity records. */
export function formatTransactionCurrency(
  amount: number,
  direction: "credit" | "debit" | "transfer",
): string {
  const absoluteAmount = Math.abs(amount);
  if (direction === "debit") return formatIndianCurrency(-absoluteAmount);
  if (direction === "credit") return formatIndianCurrency(absoluteAmount, { showSign: true });
  return formatIndianCurrency(absoluteAmount);
}

export function formatIndianCurrencyShort(value: number): string {
  return formatINR(value);
}

/** Uses lakh/crore notation when a compact card summary is easier to scan. */
export function formatCompactIndianCurrency(value: CurrencyInput): string {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return "—";
  const absoluteValue = Math.abs(numericValue);
  const sign = numericValue < 0 ? "-" : "";
  if (absoluteValue >= 10_000_000) {
    return `${sign}₹${(absoluteValue / 10_000_000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} crore`;
  }
  if (absoluteValue >= 100_000) {
    return `${sign}₹${(absoluteValue / 100_000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh`;
  }
  return formatINR(numericValue);
}
