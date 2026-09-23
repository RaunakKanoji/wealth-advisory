import { useUser } from "@clerk/expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { useGoals } from "@/lib/api/hooks";
import { apiGoalToFinancialGoal } from "@/lib/api/view-models";
import { isRemoteDataEnabled } from "@/lib/env";
import { useDemoSession } from "@/lib/demo-session";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";
import type { FinancialGoal, WealthCoachDashboard } from "@/types/wealth-coach";

type DemoDashboardState = {
  customerId: string;
  dashboard: WealthCoachDashboard | null;
  error: boolean;
  loading: boolean;
};

export function useWealthCoachGoalsData() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const remoteGoals = useGoals();
  const demoRequestId = useRef(0);
  const [demoState, setDemoState] = useState<DemoDashboardState>({
    customerId,
    dashboard: null,
    error: false,
    loading: !isRemoteDataEnabled,
  });
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isDemoUserReady);

  const mappedRemoteGoals = useMemo<FinancialGoal[] | null>(
    () => remoteGoals.data ? remoteGoals.data.items.map(apiGoalToFinancialGoal) : null,
    [remoteGoals.data],
  );

  const loadDemoDashboard = useCallback(async () => {
    const requestId = ++demoRequestId.current;
    setDemoState((current) => ({
      customerId,
      dashboard: current.customerId === customerId ? current.dashboard : null,
      error: false,
      loading: true,
    }));

    try {
      const dashboard = await getWealthCoachDashboard({ customerId });
      if (requestId !== demoRequestId.current) return;
      setDemoState({ customerId, dashboard, error: false, loading: false });
    } catch {
      if (requestId !== demoRequestId.current) return;
      setDemoState((current) => current.customerId === customerId
        ? { ...current, error: true, loading: false }
        : { customerId, dashboard: null, error: true, loading: false });
    }
  }, [customerId]);

  useEffect(() => {
    if (isRemoteDataEnabled || !isDemoUserReady) return;
    void loadDemoDashboard();
    return () => {
      demoRequestId.current += 1;
    };
  }, [isDemoUserReady, loadDemoDashboard]);

  const demoDashboard = demoState.customerId === customerId ? demoState.dashboard : null;
  const goals = isRemoteDataEnabled ? mappedRemoteGoals : demoDashboard?.goals ?? null;
  const isLoading = isRemoteDataEnabled
    ? !mappedRemoteGoals && (remoteGoals.isPending || remoteGoals.isFetching)
    : !isDemoUserReady || (!demoDashboard && (demoState.customerId !== customerId || demoState.loading));
  const hasLoadError = isRemoteDataEnabled
    ? !mappedRemoteGoals && remoteGoals.isError
    : !demoDashboard && demoState.customerId === customerId && demoState.error;
  const isRefreshing = isRemoteDataEnabled ? remoteGoals.isFetching : demoState.loading;
  const hasRefreshError = isRemoteDataEnabled
    ? Boolean(mappedRemoteGoals && remoteGoals.isError)
    : Boolean(demoDashboard && demoState.error);

  const retry = useCallback(() => {
    if (isRemoteDataEnabled) {
      void remoteGoals.refetch();
      return;
    }
    void loadDemoDashboard();
  }, [loadDemoDashboard, remoteGoals]);

  return {
    balanceVisible,
    goals,
    hasLoadError,
    hasRefreshError,
    isLoading: isLoading || !isBalanceVisibilityHydrated,
    isRefreshing,
    retry,
  };
}
