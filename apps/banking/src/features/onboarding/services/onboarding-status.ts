import type { useUser } from "@clerk/expo";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

// Where the customer's onboarding progress lives until the bank profile
// service exists: Clerk user metadata. publicMetadata (bank/backoffice
// controlled) always wins; unsafeMetadata is the client-writable fallback the
// completion screen sets — acceptable for the development build only.

function readStatus(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "onboardingStatus" in metadata) {
    const value = (metadata as { onboardingStatus?: unknown }).onboardingStatus;
    return typeof value === "string" ? value : null;
  }
  return null;
}

export function isOnboardingComplete(user: ClerkUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  const status = readStatus(user.publicMetadata) ?? readStatus(user.unsafeMetadata);
  return status === "complete";
}
