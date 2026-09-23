const currencyAmountPattern = /(?:(?:₹|Rs\.?|INR)[\s\u00a0]*\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?[\s\u00a0]*(?:rupees?|INR))\b/i;
const percentagePattern = /[+-]?\d[\d,.]*\s*%/;

/** Returns a complete, non-financial sentence when a value contains money. */
export function privacySafeFinancialText(value: string, fallback: string): string {
  return currencyAmountPattern.test(value) || percentagePattern.test(value) || /\bhidden amount\b/i.test(value) ? fallback : value;
}
