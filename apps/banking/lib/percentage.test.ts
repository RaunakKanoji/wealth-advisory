import { formatPercentage } from "./percentage";

describe("percentage utilities", () => {
  it("formats calculated financial rates with exactly two decimals", () => {
    expect(formatPercentage(56.5)).toBe("56.50%");
    expect(formatPercentage(68)).toBe("68.00%");
    expect(formatPercentage(17)).toBe("17.00%");
  });
});
