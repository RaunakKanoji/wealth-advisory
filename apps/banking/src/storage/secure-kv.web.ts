// Web development/session storage backend. window.sessionStorage is
// per-tab and cleared when the tab closes — an intentional, DOCUMENTED
// development trade-off, NOT secure storage. Production web token handling
// requires a validated strategy (httpOnly cookies via the bank gateway or an
// approved token-handler pattern) before real tokens ever reach a browser.

import type { SecureKeyValueStore } from "./secure-kv";

function getStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    // Some privacy modes throw on any storage access — treat as unavailable.
    return null;
  }
}

export const secureKeyValueStore: SecureKeyValueStore = {
  async getItem(key) {
    return getStore()?.getItem(key) ?? null;
  },
  async setItem(key, value) {
    getStore()?.setItem(key, value);
  },
  async removeItem(key) {
    getStore()?.removeItem(key);
  },
};

export type { SecureKeyValueStore };
