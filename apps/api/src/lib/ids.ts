import { randomUUID } from "node:crypto";

/** Prefix remains accepted for existing callers; new records use UUIDs. */
export function id(_prefix: string): string {
  return randomUUID();
}
