import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { ApiError, apiRequest } from "./client";
import { getAccounts } from "./accounts";
import { createAAConsent, listAAConsents, syncAAConsent, type AAConsentRequest } from "./aa";
import { queryKeys } from "./query-keys";
import type {
  AccountsResponse,
  ApiBeneficiary,
  ApiCard,
  ApiGoal,
  ApiInsight,
  ApiService,
  ApiTransfer,
  CoachConversationMessagesResponse,
  CoachConversationsResponse,
  CoachMessageResponse,
  NotificationsResponse,
  TransactionsResponse,
  WealthSummaryResponse,
} from "./types";
import { apiAccountsResponseToOverview } from "./view-models";
import { env, isExplicitDemoAuthEnabled, isFinancialAuthReady, isRemoteDataEnabled } from "@/lib/env";
import { useStableGetToken } from "@/lib/api/use-stable-get-token";

function useTokenQuery<TQueryData, TSelectedData = TQueryData>(queryKey: readonly unknown[], path: string, options?: {
  enabled?: boolean;
  staleTime?: number;
  keepPreviousData?: boolean;
  queryFn?: (input: { signal: AbortSignal; getToken: () => Promise<string | null> }) => Promise<TQueryData>;
  select?: (data: TQueryData) => TSelectedData;
}) {
  const { getToken: clerkGetToken, isLoaded, isSignedIn, userId } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  // The demo header is the actual backend identity in development. Include it
  // in the cache key so an empty response for another user cannot survive a
  // Clerk transition or Expo Fast Refresh and mask the seeded demo accounts.
  const customerScope = isExplicitDemoAuthEnabled
    ? `demo:${env.EXPO_PUBLIC_DEMO_AUTH_ID}`
    : userId ?? "signed-out";
  return useQuery<TQueryData, Error, TSelectedData>({
    queryKey: [...queryKey, customerScope],
    enabled: isRemoteDataEnabled && isFinancialAuthReady(isLoaded, isSignedIn) && options?.enabled !== false,
    staleTime: options?.staleTime,
    placeholderData: options?.keepPreviousData
      ? (previousData, previousQuery) => previousQuery?.queryKey.at(-1) === customerScope ? previousData : undefined
      : undefined,
    queryFn: async ({ signal }) => {
      const result = await (options?.queryFn ? options.queryFn({ signal, getToken }) : apiRequest<TQueryData>(path, { signal, getToken }));
      if (path === "/api/v1/accounts/overview" && process.env.NODE_ENV !== "production") {
        const accountCount = result && typeof result === "object" && "accounts" in result && Array.isArray(result.accounts) ? result.accounts.length : 0;
        console.info("[CLIENT] accounts query success", { accountCount });
      }
      return result;
    },
    select: options?.select,
    retry: (failureCount, error) => !(error instanceof ApiError && !error.retryable) && failureCount < 2,
  });
}

export function useAccounts(enabled = true) {
  return useTokenQuery<AccountsResponse>(queryKeys.accounts.all, "/api/v1/accounts/overview", {
    enabled,
    staleTime: 45_000,
    queryFn: ({ signal, getToken }) => getAccounts({ signal, getToken }),
  });
}
export type FinancialDataStatus = "loading" | "ready" | "empty" | "refreshing" | "unavailable";

export function deriveFinancialDataStatus(input: {
  data?: AccountsResponse;
  isPending: boolean;
  isFetching: boolean;
  error?: unknown;
}): FinancialDataStatus {
  if (!isRemoteDataEnabled) return "ready";
  if (!input.data && input.isPending) return "loading";
  if (input.error && !input.data) return "unavailable";
  if (input.data?.accounts.length === 0) return "empty";
  return input.isFetching ? "refreshing" : "ready";
}

/**
 * Canonical owner-scoped financial data boundary for the root financial tabs.
 * Home and Accounts intentionally consume this same query and view model so a
 * refresh/error cannot leave them showing different account truths.
 */
export function useFinancialData(enabled = true) {
  const accounts = useAccounts(enabled);
  const normalized = useMemo(() => {
    if (!accounts.data) return { overview: null, error: undefined as Error | undefined };
    try {
      return { overview: apiAccountsResponseToOverview(accounts.data), error: undefined as Error | undefined };
    } catch {
      return { overview: null, error: new Error("The accounts response could not be displayed.") };
    }
  }, [accounts.data]);
  const error = accounts.error ?? normalized.error;
  const status = normalized.error
    ? "unavailable" as const
    : deriveFinancialDataStatus({ ...accounts, error });

  return {
    ...accounts,
    overview: normalized.overview,
    error,
    status,
    hasCachedData: Boolean(accounts.data),
    hasUsableData: Boolean(accounts.data?.accounts.length),
  };
}
export function useAAConsents() {
  return useTokenQuery<{ items: import("./types").AAConsent[] }>(["aa", "consents"], "/api/v1/aa/consents", { staleTime: 10_000, queryFn: ({ getToken }) => listAAConsents(getToken) });
}
export function useCreateAAConsent() {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AAConsentRequest) => createAAConsent(body, getToken),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["aa", "consents"] }); },
  });
}
export function useSyncAAConsent(consentId?: string) {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestedConsentId: string | void) => {
      const targetConsentId = requestedConsentId ?? consentId;
      if (!targetConsentId) throw new Error("An Account Aggregator consent is required before syncing.");
      return syncAAConsent(targetConsentId, getToken);
    },
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["aa", "consents"] }), queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }), queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }), queryClient.invalidateQueries({ queryKey: queryKeys.wealth.summary })]); },
  });
}
export function useAccount(id: string) { return useTokenQuery<AccountsResponse["accounts"][number]>(queryKeys.accounts.detail(id), `/api/v1/accounts/${encodeURIComponent(id)}`); }
export function useTransactions(filters: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return useTokenQuery<TransactionsResponse>(queryKeys.transactions.list(filters), `/api/v1/transactions${params.toString() ? `?${params.toString()}` : ""}`, { keepPreviousData: true });
}
export function useBeneficiaries() { return useTokenQuery<{ items: ApiBeneficiary[] }>(queryKeys.beneficiaries.all, "/api/v1/beneficiaries"); }
export function useTransfers() { return useTokenQuery<{ items: ApiTransfer[] }>(queryKeys.transfers.all, "/api/v1/transfers"); }
export function useCards(accountId?: string) { return useTokenQuery<{ cards: ApiCard[] }>(queryKeys.cards.list(accountId), `/api/v1/cards${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`); }
export function useNotifications(type = "all") { return useTokenQuery<NotificationsResponse>(queryKeys.notifications.list(type), `/api/v1/notifications?type=${encodeURIComponent(type)}`, { staleTime: 20_000 }); }
export function useNotificationPreferences() { return useTokenQuery<Record<string, boolean>>(queryKeys.notifications.preferences, "/api/v1/notification-preferences", { staleTime: 60_000 }); }
export function useWealthSummary() { return useTokenQuery<WealthSummaryResponse>(queryKeys.wealth.summary, "/api/v1/wealth/summary", { staleTime: 60_000 }); }
export function useInsights() { return useTokenQuery<{ items: ApiInsight[] }>(queryKeys.wealth.insights, "/api/v1/wealth/insights", { staleTime: 60_000 }); }
export function useGoals() { return useTokenQuery<{ items: ApiGoal[] }>(queryKeys.wealth.goals, "/api/v1/wealth/goals", { staleTime: 60_000 }); }
export function useCoachConversations(enabled = true) { return useTokenQuery<CoachConversationsResponse>(queryKeys.coach.conversations, "/api/v1/coach/conversations", { enabled, staleTime: 30_000 }); }
export function useCoachConversationMessages(conversationId?: string) {
  const encodedConversationId = encodeURIComponent(conversationId ?? "pending");
  return useTokenQuery<CoachConversationMessagesResponse>(
    queryKeys.coach.messages(conversationId ?? "pending"),
    `/api/v1/coach/conversations/${encodedConversationId}/messages`,
    { enabled: Boolean(conversationId), staleTime: 10_000 },
  );
}
export function useServiceCatalog() { return useTokenQuery<{ items: ApiService[] }>(queryKeys.services.catalog, "/api/v1/services", { staleTime: 10 * 60_000 }); }
export function useServiceFavorites() { return useTokenQuery<{ items: ApiService[] }>(queryKeys.services.favorites, "/api/v1/services/favorites", { staleTime: 10 * 60_000 }); }

function useTokenMutation<TBody, TResult>(path: string, method: "POST" | "PATCH" | "DELETE", invalidates: readonly (readonly unknown[])[]) {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => apiRequest<TResult>(path, { method, body: method === "DELETE" ? undefined : body, getToken }),
    onSuccess: async () => { await Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: key }))); },
  });
}

export function useCreateBeneficiary() { return useTokenMutation<unknown, { beneficiary: ApiBeneficiary }>("/api/v1/beneficiaries", "POST", [queryKeys.beneficiaries.all]); }
export function useCreateTransferDraft() { return useTokenMutation<unknown, { transfer: ApiTransfer }>("/api/v1/transfers/draft", "POST", [queryKeys.transfers.all, queryKeys.accounts.all]); }
export function useReviewTransfer(id: string) { return useTokenMutation<Record<string, never>, { transfer: ApiTransfer }>(`/api/v1/transfers/${encodeURIComponent(id)}/review`, "POST", [queryKeys.transfers.all, queryKeys.transfers.detail(id)]); }
export function useSubmitTransfer(id: string) { return useTokenMutation<Record<string, never>, { transfer: ApiTransfer }>(`/api/v1/transfers/${encodeURIComponent(id)}/submit`, "POST", [queryKeys.transfers.all, queryKeys.transfers.detail(id), queryKeys.accounts.all, queryKeys.notifications.all]); }
export function useUpdateCardControls(id: string) { return useTokenMutation<NonNullable<ApiCard["controls"]>, ApiCard>(`/api/v1/cards/${encodeURIComponent(id)}/controls`, "PATCH", [queryKeys.cards.all, queryKeys.cards.detail(id)]); }
export function useUpdateCardStatus(id: string) { return useTokenMutation<{ status: "active" | "temporarily_blocked" }, ApiCard>(`/api/v1/cards/${encodeURIComponent(id)}/status`, "PATCH", [queryKeys.cards.all, queryKeys.cards.detail(id)]); }
export function useBlockCard(id: string) { return useTokenMutation<Record<string, never>, ApiCard>(`/api/v1/cards/${encodeURIComponent(id)}/block`, "POST", [queryKeys.cards.all, queryKeys.cards.detail(id), queryKeys.notifications.all]); }
export function useMarkNotificationRead() {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<{ id: string; isRead: boolean }>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", getToken }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }); },
  });
}
export function useMarkAllNotificationsRead() { return useTokenMutation<undefined, { updatedCount: number }>("/api/v1/notifications/read-all", "POST", [queryKeys.notifications.all]); }
export function useUpdateNotificationPreferences() { return useTokenMutation<unknown, Record<string, boolean>>("/api/v1/notification-preferences", "PATCH", [queryKeys.notifications.preferences]); }
export function useToggleServiceFavorite(id: string, favorite: boolean) { return useTokenMutation<Record<string, never>, { serviceId: string; isFavorite: boolean }>(`/api/v1/services/${encodeURIComponent(id)}/favorite`, favorite ? "POST" : "DELETE", [queryKeys.services.catalog, queryKeys.services.favorites]); }
export function useCreateCoachConversation() {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ signal, ...body }: { firstMessage: string; title?: string; requestId?: string; scope?: Record<string, string | undefined>; signal?: AbortSignal }) => apiRequest<CoachMessageResponse>("/api/v1/coach/conversations", { method: "POST", body, getToken, signal, timeoutMs: 75_000 }),
    onSuccess: async ({ conversation }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coach.conversations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coach.messages(conversation.id) }),
      ]);
    },
  });
}

export function useSendCoachMessage(conversationId?: string) {
  const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
  const getToken = useStableGetToken(clerkGetToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ signal, ...body }: { message: string; requestId?: string; signal?: AbortSignal }) => {
      if (!conversationId) {
        throw new ApiError(0, "CONVERSATION_REQUIRED", "A persisted Coach conversation is required.", undefined, false);
      }
      return apiRequest<CoachMessageResponse>(`/api/v1/coach/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body, getToken, signal, timeoutMs: 75_000 });
    },
    onSuccess: async () => {
      if (!conversationId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coach.conversations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coach.messages(conversationId) }),
      ]);
    },
  });
}

export function useCoachConsent() { return useTokenQuery<{granted:boolean}>(['coach','consent'], '/api/v1/coach/consent'); }
export function useSetCoachConsent() { return useTokenMutation<{granted:boolean},{granted:boolean}>('/api/v1/coach/consent','POST',[['coach','consent']]); }
export function useCancelCoachRun() {
 const { getToken: clerkGetToken } = useAuth({ treatPendingAsSignedOut: false });
 const getToken = useStableGetToken(clerkGetToken);
 return useMutation({mutationFn:(runId:string)=>apiRequest(`/api/v1/coach/runs/${encodeURIComponent(runId)}/cancel`,{method:'POST',getToken})});
}
export function useCoachReports() { return useTokenQuery<{items:{report:{id:string;title:string;messageId:string;createdAt:string};message:import('./types').ApiMessage}[]}>(['coach','reports'],'/api/v1/coach/reports'); }
export function useSaveCoachReport() { return useTokenMutation<{messageId:string;title:string},unknown>('/api/v1/coach/reports','POST',[['coach','reports']]); }
export function useSaveGoalContribution(goalId:string) { return useTokenMutation<{monthlyContribution:string},unknown>(`/api/v1/wealth/goals/${encodeURIComponent(goalId)}`,'PATCH',[queryKeys.wealth.goals,queryKeys.wealth.summary]); }
export function useCoachAnswerSources(messageId:string,page:number,enabled:boolean) { return useTokenQuery<{items:import('./types').ApiCoachTransaction[];page:number;totalPages:number;totalItems:number;dataAsOf?:string|null;calculation?:string}>(['coach','sources',messageId,page],`/api/v1/coach/messages/${encodeURIComponent(messageId)}/sources?page=${page}`,{enabled}); }
