import { Platform } from "react-native";

import { env } from "@/lib/env";

function normalizeBaseUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

export function resolveApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error("API paths must start with /");
  }

  const baseUrl = normalizeBaseUrl(env.EXPO_PUBLIC_API_BASE_URL);
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }

  if (Platform.OS === "web") {
    return path;
  }

  throw new Error(
    "The banking API gateway is not configured. Set EXPO_PUBLIC_API_BASE_URL to the deployed server origin.",
  );
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(resolveApiUrl(path), init);
}
