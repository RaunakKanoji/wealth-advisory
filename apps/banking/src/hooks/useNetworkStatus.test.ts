import { renderHook } from "@testing-library/react-native";
import type { NetworkState } from "expo-network";
import { useNetworkState } from "expo-network";

import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";

jest.mock("expo-network", () => ({
  useNetworkState: jest.fn(),
}));

const mockUseNetworkState = useNetworkState as jest.MockedFunction<typeof useNetworkState>;

function withState(state: Partial<NetworkState>) {
  mockUseNetworkState.mockReturnValue(state as NetworkState);
}

describe("useNetworkStatus", () => {
  it("reports online when connected and reachable", async () => {
    withState({ isConnected: true, isInternetReachable: true });
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current.offline).toBe(false);
  });

  it("reports offline when the connection is lost", async () => {
    withState({ isConnected: false, isInternetReachable: false });
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current.offline).toBe(true);
  });

  it("reports offline when connected but the internet is unreachable", async () => {
    withState({ isConnected: true, isInternetReachable: false });
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current.offline).toBe(true);
  });

  it("treats an undetermined probe as online so the app never blocks on unknown state", async () => {
    withState({});
    const undetermined = await renderHook(() => useNetworkStatus());
    expect(undetermined.result.current.offline).toBe(false);

    withState({ isConnected: undefined, isInternetReachable: undefined });
    const explicitlyUndefined = await renderHook(() => useNetworkStatus());
    expect(explicitlyUndefined.result.current.offline).toBe(false);
  });
});
