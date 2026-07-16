import { identifierSchema, otpCodeSchema } from "@/src/features/authentication/schemas/authentication.schema";

describe("identifierSchema", () => {
  it("accepts a valid 10-digit mobile number", () => {
    expect(identifierSchema.safeParse("9876543210").success).toBe(true);
  });

  it("accepts a valid alphanumeric customer ID", () => {
    expect(identifierSchema.safeParse("CUST12345").success).toBe(true);
  });

  it("rejects an empty identifier", () => {
    expect(identifierSchema.safeParse("").success).toBe(false);
  });

  it("rejects an identifier too short to be a phone number or customer ID", () => {
    expect(identifierSchema.safeParse("abc12").success).toBe(false);
  });
});

describe("otpCodeSchema", () => {
  it("accepts a 6-digit code", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true);
  });

  it("rejects a code that is not 6 digits", () => {
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
  });

  it("rejects a code containing non-digit characters", () => {
    expect(otpCodeSchema.safeParse("12345a").success).toBe(false);
  });
});
