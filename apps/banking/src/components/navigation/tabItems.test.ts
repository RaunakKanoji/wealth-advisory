import { isTabActive, TAB_ITEMS } from "@/src/components/navigation/tabItems";

describe("TAB_ITEMS", () => {
  it("declares exactly the five primary destinations, in order", () => {
    expect(TAB_ITEMS.map((item) => item.name)).toEqual([
      "index",
      "goals",
      "portfolio",
      "copilot",
      "profile",
    ]);
  });

  it("gives every destination an accessible label and an icon", () => {
    for (const item of TAB_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("isTabActive", () => {
  const home = TAB_ITEMS[0];
  const goals = TAB_ITEMS[1];

  it("treats the home tab as active only at the group root path", () => {
    expect(isTabActive("/", home)).toBe(true);
    expect(isTabActive("/goals", home)).toBe(false);
  });

  it("matches a tab on its own path and on nested paths under it", () => {
    expect(isTabActive("/goals", goals)).toBe(true);
    expect(isTabActive("/goals/123", goals)).toBe(true);
  });

  it("does not match a sibling whose name is a prefix collision", () => {
    // "/goalsomething" must not activate the "goals" tab.
    expect(isTabActive("/goalsomething", goals)).toBe(false);
  });

  it("leaves the home tab inactive on any non-root path", () => {
    expect(isTabActive("/portfolio", home)).toBe(false);
  });
});
