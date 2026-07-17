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

process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fixture";

// Auth component behavior is covered in a native development build. Unit
// tests use a stable signed-out Clerk surface and do not load native peers.
jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useClerk: jest.fn(() => ({ signOut: jest.fn() })),
  useAuth: jest.fn(() => ({ isLoaded: true, isSignedIn: false })),
  useUser: jest.fn(() => ({ user: { id: "user_test" } })),
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
