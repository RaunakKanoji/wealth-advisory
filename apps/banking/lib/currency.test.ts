import {
  formatIndianCurrency,
  formatIndianCurrencyShort,
  formatIndianCurrencyWithoutSpace,
} from "./currency";

describe("currency utilities", () => {
  describe("formatIndianCurrency", () => {
    it("formats standard rupees correctly", () => {
      expect(formatIndianCurrency(100000)).toBe("₹ 1,00,000.00");
      expect(formatIndianCurrency(100000, { showDecimals: false })).toBe("₹ 1,00,000");
    });
  });

  describe("formatIndianCurrencyShort", () => {
    it("formats lakhs and crores correctly", () => {
      expect(formatIndianCurrencyShort(100000)).toBe("₹1 lakhs");
      expect(formatIndianCurrencyShort(25000000)).toBe("₹2.5 crore");
      expect(formatIndianCurrencyShort(5000)).toBe("₹5,000");
    });
  });

  describe("formatCompactUnit fallback", () => {
    it("uses fallback math format when Intl.NumberFormat throws", () => {
      const originalIntl = global.Intl;
      // Mock Intl to throw
      global.Intl = {
        ...originalIntl,
        NumberFormat: jest.fn().mockImplementation(() => {
          throw new Error("Intl error");
        }),
      } as any;

      try {
        expect(formatIndianCurrencyShort(25000000)).toBe("₹2.5 crore");
        expect(formatIndianCurrencyShort(100000)).toBe("₹1 lakhs");
      } finally {
        global.Intl = originalIntl;
      }
    });
  });
});
