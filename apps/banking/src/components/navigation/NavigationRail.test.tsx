import { fireEvent } from "@testing-library/react-native";
import { usePathname, useRouter } from "expo-router";

import { NavigationRail } from "@/src/components/navigation/NavigationRail";
import { isTabActive, TAB_ITEMS } from "@/src/components/navigation/tabItems";
import { render } from "@/src/testing/render";

jest.mock("expo-router", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

describe("isTabActive", () => {
  const goals = TAB_ITEMS.find((item) => item.name === "goals")!;
  const home = TAB_ITEMS.find((item) => item.name === "index")!;

  it("matches the home tab only on the root path", () => {
    expect(isTabActive("/", home)).toBe(true);
    expect(isTabActive("/goals", home)).toBe(false);
  });

  it("matches a tab on its path and nested paths, not on prefixes of other routes", () => {
    expect(isTabActive("/goals", goals)).toBe(true);
    expect(isTabActive("/goals/123", goals)).toBe(true);
    expect(isTabActive("/goals-archive", goals)).toBe(false);
    expect(isTabActive("/", goals)).toBe(false);
  });
});

describe("NavigationRail", () => {
  it("renders every primary destination and marks the current one selected", async () => {
    (usePathname as jest.Mock).mockReturnValue("/portfolio");
    (useRouter as jest.Mock).mockReturnValue({ navigate: jest.fn() });

    const { getByRole } = await render(<NavigationRail />);

    for (const item of TAB_ITEMS) {
      expect(getByRole("tab", { name: item.label })).toBeTruthy();
    }
    expect(
      getByRole("tab", { name: "Portfolio" }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      getByRole("tab", { name: "Home" }).props.accessibilityState.selected,
    ).toBe(false);
  });

  it("navigates to the destination on press", async () => {
    const navigate = jest.fn();
    (usePathname as jest.Mock).mockReturnValue("/");
    (useRouter as jest.Mock).mockReturnValue({ navigate });

    const { getByRole } = await render(<NavigationRail />);

    await fireEvent.press(getByRole("tab", { name: "Goals" }));

    expect(navigate).toHaveBeenCalledWith("/(app)/(tabs)/goals");
  });
});
