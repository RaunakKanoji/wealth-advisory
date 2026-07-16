import * as SecureStore from "expo-secure-store";

// Native secure key-value backend (iOS Keychain / Android Keystore via
// expo-secure-store). Web builds resolve secure-kv.web.ts instead — Metro
// picks the .web variant automatically; do not import this file directly.

export interface SecureKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const secureKeyValueStore: SecureKeyValueStore = {
  async getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
