import { createContext, useContext, useMemo } from "react";
import type { PropsWithChildren } from "react";

import { createAuthenticationService } from "@/src/features/authentication/services/authentication.factory";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

const AuthenticationServiceContext = createContext<AuthenticationService | null>(null);

type AuthenticationServiceProviderProps = PropsWithChildren<{
  /** Test-only override; the app always resolves through the factory. */
  service?: AuthenticationService;
}>;

// Dependency boundary: hooks/screens resolve the service from context, so
// tests inject a controlled implementation and the app swaps adapters purely
// through configuration — no component knows which adapter is active.
export function AuthenticationServiceProvider({
  children,
  service,
}: AuthenticationServiceProviderProps) {
  const value = useMemo(() => service ?? createAuthenticationService(), [service]);
  return (
    <AuthenticationServiceContext.Provider value={value}>
      {children}
    </AuthenticationServiceContext.Provider>
  );
}

export function useAuthenticationService(): AuthenticationService {
  const service = useContext(AuthenticationServiceContext);
  if (!service) {
    throw new Error("useAuthenticationService must be used within AuthenticationServiceProvider");
  }
  return service;
}
