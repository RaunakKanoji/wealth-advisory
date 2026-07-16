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
