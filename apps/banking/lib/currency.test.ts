import {
  formatIndianCurrency,
  formatIndianCurrencyShort,
  formatINR,
  formatINRInText,
  formatTransactionAmount,
} from "./currency";

describe("currency utilities", () => {
  describe("formatIndianCurrency", () => {
    it("formats standard rupees correctly", () => {
      expect(formatIndianCurrency(100000)).toBe("₹1,00,000.00");
      expect(formatIndianCurrency(100000, { showDecimals: false })).toBe("₹1,00,000.00");
    });
  });

  describe("formatINR", () => {
    it("uses Indian grouping for numbers and preserves unavailable inputs", () => {
      expect(formatINR(100000)).toBe("₹1,00,000.00");
      expect(formatINR(160975)).toBe("₹1,60,975.00");
      expect(formatINR(69999)).toBe("₹69,999.00");
      expect(formatINR(345678)).toBe("₹3,45,678.00");
      expect(formatINR(120678)).toBe("₹1,20,678.00");
      expect(formatINR(2500000)).toBe("₹25,00,000.00");
      expect(formatINR(425000)).toBe("₹4,25,000.00");
      expect(formatINR(0)).toBe("₹0.00");
      expect(formatINR("160975")).toBe("₹1,60,975.00");
      expect(formatINR(null)).toBe("—");
      expect(formatINR(undefined)).toBe("—");
    });
  });

  describe("formatINRInText", () => {
    it("normalizes ungrouped API amounts inside Coach copy", () => {
      expect(formatINRInText("You have ₹160975.00 and spent ₹69999.50."))
        .toBe("You have ₹1,60,975.00 and spent ₹69,999.50.");
    });
  });

  describe("formatIndianCurrencyShort", () => {
    it("follows the same exact-decimal rule as every other currency helper", () => {
      expect(formatIndianCurrencyShort(100000)).toBe("₹1,00,000.00");
      expect(formatIndianCurrencyShort(25000000)).toBe("₹2,50,00,000.00");
      expect(formatIndianCurrencyShort(5000)).toBe("₹5,000.00");
    });
  });

  describe("formatTransactionAmount", () => {
    it("keeps debit and credit signs attached to the currency value", () => {
      expect(formatTransactionAmount(200_000, "debit")).toBe("-₹2,000.00");
      expect(formatTransactionAmount(200_000, "credit")).toBe("+₹2,000.00");
      expect(formatTransactionAmount(-200_000, "debit")).toBe("-₹2,000.00");
    });
  });

});
