import { renderHook } from "@testing-library/react-native";
// @ts-expect-error -- react-native's internal module path has no bundled type declarations
import useWindowDimensionsMock from "react-native/Libraries/Utilities/useWindowDimensions";

import { useBreakpoint } from "@/src/hooks/useBreakpoint";

// Mocking the specific internal module (rather than spying on the
// react-native barrel export) avoids re-evaluating the whole react-native
// module graph and reliably intercepts what useBreakpoint actually calls.
// Jest hoists this call above the imports above at transform time.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions");

const mockedUseWindowDimensions = useWindowDimensionsMock as jest.Mock;

function mockWindowDimensions(width: number, height: number) {
  mockedUseWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}

describe("useBreakpoint", () => {
  it("returns compact below the medium breakpoint", async () => {
    mockWindowDimensions(400, 800);

    const { result } = await renderHook(() => useBreakpoint());

    expect(result.current).toBe("compact");
  });

  it("returns medium at the medium breakpoint", async () => {
    mockWindowDimensions(800, 1024);

    const { result } = await renderHook(() => useBreakpoint());

    expect(result.current).toBe("medium");
  });

  it("returns expanded at the expanded breakpoint", async () => {
    mockWindowDimensions(1200, 900);

    const { result } = await renderHook(() => useBreakpoint());

    expect(result.current).toBe("expanded");
  });
});
