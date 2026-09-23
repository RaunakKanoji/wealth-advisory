const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function parseMinorUnits(value: string): bigint {
  if (!MONEY_PATTERN.test(value)) throw new Error("Invalid money value");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function assertMoney(value: string): string {
  if (!MONEY_PATTERN.test(value) || value === "0" || /^0+(?:\.0{1,2})?$/.test(value)) {
    throw new Error("Amount must be greater than zero and use at most two decimal places");
  }
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function toMinorUnits(value: string): bigint {
  const normalized = assertMoney(value);
  return parseMinorUnits(normalized);
}

export function fromMinorUnits(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

/** Calculates a percentage to two decimal places using integer arithmetic. */
export function percentageFromRatio(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return "0.00";

  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const roundedHundredths = (absoluteNumerator * 10000n + denominator / 2n) / denominator;
  return fromMinorUnits(sign * roundedHundredths);
}

export function addMoney(...values: string[]): string {
  return fromMinorUnits(values.reduce((sum, value) => sum + toMinorUnits(value), 0n));
}
