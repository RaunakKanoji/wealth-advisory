/**
 * Conservative parser for the ordinary UPI payment URI profile.
 *
 * QR content is untrusted input. This module only parses a documented subset
 * and never follows URLs, launches apps, or resolves a recipient.
 */

export const MAX_PAYMENT_QR_PAYLOAD_LENGTH = 4096;
export const MAX_PAYMENT_MINOR_UNITS = 100_000_000; // ₹10,00,000.00

const SUPPORTED_FIELDS = new Set(["pa", "pn", "mc", "tr", "tn", "am", "cu"]);
const SPECIALISED_FIELDS = new Set([
  "sign",
  "sig",
  "ver",
  "url",
  "mode",
  "purpose",
  "orgid",
  "min",
  "mam",
  "recur",
  "validity",
  "block",
  "mandate",
  "collect",
]);

export type PaymentQrAmountSource = "from-qr" | "not-provided" | "customer-entered";

export type ParsedPaymentQr = {
  recipientAddress: string;
  recipientLabel?: string;
  amountMinorUnits: number | null;
  amountSource: PaymentQrAmountSource;
  currency: "INR";
  note?: string;
  merchantCategory?: string;
  requestReference?: string;
  /** The fields accepted by this parser, retained for review display only. */
  rawFields: Readonly<Record<string, string>>;
};

export class PaymentQrParseError extends Error {
  readonly code:
    | "empty"
    | "oversized"
    | "unsupported-format"
    | "malformed"
    | "missing-recipient"
    | "invalid-recipient"
    | "duplicate-field"
    | "unsupported-field"
    | "unsafe-text"
    | "invalid-currency"
    | "invalid-amount"
    | "invalid-field";

  constructor(
    message: string,
    code: PaymentQrParseError["code"],
  ) {
    super(message);
    this.name = "PaymentQrParseError";
    this.code = code;
  }
}

function fail(message: string, code: PaymentQrParseError["code"]): never {
  throw new PaymentQrParseError(message, code);
}

function assertSafeText(value: string, field: string, maxLength: number) {
  if (!value || value.length > maxLength) {
    fail(`${field} is missing or too long`, "invalid-field");
  }

  if (/[\u0000-\u001F\u007F<>]/.test(value)) {
    fail(`${field} contains unsupported characters`, "unsafe-text");
  }

  if (/^\s*(?:javascript|data):/i.test(value)) {
    fail(`${field} contains an unsupported value`, "unsafe-text");
  }
}

export function isValidUpiId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(value)
    && !value.includes("..")
    && !value.includes("@.")
    && !value.endsWith(".");
}

export function parseAmountToMinorUnits(value: string): number {
  if (!/^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/.test(value)) {
    fail("Enter an amount with up to two decimal places", "invalid-amount");
  }

  const [wholePart, decimalPart = ""] = value.split(".");
  const minorUnits = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0") || 0);

  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0 || minorUnits > MAX_PAYMENT_MINOR_UNITS) {
    fail("The amount must be greater than zero and within the demo limit", "invalid-amount");
  }

  return minorUnits;
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    fail("This QR contains malformed encoded data", "malformed");
  }
}

function readQuery(rawPayload: string): Record<string, string> {
  const queryStart = rawPayload.indexOf("?");
  if (queryStart < 0 || queryStart === rawPayload.length - 1) {
    fail("This QR has no payment details", "malformed");
  }

  const fragmentStart = rawPayload.indexOf("#", queryStart);
  if (fragmentStart >= 0) {
    fail("QR fragments are not supported", "unsupported-format");
  }

  const query = rawPayload.slice(queryStart + 1);
  const fields: Record<string, string> = {};

  for (const part of query.split("&")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      fail("This QR contains a malformed payment field", "malformed");
    }

    const key = decodeQueryPart(part.slice(0, separator));
    const value = decodeQueryPart(part.slice(separator + 1));
    if (!key) {
      fail("This QR contains an empty payment field", "malformed");
    }

    if (fields[key] !== undefined) {
      fail(`The QR repeats the ${key} field`, "duplicate-field");
    }

    if (!SUPPORTED_FIELDS.has(key)) {
      fail(
        SPECIALISED_FIELDS.has(key)
          ? "This QR uses a signed or specialised payment flow"
          : `This QR field is not supported: ${key}`,
        SPECIALISED_FIELDS.has(key) ? "unsupported-field" : "unsupported-field",
      );
    }

    fields[key] = value;
  }

  return fields;
}

export function parsePaymentQr(rawPayload: string): ParsedPaymentQr {
  if (!rawPayload || !rawPayload.trim()) {
    fail("No QR content was received", "empty");
  }
  if (rawPayload.length > MAX_PAYMENT_QR_PAYLOAD_LENGTH) {
    fail("This QR payload is too large to process safely", "oversized");
  }

  let uri: URL;
  try {
    uri = new URL(rawPayload);
  } catch {
    fail("This QR is not a supported UPI payment code", "unsupported-format");
  }

  if (
    uri.protocol !== "upi:"
    || uri.hostname !== "pay"
    || uri.username
    || uri.password
    || uri.port
    || (uri.pathname !== "" && uri.pathname !== "/")
  ) {
    fail("This QR is not a supported UPI payment code", "unsupported-format");
  }

  const fields = readQuery(rawPayload);
  const recipientAddress = fields.pa;
  if (!recipientAddress) {
    fail("This QR does not include a recipient UPI ID", "missing-recipient");
  }
  assertSafeText(recipientAddress, "Recipient UPI ID", 320);
  if (!isValidUpiId(recipientAddress)) {
    fail("The recipient UPI ID is not valid", "invalid-recipient");
  }

  const recipientLabel = fields.pn;
  if (recipientLabel !== undefined) {
    assertSafeText(recipientLabel, "Recipient label", 120);
  }

  const note = fields.tn;
  if (note !== undefined && note.length > 0) {
    assertSafeText(note, "Payment note", 240);
  }

  const merchantCategory = fields.mc;
  if (merchantCategory !== undefined && !/^\d{4}$/.test(merchantCategory)) {
    fail("The merchant category is not supported", "invalid-field");
  }

  const requestReference = fields.tr;
  if (requestReference !== undefined) {
    assertSafeText(requestReference, "Request reference", 64);
  }

  const currency = fields.cu ?? "INR";
  if (currency !== "INR") {
    fail("Only INR payment requests are supported", "invalid-currency");
  }

  const amount = fields.am;
  const amountMinorUnits = amount === undefined ? null : parseAmountToMinorUnits(amount);

  return {
    recipientAddress,
    recipientLabel: recipientLabel || undefined,
    amountMinorUnits,
    amountSource: amountMinorUnits === null ? "not-provided" : "from-qr",
    currency: "INR",
    note: note || undefined,
    merchantCategory,
    requestReference,
    rawFields: Object.freeze({ ...fields }),
  };
}

export function createManualPaymentQr(
  upiId: string,
  customerLabel?: string,
): ParsedPaymentQr {
  const recipientAddress = upiId.trim();
  if (!isValidUpiId(recipientAddress)) {
    fail("Enter a valid UPI ID such as name@bank", "invalid-recipient");
  }

  const recipientLabel = customerLabel?.trim() || undefined;
  if (recipientLabel) {
    assertSafeText(recipientLabel, "Recipient label", 120);
  }

  return {
    recipientAddress,
    recipientLabel,
    amountMinorUnits: null,
    amountSource: "customer-entered",
    currency: "INR",
    rawFields: Object.freeze({ pa: recipientAddress, ...(recipientLabel ? { pn: recipientLabel } : {}) }),
  };
}
