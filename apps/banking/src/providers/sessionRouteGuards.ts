import type { Href } from "expo-router";

import type { SessionStatus } from "@/src/types/session";

// Pure redirect-decision functions, extracted out of the (auth)/(onboarding)/
// (app) route group layouts so the routing rules are testable without
// rendering the router itself. Each returns the Href to redirect to, or null
// to render the group's own Stack.

export function getAuthGroupRedirect(status: SessionStatus): Href | null {
  if (status === "onboarding-required") return "/(onboarding)";
  if (status === "active") return "/(app)/(tabs)";
  return null;
}

export function getOnboardingGroupRedirect(status: SessionStatus): Href | null {
  if (status === "unauthenticated" || status === "authentication-in-progress") {
    return "/(public)/welcome";
  }
  if (status === "active") return "/(app)/(tabs)";
  return null;
}

export function getAppGroupRedirect(status: SessionStatus): Href | null {
  if (status === "unauthenticated" || status === "authentication-in-progress") {
    return "/(public)/welcome";
  }
  if (status === "onboarding-required") return "/(onboarding)";
  return null;
}

// Root route ("/") decision. The root index is a pure dispatcher: it sends the
// customer to the shell that matches their session status. Combined with the
// dev shell-preview switch (src/config/devSession.ts), this is what makes the
// public / onboarding / authenticated shells each reachable on boot. Returns
// null only while restoring, so the root can hold a loading state instead of
// bouncing.
export function getRootRedirect(status: SessionStatus): Href | null {
  if (status === "restoring") return null;
  if (status === "onboarding-required") return "/(onboarding)";
  if (status === "active") return "/(app)/(tabs)";
  return "/(public)/welcome";
}
