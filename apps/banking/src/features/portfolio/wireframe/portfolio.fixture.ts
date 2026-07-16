import type { BadgeTone } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Portfolio tab wireframe.
// Fictional holdings, generalized figures. Not real data, not fetched, never
// calculated on device. Replaced by an authoritative API/service in a later
// task; nothing here should be treated as a source of financial truth.

export type AllocationSlice = { label: string; percent: number };

export type Holding = {
  id: string;
  name: string;
  detail: string;
  value: string;
  change: string;
  changeTone: BadgeTone;
};

export type PerformancePeriod = { id: string; label: string; returnLabel: string };

export const PORTFOLIO_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  totalValue: "₹21,40,000",
  change: "+1.1% today",
  changeTone: "success" as BadgeTone,

  allocation: [
    { label: "Equity", percent: 52 },
    { label: "Debt", percent: 31 },
    { label: "Gold", percent: 9 },
    { label: "Cash", percent: 8 },
  ] as AllocationSlice[],

  holdings: [
    {
      id: "h1",
      name: "Bluechip Equity Fund",
      detail: "1,240 units · Equity",
      value: "₹7,85,000",
      change: "+1.8%",
      changeTone: "success" as BadgeTone,
    },
    {
      id: "h2",
      name: "Corporate Bond Fund",
      detail: "3,010 units · Debt",
      value: "₹5,20,000",
      change: "+0.3%",
      changeTone: "success" as BadgeTone,
    },
    {
      id: "h3",
      name: "Index 500 Fund",
      detail: "640 units · Equity",
      value: "₹4,15,000",
      change: "-0.6%",
      changeTone: "error" as BadgeTone,
    },
    {
      id: "h4",
      name: "Sovereign Gold Bond",
      detail: "18 grams · Gold",
      value: "₹1,92,000",
      change: "+0.9%",
      changeTone: "success" as BadgeTone,
    },
    {
      id: "h5",
      name: "Liquid Fund",
      detail: "1,710 units · Cash",
      value: "₹1,28,000",
      change: "0.0%",
      changeTone: "neutral" as BadgeTone,
    },
  ] as Holding[],

  performance: {
    periods: [
      { id: "1m", label: "1M", returnLabel: "+2.1% over the last month" },
      { id: "6m", label: "6M", returnLabel: "+7.4% over the last 6 months" },
      { id: "1y", label: "1Y", returnLabel: "+12.8% over the last year" },
      { id: "all", label: "All", returnLabel: "+38.5% since you started investing" },
    ] as PerformancePeriod[],
  },

  insight: {
    tone: "primary" as BadgeTone,
    badge: "Diversification",
    title: "Your portfolio is well spread across asset classes",
    body: "Equity leads at 52%, balanced by debt and a small gold and cash buffer. A single-fund concentration above 40% would be worth reviewing with your advisor.",
  },
} as const;
