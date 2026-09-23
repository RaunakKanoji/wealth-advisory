import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export function isTransientQueryError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.retryable;
}

function retryDelay(attempt: number): number {
  const exponential = Math.min(1_000 * (2 ** attempt), 8_000);
  return exponential + Math.round(Math.random() * 250);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 2 && isTransientQueryError(error),
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});
