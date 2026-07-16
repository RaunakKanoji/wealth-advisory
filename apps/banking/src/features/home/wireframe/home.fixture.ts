import type { BadgeTone } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Home dashboard wireframe.
// Fictional customer, generalized figures. Not real data, not fetched, never
// calculated on device. Replaced by an authoritative API/service in a later
// task; nothing here should be treated as a source of financial truth.

export type AllocationSlice = { label: string; percent: number };

export const HOME_WIREFRAME = {
  kind: "WIREFRAME_ONLY",
  greeting: "Good afternoon",
  customerName: "Ananya",
  initials: "AN",

  netWorth: {
    label: "TOTAL NET WORTH",
    value: "₹42,80,000",
    change: "+2.4% this month",
    changeTone: "success" as BadgeTone,
    detail: "4 linked accounts · updated today",
  },

  snapshot: [
    { label: "Assets", value: "₹58,10,000" },
    { label: "Liabilities", value: "₹15,30,000" },
    { label: "Investable", value: "₹21,40,000" },
  ] as { label: string; value: string }[],

  goal: {
    title: "Retirement corpus",
    progress: 46,
    current: "₹23,00,000",
    target: "₹50,00,000",
    status: "On track for 2041",
  },

  portfolio: {
    value: "₹21,40,000",
    change: "+1.1% today",
    changeTone: "success" as BadgeTone,
    allocation: [
      { label: "Equity", percent: 52 },
      { label: "Debt", percent: 31 },
      { label: "Gold", percent: 9 },
      { label: "Cash", percent: 8 },
    ] as AllocationSlice[],
  },

  insight: {
    tone: "warning" as BadgeTone,
    badge: "Advisory insight",
    title: "Your emergency fund covers 3.2 months of expenses",
    body: "A 6-month buffer is the usual guidance. Moving idle savings into a liquid fund could close the gap without locking up your money.",
  },

  copilotHero: {
    title: "Wealth Copilot",
    subtitle: "Get personalised financial insights",
    body: "Ask about your goals, portfolio, and projections in plain language.",
    cta: "Explore Wealth Copilot",
  },

  recentReport: {
    title: "Q2 2026 portfolio review",
    date: "12 Jul 2026",
    status: "Ready",
    statusTone: "success" as BadgeTone,
  },
} as const;
