import { apiRequest } from "./client";
import type { ApiAccount, ApiCard, ApiCardTransaction } from "./types";

export type CardRequestOptions = {
  signal?: AbortSignal;
  getToken?: () => Promise<string | null>;
};

export function getRemoteCard(cardId: string, options: CardRequestOptions = {}) {
  return apiRequest<ApiCard>(`/api/v1/cards/${encodeURIComponent(cardId)}`, options);
}

export function getRemoteCardTransactions(cardId: string, options: CardRequestOptions = {}) {
  return apiRequest<{ items: ApiCardTransaction[] }>(`/api/v1/cards/${encodeURIComponent(cardId)}/transactions`, options);
}

export function getRemoteAccount(accountId: string, options: CardRequestOptions = {}) {
  return apiRequest<ApiAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}`, options);
}

export function updateRemoteCardControls(cardId: string, controls: Partial<NonNullable<ApiCard["controls"]>>, options: CardRequestOptions = {}) {
  return apiRequest<ApiCard>(`/api/v1/cards/${encodeURIComponent(cardId)}/controls`, { ...options, method: "PATCH", body: controls });
}

export function updateRemoteCardStatus(cardId: string, status: "active" | "temporarily_blocked", options: CardRequestOptions = {}) {
  return apiRequest<ApiCard>(`/api/v1/cards/${encodeURIComponent(cardId)}/status`, { ...options, method: "PATCH", body: { status } });
}

export function blockRemoteCard(cardId: string, options: CardRequestOptions = {}) {
  return apiRequest<ApiCard>(`/api/v1/cards/${encodeURIComponent(cardId)}/block`, { ...options, method: "POST" });
}

export function updateRemoteCardNickname(cardId: string, nickname: string, options: CardRequestOptions = {}) {
  return apiRequest<ApiCard>(`/api/v1/cards/${encodeURIComponent(cardId)}/nickname`, { ...options, method: "PATCH", body: { nickname } });
}
