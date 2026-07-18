import { demoWealthCoachDashboard } from "@/data/wealth-coach-demo-data";
import type { WealthCoachDashboard } from "@/types/wealth-coach";

/**
 * Client boundary for normalized Wealth Coach data.
 *
 * This is intentionally backed by demo data until the authenticated banking API is
 * connected. AI inference, transaction processing, and eligibility decisions belong
 * behind that API and must not happen in the Expo client.
 */
export async function getWealthCoachDashboard(): Promise<WealthCoachDashboard> {
  await new Promise((resolve) => setTimeout(resolve, 280));
  return demoWealthCoachDashboard;
}
