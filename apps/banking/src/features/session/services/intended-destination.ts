// Lightweight intended-destination memory: when an unauthenticated or
// expired customer is bounced off a protected route, the (app) layout records
// where they were headed; after a successful sign-in a fully onboarded
// customer resumes there. Deliberately minimal — in-memory only (never
// persisted), single slot, cleared on sign-out/expiry and after use.
// Incomplete customers go to onboarding instead and the slot is dropped.

let intendedDestination: string | null = null;

export function setIntendedDestination(path: string): void {
  // Only protected application paths are worth resuming.
  intendedDestination = path.startsWith("/") ? path : null;
}

export function consumeIntendedDestination(): string | null {
  const destination = intendedDestination;
  intendedDestination = null;
  return destination;
}

export function clearIntendedDestination(): void {
  intendedDestination = null;
}
