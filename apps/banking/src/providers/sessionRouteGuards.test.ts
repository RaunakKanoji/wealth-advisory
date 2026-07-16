import {
  getAppGroupRedirect,
  getAuthGroupRedirect,
  getOnboardingGroupRedirect,
  getRootRedirect,
} from "@/src/providers/sessionRouteGuards";

describe("getAuthGroupRedirect", () => {
  it("lets an unauthenticated customer reach sign-in (no redirect)", () => {
    expect(getAuthGroupRedirect("unauthenticated")).toBeNull();
  });

  it("redirects an onboarding-required customer away from sign-in, into onboarding", () => {
    expect(getAuthGroupRedirect("onboarding-required")).toBe("/(onboarding)");
  });
});

describe("getOnboardingGroupRedirect", () => {
  it("redirects an unauthenticated customer to welcome", () => {
    expect(getOnboardingGroupRedirect("unauthenticated")).toBe("/(public)/welcome");
  });

  it("lets an onboarding-required customer reach onboarding (no redirect)", () => {
    expect(getOnboardingGroupRedirect("onboarding-required")).toBeNull();
  });
});

describe("session restore (restoring status)", () => {
  it("never redirects while the session is being restored — layouts hold a loading state instead", () => {
    expect(getAuthGroupRedirect("restoring")).toBeNull();
    expect(getOnboardingGroupRedirect("restoring")).toBeNull();
    expect(getAppGroupRedirect("restoring")).toBeNull();
  });
});

describe("getAppGroupRedirect", () => {
  it("blocks an unauthenticated customer from the dashboard, sending them to welcome", () => {
    expect(getAppGroupRedirect("unauthenticated")).toBe("/(public)/welcome");
  });

  it("blocks an authenticated-but-incomplete customer from the dashboard, sending them to onboarding", () => {
    expect(getAppGroupRedirect("onboarding-required")).toBe("/(onboarding)");
  });

  it("lets a fully active customer reach the dashboard (no redirect)", () => {
    expect(getAppGroupRedirect("active")).toBeNull();
  });
});

describe("getRootRedirect", () => {
  it("holds (no redirect) while the session is restoring", () => {
    expect(getRootRedirect("restoring")).toBeNull();
  });

  it("sends an unauthenticated customer to the public welcome shell", () => {
    expect(getRootRedirect("unauthenticated")).toBe("/(public)/welcome");
    expect(getRootRedirect("authentication-in-progress")).toBe("/(public)/welcome");
  });

  it("sends an onboarding-required customer into the onboarding shell", () => {
    expect(getRootRedirect("onboarding-required")).toBe("/(onboarding)");
  });

  it("sends an active customer into the authenticated app shell", () => {
    expect(getRootRedirect("active")).toBe("/(app)/(tabs)");
  });
});
