import { useCallback, useRef } from "react";

type GetToken = () => Promise<string | null>;

/** Keep Clerk token access stable across auth-provider bootstrap renders. */
export function useStableGetToken(getToken: GetToken): GetToken {
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  return useCallback(() => getTokenRef.current(), []);
}
