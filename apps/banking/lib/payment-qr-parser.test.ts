import {
  createManualPaymentQr,
  parseAmountToMinorUnits,
  parsePaymentQr,
  PaymentQrParseError,
} from "./payment-qr-parser";

describe("payment QR parser", () => {
  it("parses a valid ordinary UPI payment QR with an amount", () => {
    expect(parsePaymentQr(
      "upi://pay?pa=merchant@upi&pn=Demo%20Store&mc=5411&tr=ORDER-123&tn=Lunch&am=125.50&cu=INR",
    )).toMatchObject({
      recipientAddress: "merchant@upi",
      recipientLabel: "Demo Store",
      amountMinorUnits: 12_550,
      amountSource: "from-qr",
      currency: "INR",
      note: "Lunch",
      merchantCategory: "5411",
      requestReference: "ORDER-123",
    });
  });

  it("accepts an amountless QR and defaults the omitted currency to INR", () => {
    expect(parsePaymentQr("upi://pay?pa=merchant@upi&pn=Demo+Store")).toMatchObject({
      recipientAddress: "merchant@upi",
      recipientLabel: "Demo Store",
      amountMinorUnits: null,
      amountSource: "not-provided",
      currency: "INR",
    });
  });

  it("decodes fields once and preserves the recipient identifier", () => {
    const parsed = parsePaymentQr(
      "upi://pay?pa=shop.owner@bank&pn=Jos%C3%A9%20%26%20Sons&tn=Coffee%20%2526%20cake",
    );

    expect(parsed.recipientAddress).toBe("shop.owner@bank");
    expect(parsed.recipientLabel).toBe("José & Sons");
    expect(parsed.note).toBe("Coffee %26 cake");
  });

  it.each([
    ["missing recipient", "upi://pay?pn=Demo%20Store", "missing-recipient"],
    ["duplicate critical field", "upi://pay?pa=first@upi&pa=second@upi", "duplicate-field"],
    ["malformed encoding", "upi://pay?pa=merchant%ZZ@upi", "malformed"],
    ["unsupported scheme", "https://example.com/upi?pa=merchant@upi", "unsupported-format"],
    ["unsupported currency", "upi://pay?pa=merchant@upi&cu=USD", "invalid-currency"],
    ["signed request", "upi://pay?pa=merchant@upi&sign=abc", "unsupported-field"],
    ["script-like label", "upi://pay?pa=merchant@upi&pn=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "unsafe-text"],
  ])("rejects %s", (_label, payload, code) => {
    try {
      parsePaymentQr(payload);
      throw new Error("Expected parser to reject the payload");
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentQrParseError);
      expect((error as PaymentQrParseError).code).toBe(code);
    }
  });

  it("rejects an oversized payload", () => {
    expect(() => parsePaymentQr(`upi://pay?pa=merchant@upi&tn=${"x".repeat(4090)}`)).toThrow(
      "too large",
    );
  });

  it.each(["0", "-1", "1.", "1.234", "1e2", "01.00", "abc", "1000001.00"])(
    "rejects invalid amount %s",
    (amount) => {
      expect(() => parseAmountToMinorUnits(amount)).toThrow(PaymentQrParseError);
    },
  );

  it("converts decimal amounts to exact paise", () => {
    expect(parseAmountToMinorUnits("125")).toBe(12_500);
    expect(parseAmountToMinorUnits("0.10")).toBe(10);
    expect(parseAmountToMinorUnits("999999.99")).toBe(99_999_999);
  });

  it("uses the same validation for manual UPI entry", () => {
    expect(createManualPaymentQr("customer@upi", "My recipient")).toMatchObject({
      recipientAddress: "customer@upi",
      recipientLabel: "My recipient",
      amountMinorUnits: null,
      amountSource: "customer-entered",
      currency: "INR",
    });
  });
});
