export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly retryable = status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string; message?: string };
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P01", "57P03", "53300", "08000", "08001", "08003", "08004", "08006", "08007", "08S01"].includes(candidate.code ?? "")
    || /timeout|connection|socket/i.test(`${candidate.name ?? ""} ${candidate.message ?? ""}`);
}

function isDatabaseTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string; message?: string };
  return candidate.code === "ETIMEDOUT" || /timeout|timed out/i.test(`${candidate.name ?? ""} ${candidate.message ?? ""}`);
}

export function errorResponse(error: unknown, requestId?: string) {
  if (error instanceof ApiError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, retryable: error.retryable, ...(requestId ? { requestId } : {}) } } };
  }
  if (isTransientDatabaseError(error)) {
    const timeout = isDatabaseTimeoutError(error);
    return { status: 503, body: { error: { code: timeout ? "DATABASE_TIMEOUT" : "DATABASE_CONNECTION_ERROR", message: "The banking data service is temporarily unavailable. Please try again.", retryable: true, ...(requestId ? { requestId } : {}) } } };
  }
  console.error("Unhandled API error", { requestId, errorType: error instanceof Error ? error.name : "unknown error" });
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", retryable: false, ...(requestId ? { requestId } : {}) } } };
}
