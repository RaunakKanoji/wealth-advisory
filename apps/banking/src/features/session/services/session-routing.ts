import type { Href } from "expo-router";

import type { SessionStatus } from "@/src/features/session/models/session";

// Centralized, pure route-protection decisions — consumed only by the four
// group layouts and the root index, so guards are never repeated per screen
// and redirect loops are impossible to write by accident. Each function
// returns the Href to redirect to, or null to render the group's own Stack
// (layouts hold a loading state while "bootstrapping").
//
// "error" always routes to "/" where the root screen renders the bootstrap
// retry UI.

export function getRootRedirect(status: SessionStatus): Href | null {
  switch (status) {
    case "bootstrapping":
    case "error":
      return null;
    case "unauthenticated":
      return "/(public)/welcome";
    case "expired":
      return "/(auth)/sign-in";
    case "onboarding-required":
      return "/(onboarding)";
    case "authenticated":
      return "/(app)/(tabs)";
  }
}

export function getAuthGroupRedirect(status: SessionStatus): Href | null {
  switch (status) {
    case "onboarding-required":
      return "/(onboarding)";
    case "authenticated":
      return "/(app)/(tabs)";
    case "error":
      return "/";
    default:
      // unauthenticated and expired customers belong here; bootstrapping holds.
      return null;
  }
}

export function getOnboardingGroupRedirect(status: SessionStatus): Href | null {
  switch (status) {
    case "unauthenticated":
      return "/(public)/welcome";
    case "expired":
      return "/(auth)/sign-in";
    case "authenticated":
      return "/(app)/(tabs)";
    case "error":
      return "/";
    default:
      return null;
  }
}

export function getAppGroupRedirect(status: SessionStatus): Href | null {
  switch (status) {
    case "unauthenticated":
    case "expired":
      // Protected content requires sign-in; the sign-in screen explains the
      // expired case with a customer-safe notice.
      return "/(auth)/sign-in";
    case "onboarding-required":
      return "/(onboarding)";
    case "error":
      return "/";
    default:
      return null;
  }
}
