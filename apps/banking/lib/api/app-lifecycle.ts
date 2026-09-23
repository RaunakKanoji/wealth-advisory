import * as Network from "expo-network";
import { focusManager, onlineManager, type QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

function isOnlineState(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Connect React Query to native lifecycle signals.
 *
 * React Query's browser focus/reconnect listeners do not observe React Native
 * AppState or Expo Network events by themselves. Keeping this bridge in one
 * place prevents each screen from inventing its own resume/refetch effect.
 */
export function installQueryLifecycle(queryClient: QueryClient): () => void {
  let appState: AppStateStatus = AppState.currentState;

  const syncNetworkState = (state: Network.NetworkState) => {
    onlineManager.setOnline(isOnlineState(state));
  };

  // Keep the bridge defensive for web/test runtimes that do not expose the
  // native event module, while using the native listener whenever available.
  const networkSubscription = Network.addNetworkStateListener?.(syncNetworkState);
  const appStateSubscription = AppState.addEventListener("change", (nextState) => {
    const resumed = appState !== "active" && nextState === "active";
    appState = nextState;
    focusManager.setFocused(nextState === "active");

    if (resumed) {
      // QueryClient's focus manager refetches active stale queries. Resume
      // paused mutations as well, without clearing the cached screen data.
      void queryClient.resumePausedMutations().catch((error: unknown) => {
        if (__DEV__) console.warn("[QUERY] paused mutation resume failed", error);
      });
    }
  });

  focusManager.setFocused(appState === "active");
  void (Network.getNetworkStateAsync?.() ?? Promise.resolve()).then(syncNetworkState).catch(() => {
    // An unknown network state should not prevent the first API request.
  });

  return () => {
    networkSubscription?.remove();
    appStateSubscription.remove();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  };
}
