import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const consentRequestSchema = z.object({
  purposeCode: z.string().trim().regex(/^[A-Za-z0-9._-]{2,32}$/).default("101"),
  purposeText: z.string().trim().min(10).max(240).default("Personal financial management and wealth advisory"),
  fiTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(12).default(["DEPOSIT"]),
  fiSections: z.array(z.string().trim().min(1).max(80)).max(30).default(["PROFILE", "SUMMARY", "TRANSACTIONS"]),
  accountIds: z.array(z.string().trim().min(1)).max(50).default([]),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  fetchType: z.enum(["ONETIME", "PERIODIC"]).default("ONETIME"),
  fetchFrequency: z.string().trim().min(1).max(40).default("1"),
  consentMode: z.enum(["STORE", "VIEW"]).default("STORE"),
  consentDurationDays: z.number().int().min(1).max(3650).default(365),
  dataLifeDays: z.number().int().min(1).max(365).default(30),
}).strict();

export type ConsentRequest = z.infer<typeof consentRequestSchema>;

export type ProviderConsent = {
  providerConsentHandle: string;
  providerConsentId?: string;
  redirectUrl: string;
  status: string;
};

export type ProviderConsentStatus = {
  providerConsentId?: string;
  status: string;
  rawStatus?: string;
};

export type ProviderDataSession = {
  providerSessionId: string;
  status: string;
};

export type AAGateway = {
  createConsent(input: {
    externalAuthId: string;
    consentId: string;
    request: ConsentRequest;
  }): Promise<ProviderConsent>;
  getConsentStatus(input: { providerConsentHandle: string }): Promise<ProviderConsentStatus>;
  requestData(input: {
    providerConsentId: string;
    consentId: string;
    requestedFrom: Date;
    requestedTo: Date;
  }): Promise<ProviderDataSession>;
  fetchData(input: { providerSessionId: string }): Promise<unknown>;
};

export const aaNotificationSchema = z.object({
  ver: z.string().optional(),
  txnid: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  eventType: z.string().trim().min(1).max(80).optional(),
  event: z.string().trim().min(1).max(80).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  notificationType: z.string().trim().min(1).max(80).optional(),
  consentId: z.string().trim().min(1).max(200).optional(),
  consentHandle: z.string().trim().min(1).max(200).optional(),
  sessionId: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(80).optional(),
}).passthrough();

export type AANotification = z.infer<typeof aaNotificationSchema>;

export type NormalizedAAAccount = {
  sourceAccountRef: string;
  accountType: "savings" | "current" | "fixed_deposit" | "recurring_deposit";
  nickname: string;
  maskedAccountNumber: string;
  currency: string;
  institutionId?: string;
  institutionName?: string;
  branchName?: string;
  ifsc?: string;
  ledgerBalance: string;
  availableBalance: string;
  holds: string;
  sourceReportedAt?: Date;
  capabilities: string[];
};

export type NormalizedAATransaction = {
  sourceTransactionId: string;
  sourceAccountRef: string;
  type: "salary" | "purchase" | "bill" | "transfer" | "refund" | "cash" | "deposit" | "interest" | "fee" | "other";
  direction: "credit" | "debit";
  amount: string;
  currency: string;
  description: string;
  merchantName?: string;
  reference?: string;
  transactionAt: Date;
  status: "pending" | "completed" | "failed" | "reversed";
  categorySlug?: string;
  sourceReportedAt?: Date;
};

export type NormalizedAAData = {
  connection: {
    providerConnectionId?: string;
    institutionId?: string;
    institutionName?: string;
  };
  accounts: NormalizedAAAccount[];
  transactions: NormalizedAATransaction[];
  coverageFrom?: Date;
  coverageTo?: Date;
};
