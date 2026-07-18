type ClerkIdentity = {
  firstName?: string | null;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
};

export function getCoachDisplayName(user?: ClerkIdentity | null): string {
  const firstName = user?.firstName?.trim();
  if (firstName) {
    return firstName;
  }

  const fullNameFirstPart = user?.fullName?.trim().split(/\s+/)[0];
  if (fullNameFirstPart) {
    return fullNameFirstPart;
  }

  const emailUsername = user?.primaryEmailAddress?.emailAddress
    ?.trim()
    .split("@")[0];
  return emailUsername || "Customer";
}

export function getLocalCoachGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Welcome back";
}
