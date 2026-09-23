import Constants from "expo-constants";
import { onlineManager } from "@tanstack/react-query";
import { isExplicitDemoAuthEnabled, isRemoteDataEnabled, env } from "@/lib/env";
import { Platform } from "react-native";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryable = (status === 0 && code !== "API_NOT_CONFIGURED" && code !== "OFFLINE") || status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function resolveApiBaseUrl(): string {
  // The URL is an explicit runtime choice: loopback is correct for an iOS
  // simulator, while physical devices must use the host machine's LAN or
  // HTTPS address. During Expo development, a loopback URL is rewritten to
  // the current Metro host so a physical device can reach the local API.
  const configuredBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!configuredBaseUrl || !__DEV__ || Platform.OS === "web") {
    return configuredBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    if (!["localhost", "127.0.0.1"].includes(configuredUrl.hostname)) {
      return configuredBaseUrl;
    }

    // SDK 54 exposes the CLI host through expoConfig during development. In
    // Expo Go, older/alternate manifests may expose the same host only as
    // expoGoConfig.debuggerHost. Supporting both prevents a physical device
    // from trying to call its own 127.0.0.1 address.
    const hostCandidates = [
      Constants.expoConfig?.hostUri,
      Constants.expoGoConfig?.debuggerHost,
    ];
    const expoHost = hostCandidates
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => {
        try {
          return new URL(candidate.includes("://") ? candidate : `http://${candidate}`);
        } catch {
          return undefined;
        }
      })
      .find((candidate) => candidate && !["localhost", "127.0.0.1"].includes(candidate.hostname));

    if (!expoHost) return configuredBaseUrl;

    configuredUrl.hostname = expoHost.hostname;
    return configuredUrl.toString().replace(/\/$/, "");
  } catch {
    return configuredBaseUrl;
  }
}

export function apiErrorMessage(error: unknown, resource = "information"): string {
  if (error instanceof ApiError) {
    if (error.code === "OFFLINE") return "You’re offline. Showing the last available information.";
    if (error.code === "REQUEST_TIMEOUT" || error.code === "DB_TIMEOUT") return `${resource} took too long to respond. Please try again.`;
    if (["DATABASE_UNAVAILABLE", "DATABASE_TIMEOUT", "DATABASE_CONNECTION_ERROR", "FINANCIAL_DATA_UNAVAILABLE"].includes(error.code)) return `${resource} is temporarily unavailable. Please try again.`;
    if (["MODEL_NOT_CONFIGURED", "MODEL_AUTH_FAILED", "MODEL_UNAVAILABLE", "MODEL_RATE_LIMITED", "MODEL_REQUEST_INVALID", "MODEL_TIMEOUT", "MODEL_INCOMPLETE", "MODEL_INVALID_RESPONSE"].includes(error.code)) return "Wealth Coach is temporarily unavailable. Your financial data was not changed.";
    if (["AUTH_NOT_CONFIGURED", "UNAUTHORIZED", "USER_NOT_PROVISIONED", "USER_INACTIVE"].includes(error.code)) return "Please sign in again to view your account information.";
    if (error.status === 0) return "We couldn’t reach the banking service. Check your connection and try again.";
    if (error.status === 401 || error.status === 403) return "Please sign in again to view your account information.";
    if (error.status === 503) return `${resource} is temporarily unavailable. Please try again.`;
  }
  return `${resource} is temporarily unavailable. Please try again.`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  getToken?: () => Promise<string | null>;
  demoAuthId?: string;
  timeoutMs?: number;
};

const REQUEST_TIMEOUT_MS = 15_000;
const tokenFlights = new WeakMap<NonNullable<RequestOptions["getToken"]>, Promise<string | null>>();
let didLogApiBaseUrl = false;

function createRequestId(): string {
  return `mobile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getTokenOnce(getToken: NonNullable<RequestOptions["getToken"]>): Promise<string | null> {
  const current = tokenFlights.get(getToken);
  if (current) return current;
  const pending = getToken().finally(() => tokenFlights.delete(getToken));
  tokenFlights.set(getToken, pending);
  return pending;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  if (!isRemoteDataEnabled || !baseUrl) throw new ApiError(0, "API_NOT_CONFIGURED", "The banking API is not configured.");
  if (onlineManager.isOnline() === false) {
    throw new ApiError(0, "OFFLINE", "The device is offline.");
  }
  const demoAuthId = isExplicitDemoAuthEnabled ? options.demoAuthId ?? env.EXPO_PUBLIC_DEMO_AUTH_ID : undefined;
  const method = options.method ?? "GET";
  const requestId = createRequestId();
  const startedAt = Date.now();
  if (process.env.NODE_ENV !== "production") {
    if (!didLogApiBaseUrl) {
      console.info("[API] Base URL:", baseUrl);
      didLogApiBaseUrl = true;
    }
    console.info(`[API CLIENT] ${method} ${baseUrl}${path}`, { requestId });
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    // In non-production builds the API explicitly runs in demo mode. Avoid
    // sending an unrelated Clerk token when selecting the seeded identity.
    const token = demoAuthId ? null : options.getToken ? await getTokenOnce(options.getToken) : null;
    if (process.env.NODE_ENV !== "production") {
      console.info("[AUTH] token attached", token ? "yes" : "no", {
        mode: demoAuthId ? "demo-header" : token ? "clerk-bearer" : "none",
        demoIdentity: Boolean(demoAuthId),
        requestId,
      });
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "x-request-id": requestId,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(demoAuthId ? { "x-demo-auth-id": demoAuthId } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string; retryable?: boolean } } | T | null;
    const responseRequestId = response.headers.get("x-request-id") ?? requestId;
    if (process.env.NODE_ENV !== "production") {
      console.info("[API] response", { method, path, status: response.status, requestId: responseRequestId, durationMs: Date.now() - startedAt });
    }
    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
      throw new ApiError(response.status, error?.code ?? "API_ERROR", error?.message ?? "The request could not be completed.", responseRequestId, error?.retryable);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError || isAbortError(error)) {
      if (timedOut) throw new ApiError(0, "REQUEST_TIMEOUT", "The banking service took too long to respond. Please try again.", requestId);
      throw error;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[API] request failed", { method, path, requestId, durationMs: Date.now() - startedAt });
    }
    throw new ApiError(0, "NETWORK_ERROR", "We couldn’t reach the banking service. Check your connection and try again.", requestId);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
