/**
 * Formats a number into Indian Rupee (INR) currency format.
 * Example: 100000 -> ₹ 1,00,000.00
 */
export function formatIndianCurrency(
  value: number,
  options?: {
    showDecimals?: boolean;
    showSign?: boolean;
  }
): string {
  const showDecimals = options?.showDecimals ?? true;
  const showSign = options?.showSign ?? false;
  
  const absVal = Math.abs(value);
  let result = "";

  try {
    const formatter = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    });
    result = formatter.format(absVal);
  } catch {
    // Fallback manual formatter for en-IN
    const parts = absVal.toFixed(showDecimals ? 2 : 0).split(".");
    let numStr = parts[0];
    const decStr = parts[1] ? `.${parts[1]}` : "";
    
    // en-IN formatting (comma after last 3 digits, and then every 2 digits)
    if (numStr.length > 3) {
      let lastThree = numStr.substring(numStr.length - 3);
      const otherNumbers = numStr.substring(0, numStr.length - 3);
      result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree + decStr;
    } else {
      result = numStr + decStr;
    }
  }

  const sign = value < 0 ? "-" : (showSign && value > 0 ? "+" : "");
  return `${sign}₹ ${result}`;
}

export function formatIndianCurrencyWithoutSpace(value: number): string {
  return formatIndianCurrency(value, { showDecimals: false }).replace("₹ ", "₹");
}

export function formatIndianCurrencyShort(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 10000000) {
    return `${sign}₹${formatCompactUnit(absValue / 10000000)} crore`;
  }

  if (absValue >= 100000) {
    return `${sign}₹${formatCompactUnit(absValue / 100000)} lakhs`;
  }

  return formatIndianCurrencyWithoutSpace(value);
}

function formatCompactUnit(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}
