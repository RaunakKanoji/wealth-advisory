import { describe, expect, it } from "vitest";

import { addMoney, assertMoney, fromMinorUnits, parseMinorUnits, percentageFromRatio } from "./money.js";

describe("exact money helpers", () => {
  it("parses and adds decimal amounts without floating point rounding", () => {
    expect(parseMinorUnits("100000.50")).toBe(10000050n);
    expect(addMoney("100000.50", "245.25", "0.25")).toBe("100246.00");
  });

  it("formats negative balance deltas consistently", () => {
    expect(fromMinorUnits(-125n)).toBe("-1.25");
  });

  it("rounds percentage ratios to two decimal places", () => {
    expect(percentageFromRatio(90976n, 160975n)).toBe("56.52");
    expect(percentageFromRatio(-1n, 3n)).toBe("-33.33");
    expect(percentageFromRatio(1n, 0n)).toBe("0.00");
  });

  it("rejects zero and more than two decimal places for transaction amounts", () => {
    expect(() => assertMoney("0.00")).toThrow();
    expect(() => assertMoney("12.345")).toThrow();
  });
});
