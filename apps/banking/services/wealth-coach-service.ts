import { demoWealthCoachDashboard } from "@/data/wealth-coach-demo-data";
import { DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import { isRemoteDataEnabled } from "@/lib/env";
import type { WealthCoachDashboard } from "@/types/wealth-coach";

const emptyDemoDashboard: WealthCoachDashboard = {
  metrics: [],
  insights: [],
  goals: [],
  recommendations: [],
  periodLabel: "1–30 Sep 2026",
  scopeLabel: "No Coach data connected",
};

/**
 * Client boundary for normalized Wealth Coach data.
 *
 * This adapter is only for the explicitly selected demo mode. Live Coach data
 * must come from the authenticated API so a failed request cannot silently turn
 * into a local financial snapshot.
 */
export async function getWealthCoachDashboard(options?: { customerId?: string | null }): Promise<WealthCoachDashboard> {
  if (isRemoteDataEnabled) throw new Error("Live Wealth Coach data must be loaded through the authenticated API.");
  await new Promise((resolve) => setTimeout(resolve, 280));
  const customerId = options?.customerId;
  if (customerId === DEMO_CUSTOMER_B || customerId?.includes("customer-b")) {
    return emptyDemoDashboard;
  }
  return demoWealthCoachDashboard;
}
