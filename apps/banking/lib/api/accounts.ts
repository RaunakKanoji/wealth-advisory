import { apiRequest } from "./client";
import type { AccountsResponse } from "./types";

export type AccountsRequestOptions = {
  signal?: AbortSignal;
  getToken?: () => Promise<string | null>;
};

export function getAccounts(options: AccountsRequestOptions = {}) {
  return apiRequest<AccountsResponse>("/api/v1/accounts/overview", options);
}
