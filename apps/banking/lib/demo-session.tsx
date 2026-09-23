import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { apiErrorMessage, apiRequest } from "@/lib/api/client";
import { env, isExplicitDemoAuthEnabled, isRemoteDataEnabled } from "@/lib/env";

const storageKey = "idbi.wealth.demo-session.v1";

function createOfflineDemoSession(): DemoSession {
  return {
    userId: "usr_demo_a",
    externalAuthId: env.EXPO_PUBLIC_DEMO_AUTH_ID,
    displayName: "Raunak Kanoji",
    email: "raunakkanoji@gmail.com",
    startedAt: new Date().toISOString(),
  };
}

export type DemoSession = {
  userId: string;
  externalAuthId: string;
  displayName: string;
  email: string;
  startedAt: string;
};

type DemoLoginResponse = {
  session: {
    type: "demo";
    userId: string;
    externalAuthId: string;
    startedAt: string;
  };
  user: {
    displayName: string;
    email: string;
  };
};

type DemoHealthResponse = {
  userResolved: boolean;
  counts: { accounts: number; transactions: number; goals: number };
};

type DemoSessionContextValue = {
  session: DemoSession | null;
  isRestoring: boolean;
  isStarting: boolean;
  error: string | null;
  startDemoSession: () => Promise<void>;
  endDemoSession: () => Promise<void>;
  resetDemoData: () => Promise<void>;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

async function readStoredSession(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(storageKey) ?? null;
    return await SecureStore.getItemAsync(storageKey);
  } catch {
    return null;
  }
}

async function writeStoredSession(value: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value) globalThis.localStorage?.setItem(storageKey, value);
      else globalThis.localStorage?.removeItem(storageKey);
      return;
    }
    if (value) await SecureStore.setItemAsync(storageKey, value);
    else await SecureStore.deleteItemAsync(storageKey);
  } catch {
    // The in-memory session remains valid for the current run.
  }
}

function parseStoredSession(value: string | null): DemoSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DemoSession>;
    if (
      parsed.userId !== "usr_demo_a" ||
      parsed.externalAuthId !== env.EXPO_PUBLIC_DEMO_AUTH_ID ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.startedAt !== "string"
    ) return null;
    return parsed as DemoSession;
  } catch {
    return null;
  }
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(isExplicitDemoAuthEnabled);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExplicitDemoAuthEnabled) {
      setIsRestoring(false);
      return;
    }
    let active = true;
    void (async () => {
      const storedSession = parseStoredSession(await readStoredSession());
      let verifiedSession = storedSession;
      if (storedSession && isRemoteDataEnabled) {
        try {
          const response = await apiRequest<DemoLoginResponse>("/api/auth/demo", {
            method: "POST",
            demoAuthId: storedSession.externalAuthId,
          });
          if (response.session.userId !== storedSession.userId) verifiedSession = null;
        } catch {
          verifiedSession = null;
        }
      }
      // Explicit demo builds are intentionally self-contained. Do not leave
      // the app on the auth spinner when the optional banking API is absent.
      if (!verifiedSession && !isRemoteDataEnabled) {
        verifiedSession = createOfflineDemoSession();
        await writeStoredSession(JSON.stringify(verifiedSession));
      }
      if (!active) return;
      setSession(verifiedSession);
      setIsRestoring(false);
    })();
    return () => { active = false; };
  }, []);

  const startDemoSession = useCallback(async () => {
    if (!isExplicitDemoAuthEnabled) {
      setError("Demo login is not enabled for this build.");
      return;
    }
    if (!isRemoteDataEnabled) {
      const offlineSession = createOfflineDemoSession();
      await writeStoredSession(JSON.stringify(offlineSession));
      setSession(offlineSession);
      setError(null);
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      // This is intentionally a backend request, not a frontend login flag.
      const response = await apiRequest<DemoLoginResponse>("/api/auth/demo", {
        method: "POST",
        demoAuthId: env.EXPO_PUBLIC_DEMO_AUTH_ID,
      });
      const health = await apiRequest<DemoHealthResponse>("/api/health/data", {
        demoAuthId: env.EXPO_PUBLIC_DEMO_AUTH_ID,
      });
      if (!response.session || !response.user || !health.userResolved || health.counts.accounts < 1 || health.counts.transactions < 1 || health.counts.goals < 1) {
        throw new Error("The demo workspace does not contain the required financial data.");
      }
      const nextSession: DemoSession = {
        userId: response.session.userId,
        externalAuthId: response.session.externalAuthId,
        displayName: response.user.displayName,
        email: response.user.email,
        startedAt: response.session.startedAt,
      };
      await writeStoredSession(JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "The demo workspace"));
      throw nextError;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const endDemoSession = useCallback(async () => {
    await writeStoredSession(null);
    setSession(null);
    setError(null);
  }, []);

  const resetDemoData = useCallback(async () => {
    if (!session) throw new Error("Start the demo before resetting its data.");
    // Appetize builds use the self-contained fixture mode and intentionally do
    // not have a banking API endpoint. Resetting that demo must therefore not
    // attempt a localhost/network request.
    if (!isRemoteDataEnabled) {
      await endDemoSession();
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      await apiRequest("/api/demo/reset", { method: "POST", demoAuthId: session.externalAuthId });
      await endDemoSession();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Demo data"));
      throw nextError;
    } finally {
      setIsStarting(false);
    }
  }, [endDemoSession, session]);

  const value = useMemo<DemoSessionContextValue>(() => ({ session, isRestoring, isStarting, error, startDemoSession, endDemoSession, resetDemoData }), [endDemoSession, error, isRestoring, isStarting, resetDemoData, session, startDemoSession]);
  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSessionContextValue {
  const value = useContext(DemoSessionContext);
  if (!value) throw new Error("useDemoSession must be used inside DemoSessionProvider");
  return value;
}
