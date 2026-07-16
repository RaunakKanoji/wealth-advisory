// expo-network's real listener teardown (listener.remove) is not callable in
// the jest environment, so it throws during passive-effect unmount and crashes
// every test that renders a <Screen> (Screen mounts OfflineBanner, which reads
// useNetworkState). Mock it to a stable, reachable state for all tests;
// connectivity-specific tests override this with their own jest.mock.
jest.mock("expo-network", () => ({
  useNetworkState: () => ({
    type: "WIFI",
    isConnected: true,
    isInternetReachable: true,
  }),
}));

// Clerk is exercised only in clerk authentication mode (never in jest — tests
// run with the development default, mock mode) but the adapter/factory import
// chain pulls @clerk/expo in at module load. Stub the surface the app touches
// so no test depends on Clerk internals or native peers.
jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: unknown }) => children,
  getClerkInstance: jest.fn(() => ({ client: null })),
  isClerkAPIResponseError: jest.fn(() => false),
  useAuth: jest.fn(() => ({ isLoaded: true, isSignedIn: false })),
  useUser: jest.fn(() => ({ user: null })),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));

// expo-secure-store has no jest implementation; the session-storage tests
// inject their own in-memory backend, and everything else never reaches it.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});
