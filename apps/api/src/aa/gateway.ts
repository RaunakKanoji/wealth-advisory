import { createHash, createHmac, createSign, createVerify, timingSafeEqual } from "node:crypto";

import { env, isAAEnabled } from "../env.js";
import { ApiError } from "../lib/errors.js";
import type { AAGateway, ConsentRequest, ProviderConsent, ProviderConsentStatus, ProviderDataSession } from "./types.js";

const REBIT_VERSION = "2.0.0";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function detachedJws(body: string): string {
  if (!env.AA_JWS_PRIVATE_KEY || !env.AA_JWS_KEY_ID) {
    throw new ApiError("AA_SIGNING_KEY_MISSING", "Account Aggregator signing is not configured.", 503);
  }
  const protectedHeader = base64Url(JSON.stringify({ alg: "RS256", kid: env.AA_JWS_KEY_ID, typ: "JOSE" }));
  const signingInput = `${protectedHeader}.${base64Url(body)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${protectedHeader}..${signer.sign(env.AA_JWS_PRIVATE_KEY, "base64url")}`;
}

function requestId(): string {
  return createHash("sha256").update(`${Date.now()}:${Math.random()}`).digest("hex").slice(0, 32);
}

function providerResponse(record: Record<string, unknown>): Record<string, unknown> {
  const nested = record.data ?? record.Data ?? record.response ?? record.Response;
  return asRecord(nested).ver || asRecord(nested).status || asRecord(nested).consentHandle ? asRecord(nested) : record;
}

class RebitGateway implements AAGateway {
  private readonly baseUrl: string;

  constructor() {
    if (!env.AA_API_BASE_URL || !env.AA_FIU_ID || !env.AA_CLIENT_API_KEY) {
      throw new ApiError("AA_NOT_CONFIGURED", "Account Aggregator provider configuration is incomplete.", 503);
    }
    this.baseUrl = env.AA_API_BASE_URL.replace(/\/$/, "");
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = JSON.stringify(payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AA_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "client_api_key": env.AA_CLIENT_API_KEY!,
          "x-client-api-key": env.AA_CLIENT_API_KEY!,
          "x-fiu-id": env.AA_FIU_ID!,
          "x-jws-signature": detachedJws(body),
          "x-request-id": requestId(),
        },
        body,
        signal: controller.signal,
      });
      const parsed = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        throw new ApiError("AA_PROVIDER_REQUEST_FAILED", "The Account Aggregator provider rejected the request.", 502);
      }
      const record = asRecord(parsed);
      if (Object.keys(record).length === 0) throw new ApiError("AA_PROVIDER_INVALID_RESPONSE", "The Account Aggregator returned an empty response.", 502);
      return providerResponse(record);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("AA_PROVIDER_UNAVAILABLE", "The Account Aggregator provider could not be reached.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createConsent(input: { externalAuthId: string; consentId: string; request: ConsentRequest }): Promise<ProviderConsent> {
    const now = new Date();
    const consentStart = input.request.fromDate ?? new Date(now.getTime() - 365 * 86400000).toISOString();
    const consentExpiry = new Date(now.getTime() + input.request.consentDurationDays * 86400000).toISOString();
    const response = await this.post("/Consent", {
      ver: REBIT_VERSION,
      timestamp: now.toISOString(),
      txnid: input.consentId,
      customer: { id: input.externalAuthId },
      consentDetail: {
        consentStart,
        consentExpiry,
        consentMode: input.request.consentMode,
        fetchType: input.request.fetchType,
        consentTypes: input.request.fiSections,
        fiTypes: input.request.fiTypes,
        dataLife: { unit: "DAY", value: input.request.dataLifeDays },
        frequency: { unit: "DAY", value: input.request.fetchFrequency },
        fiDataRange: {
          from: consentStart,
          to: input.request.toDate ?? now.toISOString(),
        },
        purpose: { code: input.request.purposeCode, text: input.request.purposeText },
      },
    });
    const handle = firstString(response, ["consentHandle", "ConsentHandle", "consentRequestId"]);
    const redirectUrl = firstString(response, ["redirectUrl", "consentUrl", "url", "webViewUrl"]);
    if (!handle || !redirectUrl) throw new ApiError("AA_PROVIDER_INVALID_RESPONSE", "The Account Aggregator did not return a consent handle and redirect URL.", 502);
    return {
      providerConsentHandle: handle,
      providerConsentId: firstString(response, ["consentId", "ConsentId"]),
      redirectUrl,
      status: firstString(response, ["status", "Status"]) ?? "PENDING",
    };
  }

  async getConsentStatus(input: { providerConsentHandle: string }): Promise<ProviderConsentStatus> {
    const response = await this.post("/Consent/handle", {
      ver: REBIT_VERSION,
      timestamp: new Date().toISOString(),
      txnid: requestId(),
      consentHandle: input.providerConsentHandle,
    });
    const status = firstString(response, ["status", "Status", "consentStatus", "ConsentStatus"]);
    if (!status) throw new ApiError("AA_PROVIDER_INVALID_RESPONSE", "The Account Aggregator returned no consent status.", 502);
    return {
      providerConsentId: firstString(response, ["consentId", "ConsentId"]),
      status: status.toUpperCase(),
      rawStatus: status,
    };
  }

  async requestData(input: { providerConsentId: string; consentId: string; requestedFrom: Date; requestedTo: Date }): Promise<ProviderDataSession> {
    const response = await this.post("/FI/request", {
      ver: REBIT_VERSION,
      timestamp: new Date().toISOString(),
      txnid: input.consentId,
      consentId: input.providerConsentId,
      fiDataRange: { from: input.requestedFrom.toISOString(), to: input.requestedTo.toISOString() },
    });
    const sessionId = firstString(response, ["sessionId", "SessionId"]);
    if (!sessionId) throw new ApiError("AA_PROVIDER_INVALID_RESPONSE", "The Account Aggregator did not return a data session.", 502);
    return { providerSessionId: sessionId, status: firstString(response, ["status", "Status"]) ?? "REQUESTED" };
  }

  async fetchData(input: { providerSessionId: string }): Promise<unknown> {
    const response = await this.post("/FI/fetch", {
      ver: REBIT_VERSION,
      timestamp: new Date().toISOString(),
      txnid: requestId(),
      sessionId: input.providerSessionId,
    });
    if (response.encryptedData || response.encrypted_data || response.FI) {
      throw new ApiError("AA_DATA_DECRYPTION_REQUIRED", "The provider returned an encrypted FI payload that has not been decrypted.", 502);
    }
    return response.data ?? response.Data ?? response;
  }
}

class ExplicitMockGateway implements AAGateway {
  async createConsent(input: { externalAuthId: string; consentId: string; request: ConsentRequest }): Promise<ProviderConsent> {
    return {
      providerConsentHandle: `mock-handle-${input.consentId}`,
      providerConsentId: `mock-consent-${input.consentId}`,
      redirectUrl: `https://aa.example.test/consent/${encodeURIComponent(input.consentId)}`,
      status: "ACTIVE",
    };
  }

  async getConsentStatus(): Promise<ProviderConsentStatus> {
    return { providerConsentId: "mock-consent-active", status: "ACTIVE", rawStatus: "ACTIVE" };
  }

  async requestData(input: { providerConsentId: string; consentId: string; requestedFrom: Date; requestedTo: Date }): Promise<ProviderDataSession> {
    return { providerSessionId: `mock-session-${input.consentId}`, status: "READY" };
  }

  async fetchData(): Promise<unknown> {
    return {
      providerConnectionId: "mock-connection",
      institutionId: "mock-fip",
      institutionName: "Explicit AA test FIP",
      accounts: [{
        accountId: "mock-account-001",
        accountType: "SAVINGS",
        maskedAccountNumber: "•••• 0011",
        accountName: "AA test savings",
        currency: "INR",
        balance: "25000.00",
        availableBalance: "25000.00",
        balanceDate: new Date().toISOString(),
      }],
      transactions: [{
        transactionId: "mock-transaction-001",
        accountId: "mock-account-001",
        type: "CREDIT",
        amount: "25000.00",
        description: "Explicit AA test credit",
        transactionDate: new Date().toISOString(),
        status: "POSTED",
      }],
    };
  }
}

export function getAAGateway(): AAGateway {
  if (!isAAEnabled) throw new ApiError("AA_NOT_CONFIGURED", "Account Aggregator integration is disabled on the API server.", 503);
  return env.AA_PROVIDER === "mock" ? new ExplicitMockGateway() : new RebitGateway();
}

export const aaProviderName = () => env.AA_PROVIDER;

function verifyHmac(body: string, signature: string): boolean {
  if (!env.AA_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", env.AA_WEBHOOK_SECRET).update(body).digest("hex");
  const supplied = signature.replace(/^sha256=/, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

function verifyDetachedJws(body: string, signature: string): boolean {
  if (!env.AA_JWS_PUBLIC_KEY) return false;
  const [protectedHeader, emptyPayload, encodedSignature] = signature.split(".");
  if (!protectedHeader || emptyPayload !== "" || !encodedSignature) return false;
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${protectedHeader}.${base64Url(body)}`);
    verifier.end();
    return verifier.verify(env.AA_JWS_PUBLIC_KEY, encodedSignature, "base64url");
  } catch {
    return false;
  }
}

export function verifyAAWebhookSignature(body: string, headers: { jwsSignature?: string; hmacSignature?: string }): boolean {
  if (headers.jwsSignature && verifyDetachedJws(body, headers.jwsSignature)) return true;
  return Boolean(headers.hmacSignature && verifyHmac(body, headers.hmacSignature));
}
