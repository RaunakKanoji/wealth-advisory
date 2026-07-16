import type { SecureKeyValueStore } from "@/src/storage/secure-kv";
import { createSessionStorage } from "@/src/storage/session-storage";
import type { StoredSession } from "@/src/storage/session-storage";

// Storage boundary behavior: round-trips valid payloads, and treats anything
// malformed or schema-invalid as absent while wiping the corrupted entry so
// bootstrap never crashes on bad storage.

type MemoryBackend = {
  backend: SecureKeyValueStore;
  store: Map<string, string>;
  getItem: jest.Mock<Promise<string | null>, [string]>;
  setItem: jest.Mock<Promise<void>, [string, string]>;
  removeItem: jest.Mock<Promise<void>, [string]>;
};

function createMemoryBackend(): MemoryBackend {
  const store = new Map<string, string>();
  const getItem = jest.fn<Promise<string | null>, [string]>(
    async (key) => store.get(key) ?? null,
  );
  const setItem = jest.fn<Promise<void>, [string, string]>(async (key, value) => {
    store.set(key, value);
  });
  const removeItem = jest.fn<Promise<void>, [string]>(async (key) => {
    store.delete(key);
  });
  return { backend: { getItem, setItem, removeItem }, store, getItem, setItem, removeItem };
}

// Deterministic, fictional development-style payload (see the mock adapter's
// dev-* token convention) — never a real credential.
function makeStoredSession(): StoredSession {
  return {
    session: {
      accessToken: "dev-access-token",
      refreshToken: "dev-refresh-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    customer: {
      customerId: "dev-cust-0212",
      displayName: "Priya",
      onboardingStatus: "complete",
    },
    storedAt: new Date().toISOString(),
  };
}

/** Persist a valid session, then report the single backend key it used —
 *  lets corruption tests overwrite the entry without hardcoding the key. */
async function seedAndGetKey(
  storage: ReturnType<typeof createSessionStorage>,
  store: Map<string, string>,
): Promise<string> {
  await storage.setSession(makeStoredSession());
  const keys = Array.from(store.keys());
  expect(keys).toHaveLength(1);
  return keys[0];
}

describe("createSessionStorage", () => {
  it("returns null when nothing has been stored, without clearing anything", async () => {
    const { backend, removeItem } = createMemoryBackend();
    const storage = createSessionStorage(backend);

    await expect(storage.getSession()).resolves.toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it("round-trips a stored session through set and get", async () => {
    const { backend } = createMemoryBackend();
    const storage = createSessionStorage(backend);
    const stored = makeStoredSession();

    await storage.setSession(stored);

    await expect(storage.getSession()).resolves.toEqual(stored);
  });

  it("clearSession removes the persisted session", async () => {
    const { backend, store } = createMemoryBackend();
    const storage = createSessionStorage(backend);
    await storage.setSession(makeStoredSession());

    await storage.clearSession();

    await expect(storage.getSession()).resolves.toBeNull();
    expect(store.size).toBe(0);
  });

  it("treats malformed JSON as absent and clears the corrupted entry", async () => {
    const { backend, store, removeItem } = createMemoryBackend();
    const storage = createSessionStorage(backend);
    const key = await seedAndGetKey(storage, store);
    store.set(key, "{ this is not valid json");

    await expect(storage.getSession()).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith(key);
    expect(store.size).toBe(0);
  });

  it("treats a schema-invalid payload (missing accessToken) as absent and clears it", async () => {
    const { backend, store, removeItem } = createMemoryBackend();
    const storage = createSessionStorage(backend);
    const key = await seedAndGetKey(storage, store);
    const valid = makeStoredSession();
    store.set(
      key,
      JSON.stringify({
        session: {
          refreshToken: valid.session.refreshToken,
          expiresAt: valid.session.expiresAt,
        },
        customer: valid.customer,
        storedAt: valid.storedAt,
      }),
    );

    await expect(storage.getSession()).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith(key);
    expect(store.size).toBe(0);
  });
});
