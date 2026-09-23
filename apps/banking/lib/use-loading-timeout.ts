import { useCallback, useEffect, useState } from "react";

const DEFAULT_LOADING_TIMEOUT_MS = 10_000;

/**
 * Prevent a screen from showing an indefinite skeleton when auth, storage, or
 * a data request never reaches a terminal state.
 */
export function useLoadingTimeout(
  active: boolean,
  timeoutMs = DEFAULT_LOADING_TIMEOUT_MS,
): { timedOut: boolean; reset: () => void } {
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      setTimedOut(false);
      return;
    }

    setTimedOut(false);
    const timeout = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timeout);
  }, [active, attempt, timeoutMs]);

  const reset = useCallback(() => setAttempt((current) => current + 1), []);
  return { timedOut, reset };
}
