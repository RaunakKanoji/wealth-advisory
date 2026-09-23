import { useUser } from "@clerk/expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { useTransactions, useWealthSummary } from "@/lib/api/hooks";
import { isRemoteDataEnabled } from "@/lib/env";
import { useDemoSession } from "@/lib/demo-session";
import {
  demoDashboardToInsightsDashboard,
  remoteSummaryToInsightsDashboard,
  type InsightsDashboard,
} from "@/lib/insights-dashboard";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";
import type { WealthCoachDashboard } from "@/types/wealth-coach";

type DemoDashboardState = {
  customerId: string;
  dashboard: WealthCoachDashboard | null;
  error: boolean;
  loading: boolean;
};

export function useWealthCoachInsightsData() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session: demoSession } = useDemoSession();
  const isDemoUserReady = isUserLoaded || Boolean(demoSession);
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const remoteWealth = useWealthSummary();
  const monthRanges = useMemo(() => createMonthRanges(), []);
  const currentTransactions = useTransactions({ ...monthRanges[0], direction: "debit", status: "completed", limit: 50 });
  const previousTransactions = useTransactions({ ...monthRanges[1], direction: "debit", status: "completed", limit: 50 });
  const twoMonthsAgoTransactions = useTransactions({ ...monthRanges[2], direction: "debit", status: "completed", limit: 50 });
  const threeMonthsAgoTransactions = useTransactions({ ...monthRanges[3], direction: "debit", status: "completed", limit: 50 });
  const demoRequestId = useRef(0);
  const [demoState, setDemoState] = useState<DemoDashboardState>({
    customerId,
    dashboard: null,
    error: false,
    loading: !isRemoteDataEnabled,
  });
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isDemoUserReady);

  const remoteDashboard = useMemo<InsightsDashboard | null>(() => {
    if (!remoteWealth.data) return null;
    const base = remoteSummaryToInsightsDashboard(remoteWealth.data);
    const transactionsByMonth = Object.fromEntries([
      [monthRanges[0].from.slice(0, 7), currentTransactions.data?.items ?? []],
      [monthRanges[1].from.slice(0, 7), previousTransactions.data?.items ?? []],
      [monthRanges[2].from.slice(0, 7), twoMonthsAgoTransactions.data?.items ?? []],
      [monthRanges[3].from.slice(0, 7), threeMonthsAgoTransactions.data?.items ?? []],
    ]);
    return { ...base, transactionsByMonth };
  }, [currentTransactions.data?.items, monthRanges, previousTransactions.data?.items, remoteWealth.data, threeMonthsAgoTransactions.data?.items, twoMonthsAgoTransactions.data?.items]);

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
  const dashboard = isRemoteDataEnabled ? remoteDashboard : demoDashboard ? demoDashboardToInsightsDashboard(demoDashboard) : null;
  const insights = dashboard?.insights ?? null;
  const isLoading = isRemoteDataEnabled
    ? !remoteDashboard && (remoteWealth.isPending || remoteWealth.isFetching)
    : !isDemoUserReady || (!demoDashboard && (demoState.customerId !== customerId || demoState.loading));
  const hasLoadError = isRemoteDataEnabled
    ? !remoteDashboard && remoteWealth.isError
    : !demoDashboard && demoState.customerId === customerId && demoState.error;
  const isRefreshing = isRemoteDataEnabled
    ? remoteWealth.isFetching || currentTransactions.isFetching || previousTransactions.isFetching || twoMonthsAgoTransactions.isFetching || threeMonthsAgoTransactions.isFetching
    : demoState.loading;
  const hasRefreshError = isRemoteDataEnabled
    ? Boolean(remoteDashboard && (remoteWealth.isError || currentTransactions.isError || previousTransactions.isError || twoMonthsAgoTransactions.isError || threeMonthsAgoTransactions.isError))
    : Boolean(demoDashboard && demoState.error);

  const retry = useCallback(() => {
    if (isRemoteDataEnabled) {
      void Promise.all([
        remoteWealth.refetch(),
        currentTransactions.refetch(),
        previousTransactions.refetch(),
        twoMonthsAgoTransactions.refetch(),
        threeMonthsAgoTransactions.refetch(),
      ]);
      return;
    }
    void loadDemoDashboard();
  }, [currentTransactions, loadDemoDashboard, previousTransactions, remoteWealth, threeMonthsAgoTransactions, twoMonthsAgoTransactions]);

  return {
    balanceVisible,
    dashboard,
    insights,
    hasLoadError,
    hasRefreshError,
    isLoading: isLoading || !isBalanceVisibilityHydrated,
    isRefreshing,
    retry,
  };
}

function createMonthRanges(): { from: string; to: string }[] {
  const today = new Date();
  return Array.from({ length: 4 }, (_, index) => {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() - index;
    const start = new Date(Date.UTC(year, month, 1));
    const end = index === 0 ? today : new Date(Date.UTC(year, month + 1, 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  });
}
