import type { Session } from "@/src/types/session";

// PLACEHOLDER — no real persistence yet. Replace with expo-secure-store
// backed reads/writes once real authentication lands; do not store real
// tokens here or anywhere else until that migration happens.

export async function readStoredSession(): Promise<Session | null> {
  return null;
}

export async function writeStoredSession(_session: Session): Promise<void> {}

export async function clearStoredSession(): Promise<void> {}
