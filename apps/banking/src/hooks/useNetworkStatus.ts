import { useNetworkState } from "expo-network";

export type NetworkStatus = {
  /** True only when the device is known to be disconnected. */
  offline: boolean;
};

// Ports the demo's use-network-status.ts (navigator.onLine + connection
// listeners) onto expo-network, which covers iOS/Android natively and web
// via the same browser events. An undetermined probe (undefined/null) is
// treated as online — the app must never block on an unknown network state.
export function useNetworkStatus(): NetworkStatus {
  const { isConnected, isInternetReachable } = useNetworkState();
  return { offline: isConnected === false || isInternetReachable === false };
}
