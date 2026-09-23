import { privacySafeFinancialText } from "./privacy";

describe("privacySafeFinancialText", () => {
  it("replaces currency-bearing text with a complete fallback", () => {
    expect(
      privacySafeFinancialText(
        "You are ₹32,000 away from this goal.",
        "Open your goal to review your progress.",
      ),
    ).toBe("Open your goal to review your progress.");
  });

  it("removes placeholder wording without exposing an amount", () => {
    expect(
      privacySafeFinancialText(
        "Hidden amount",
        "Open this insight to review the financial details.",
      ),
    ).toBe("Open this insight to review the financial details.");
  });

  it("hides percentage-bearing financial copy", () => {
    expect(
      privacySafeFinancialText(
        "Emergency fund is 68% complete.",
        "Financial goal progress",
      ),
    ).toBe("Financial goal progress");
  });

  it("hides INR and rupee currency spellings", () => {
    expect(privacySafeFinancialText("Available INR 100000", "Financial value hidden")).toBe("Financial value hidden");
    expect(privacySafeFinancialText("Available 1,00,000 rupees", "Financial value hidden")).toBe("Financial value hidden");
  });

  it("keeps non-financial copy unchanged", () => {
    expect(
      privacySafeFinancialText(
        "Your spending is trending higher than usual.",
        "Open this insight to review the financial details.",
      ),
    ).toBe("Your spending is trending higher than usual.");
  });
});
