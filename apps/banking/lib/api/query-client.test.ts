import { ApiError } from "./client";
import { isTransientQueryError } from "./query-client";
import { queryKeys } from "./query-keys";

describe("banking query policy", () => {
  it("uses the same transaction key regardless of filter insertion order", () => {
    expect(queryKeys.transactions.list({ period: "this-month", limit: 30 })).toEqual(
      queryKeys.transactions.list({ limit: 30, period: "this-month" }),
    );
  });

  it("retries only transient API failures", () => {
    expect(isTransientQueryError(new ApiError(503, "DATABASE_CONNECTION_ERROR", "temporary"))).toBe(true);
    expect(isTransientQueryError(new ApiError(0, "NETWORK_ERROR", "offline"))).toBe(true);
    expect(isTransientQueryError(new ApiError(0, "OFFLINE", "offline"))).toBe(false);
    expect(isTransientQueryError(new ApiError(401, "UNAUTHORIZED", "expired"))).toBe(false);
    expect(isTransientQueryError(new ApiError(400, "INVALID_REQUEST", "invalid"))).toBe(false);
  });
});
