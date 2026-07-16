import {
  mobileNumberSchema,
  normalizeMobileNumber,
} from "@/src/features/authentication/schemas/customer-identifier.schema";

function expectNormalizedTo(input: string, expected: string): void {
  const result = mobileNumberSchema.safeParse(input);
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error("expected the schema to accept the input");
  }
  expect(result.data).toBe(expected);
}

function expectRejectedWith(input: string, expectedMessage: string): void {
  const result = mobileNumberSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("expected the schema to reject the input");
  }
  expect(result.error.issues[0]?.message).toBe(expectedMessage);
}

describe("normalizeMobileNumber", () => {
  it.each([
    ["9876543210"],
    ["+919876543210"],
    ["+91 98765 43210"],
    ["98765 43210"],
  ])("normalizes the documented form %s to bare digits", (input) => {
    expect(normalizeMobileNumber(input)).toBe("9876543210");
  });

  it("strips a bare 91 prefix when the input is exactly 12 digits", () => {
    expect(normalizeMobileNumber("919876543210")).toBe("9876543210");
  });

  it("leaves an 11-digit number starting with 91 untouched", () => {
    expect(normalizeMobileNumber("91876543210")).toBe("91876543210");
  });

  it("leaves a +92 country prefix in place", () => {
    expect(normalizeMobileNumber("+929876543210")).toBe("+929876543210");
  });
});

describe("mobileNumberSchema", () => {
  it("accepts a plain 10-digit mobile number", () => {
    expectNormalizedTo("9876543210", "9876543210");
  });

  it("normalizes a +91-prefixed number to the bare 10 digits", () => {
    expectNormalizedTo("+919876543210", "9876543210");
  });

  it("normalizes a spaced +91-prefixed number to the bare 10 digits", () => {
    expectNormalizedTo("+91 98765 43210", "9876543210");
  });

  it("normalizes a spaced 10-digit number to the bare 10 digits", () => {
    expectNormalizedTo("98765 43210", "9876543210");
  });

  it("accepts a 12-digit number with a bare 91 prefix and strips the prefix", () => {
    expectNormalizedTo("919876543210", "9876543210");
  });

  it("rejects a 9-digit number", () => {
    expectRejectedWith("987654321", "Enter a valid 10-digit mobile number.");
  });

  it("rejects an 11-digit number without a 91 prefix", () => {
    expectRejectedWith("98765432101", "Enter a valid 10-digit mobile number.");
  });

  it("rejects input containing letters", () => {
    expectRejectedWith("98765abcde", "Mobile numbers can only contain digits.");
  });

  it("rejects a +92-prefixed number because the prefix is not stripped", () => {
    expectRejectedWith("+929876543210", "Enter a valid 10-digit mobile number.");
  });

  it("rejects an empty value with the enter-mobile-number message", () => {
    expectRejectedWith(
      "",
      "Enter the mobile number registered with IDBI Bank.",
    );
  });
});
