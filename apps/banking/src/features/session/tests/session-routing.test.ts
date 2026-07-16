import type { SessionStatus } from "@/src/features/session/models/session";
import {
  getAppGroupRedirect,
  getAuthGroupRedirect,
  getOnboardingGroupRedirect,
  getRootRedirect,
} from "@/src/features/session/services/session-routing";

const ALL_STATUSES: readonly SessionStatus[] = [
  "bootstrapping",
  "unauthenticated",
  "authenticated",
  "onboarding-required",
  "expired",
  "error",
];

describe("getRootRedirect", () => {
  it("holds on the root screen while bootstrapping", () => {
    expect(getRootRedirect("bootstrapping")).toBeNull();
  });

  it("holds on the root screen on error so the retry UI can render", () => {
    expect(getRootRedirect("error")).toBeNull();
  });

  it("sends unauthenticated customers to the welcome screen", () => {
    expect(getRootRedirect("unauthenticated")).toBe("/(public)/welcome");
  });

  it("sends expired sessions to sign-in", () => {
    expect(getRootRedirect("expired")).toBe("/(auth)/sign-in");
  });

  it("sends incompletely onboarded customers to onboarding", () => {
    expect(getRootRedirect("onboarding-required")).toBe("/(onboarding)");
  });

  it("sends fully authenticated customers to the app tabs", () => {
    expect(getRootRedirect("authenticated")).toBe("/(app)/(tabs)");
  });

  it("never redirects the root back to itself", () => {
    for (const status of ALL_STATUSES) {
      expect(getRootRedirect(status)).not.toBe("/");
    }
  });
});

describe("getAuthGroupRedirect", () => {
  it("moves incompletely onboarded customers out to onboarding", () => {
    expect(getAuthGroupRedirect("onboarding-required")).toBe("/(onboarding)");
  });

  it("moves authenticated customers out to the app tabs", () => {
    expect(getAuthGroupRedirect("authenticated")).toBe("/(app)/(tabs)");
  });

  it("routes error state to the root retry screen", () => {
    expect(getAuthGroupRedirect("error")).toBe("/");
  });

  it("keeps unauthenticated customers in the auth group so sign-in is reachable", () => {
    expect(getAuthGroupRedirect("unauthenticated")).toBeNull();
  });

  it("keeps expired customers in the auth group so sign-in is reachable", () => {
    expect(getAuthGroupRedirect("expired")).toBeNull();
  });

  it("holds while bootstrapping", () => {
    expect(getAuthGroupRedirect("bootstrapping")).toBeNull();
  });

  it("never redirects into an (auth) route for any status", () => {
    for (const status of ALL_STATUSES) {
      const redirect = getAuthGroupRedirect(status);
      if (redirect !== null) {
        expect(typeof redirect).toBe("string");
        expect(redirect).not.toMatch(/^\/\(auth\)/);
      }
    }
  });
});

describe("getOnboardingGroupRedirect", () => {
  it("sends unauthenticated customers to the welcome screen", () => {
    expect(getOnboardingGroupRedirect("unauthenticated")).toBe("/(public)/welcome");
  });

  it("sends expired sessions to sign-in", () => {
    expect(getOnboardingGroupRedirect("expired")).toBe("/(auth)/sign-in");
  });

  it("moves fully authenticated customers out to the app tabs", () => {
    expect(getOnboardingGroupRedirect("authenticated")).toBe("/(app)/(tabs)");
  });

  it("routes error state to the root retry screen", () => {
    expect(getOnboardingGroupRedirect("error")).toBe("/");
  });

  it("keeps onboarding-required customers inside the onboarding group", () => {
    expect(getOnboardingGroupRedirect("onboarding-required")).toBeNull();
  });

  it("holds while bootstrapping", () => {
    expect(getOnboardingGroupRedirect("bootstrapping")).toBeNull();
  });

  it("never redirects into an (onboarding) route for any status", () => {
    for (const status of ALL_STATUSES) {
      const redirect = getOnboardingGroupRedirect(status);
      if (redirect !== null) {
        expect(typeof redirect).toBe("string");
        expect(redirect).not.toMatch(/^\/\(onboarding\)/);
      }
    }
  });
});

describe("getAppGroupRedirect", () => {
  it("sends unauthenticated customers to sign-in", () => {
    expect(getAppGroupRedirect("unauthenticated")).toBe("/(auth)/sign-in");
  });

  it("sends expired sessions to sign-in", () => {
    expect(getAppGroupRedirect("expired")).toBe("/(auth)/sign-in");
  });

  it("sends incompletely onboarded customers to onboarding", () => {
    expect(getAppGroupRedirect("onboarding-required")).toBe("/(onboarding)");
  });

  it("routes error state to the root retry screen", () => {
    expect(getAppGroupRedirect("error")).toBe("/");
  });

  it("keeps authenticated customers inside the app group", () => {
    expect(getAppGroupRedirect("authenticated")).toBeNull();
  });

  it("holds while bootstrapping", () => {
    expect(getAppGroupRedirect("bootstrapping")).toBeNull();
  });

  it("never redirects into an (app) route for any status", () => {
    for (const status of ALL_STATUSES) {
      const redirect = getAppGroupRedirect(status);
      if (redirect !== null) {
        expect(typeof redirect).toBe("string");
        expect(redirect).not.toMatch(/^\/\(app\)/);
      }
    }
  });
});

describe("redirect loop safety across groups", () => {
  it("only the error status routes to the root, and the root never holds it hostage", () => {
    for (const status of ALL_STATUSES) {
      const groupRedirects = [
        getAuthGroupRedirect(status),
        getOnboardingGroupRedirect(status),
        getAppGroupRedirect(status),
      ];

      for (const redirect of groupRedirects) {
        if (redirect === "/") {
          // Any group that punts to the root must find a root that renders
          // in place (returns null) for the same status, or it would bounce.
          expect(status).toBe("error");
          expect(getRootRedirect(status)).toBeNull();
        }
      }
    }
  });

  it("every non-null redirect targets a route group other than the source group", () => {
    const guards: readonly {
      ownPrefix: RegExp;
      guard: (status: SessionStatus) => unknown;
    }[] = [
      { ownPrefix: /^\/\(auth\)/, guard: getAuthGroupRedirect },
      { ownPrefix: /^\/\(onboarding\)/, guard: getOnboardingGroupRedirect },
      { ownPrefix: /^\/\(app\)/, guard: getAppGroupRedirect },
    ];

    for (const { ownPrefix, guard } of guards) {
      for (const status of ALL_STATUSES) {
        const redirect = guard(status);
        if (typeof redirect === "string") {
          expect(redirect).not.toMatch(ownPrefix);
        }
      }
    }
  });
});
