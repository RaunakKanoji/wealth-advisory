import {
  createOtpSchema,
  otpSchema,
} from "@/src/features/authentication/schemas/otp.schema";

describe("otpSchema", () => {
  it("accepts a 6-digit numeric code", () => {
    const result = otpSchema.safeParse("123456");
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected the schema to accept the code");
    }
    expect(result.data).toBe("123456");
  });

  it.each([
    ["a 5-digit code", "12345"],
    ["a 7-digit code", "1234567"],
    ["a code containing a space", "12 456"],
    ["a code containing a letter", "12345a"],
    ["an empty value", ""],
  ])("rejects %s with the 6-digit message", (_label, input) => {
    const result = otpSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected the schema to reject the code");
    }
    expect(result.error.issues[0]?.message).toBe("Enter the 6-digit code.");
  });
});

describe("createOtpSchema", () => {
  it("accepts a code matching the requested length", () => {
    const result = createOtpSchema(4).safeParse("1234");
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected the schema to accept the code");
    }
    expect(result.data).toBe("1234");
  });

  it("rejects a code longer than the requested length with a length-specific message", () => {
    const result = createOtpSchema(4).safeParse("12345");
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected the schema to reject the code");
    }
    expect(result.error.issues[0]?.message).toBe("Enter the 4-digit code.");
  });
});
