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
  } catch (e) {
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
