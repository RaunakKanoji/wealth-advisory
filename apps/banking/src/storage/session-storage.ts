import { z } from "zod";

import type {
  AuthenticatedCustomer,
  AuthenticationSession,
} from "@/src/features/authentication/models/authentication";
import { secureKeyValueStore } from "@/src/storage/secure-kv";
import type { SecureKeyValueStore } from "@/src/storage/secure-kv";

// Session persistence boundary. Callers (the session provider) never touch
// the underlying store directly — this interface is what a validated
// production secure-storage policy will slot in behind.
//
// What is stored: session tokens + the small customer summary needed to
// restore routing after a restart. NEVER stored here: OTP values,
// authentication form input, or customer financial data.
//
// Backends: expo-secure-store on native (Keychain/Keystore);
// window.sessionStorage on web as a documented development-only strategy
// (see secure-kv.web.ts — it is NOT secure storage for production tokens).

const STORAGE_KEY = "idbi.wealth.session.v1";

const storedSessionSchema = z.object({
  session: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1).optional(),
    expiresAt: z.iso.datetime(),
  }),
  customer: z.object({
    customerId: z.string().min(1),
    displayName: z.string().optional(),
    onboardingStatus: z.enum([
      "consent-required",
      "profile-required",
      "risk-profile-required",
      "complete",
    ]),
  }),
  storedAt: z.iso.datetime(),
});

export type StoredSession = {
  session: AuthenticationSession;
  customer: AuthenticatedCustomer;
  storedAt: string;
};

export interface SessionStorage {
  getSession(): Promise<StoredSession | null>;
  setSession(session: StoredSession): Promise<void>;
  clearSession(): Promise<void>;
}

/**
 * Creates the app's session storage over a secure key-value backend.
 * Malformed or unparseable payloads are treated as absent and cleared —
 * bootstrap must never crash on corrupted storage.
 */
export function createSessionStorage(
  backend: SecureKeyValueStore = secureKeyValueStore,
): SessionStorage {
  return {
    async getSession() {
      const raw = await backend.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      try {
        const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          await backend.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed.data;
      } catch {
        await backend.removeItem(STORAGE_KEY);
        return null;
      }
    },

    async setSession(session) {
      await backend.setItem(STORAGE_KEY, JSON.stringify(session));
    },

    async clearSession() {
      await backend.removeItem(STORAGE_KEY);
    },
  };
}

export const sessionStorage: SessionStorage = createSessionStorage();
