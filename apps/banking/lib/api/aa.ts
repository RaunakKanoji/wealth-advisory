import { apiRequest } from "./client";
import type { AAConsent, CreateAAConsentResponse } from "./types";

export type AAConsentRequest = {
  purposeCode: string;
  purposeText: string;
  fiTypes: string[];
  fiSections: string[];
  accountIds: string[];
  fromDate?: string;
  toDate?: string;
  fetchType: "ONETIME" | "PERIODIC";
  fetchFrequency: string;
  consentMode: "STORE" | "VIEW";
  consentDurationDays: number;
  dataLifeDays: number;
};

export function createAAConsent(body: AAConsentRequest, getToken: () => Promise<string | null>) {
  return apiRequest<CreateAAConsentResponse>("/api/v1/aa/consents", { method: "POST", body, getToken });
}

export function listAAConsents(getToken: () => Promise<string | null>) {
  return apiRequest<{ items: AAConsent[] }>("/api/v1/aa/consents", { getToken });
}

export function syncAAConsent(consentId: string, getToken: () => Promise<string | null>) {
  return apiRequest<{ consent: AAConsent; session: { id: string; status: string } | null }>(`/api/v1/aa/consents/${encodeURIComponent(consentId)}/sync`, { method: "POST", getToken });
}
