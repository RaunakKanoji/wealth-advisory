import type { BadgeTone } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Recommendations wireframe.
// Fictional, generalized guidance items. Not real advice, not fetched, never
// calculated on device. An authoritative advisory service replaces this in a
// later task; nothing here should be treated as a source of financial truth or
// as a personalized recommendation.

export type Recommendation = {
  id: string;
  title: string;
  category: string;
  priorityLabel: string;
  priorityTone: BadgeTone;
  why: string;
  action: string;
};

export const RECOMMENDATIONS_WIREFRAME = {
  kind: "WIREFRAME_ONLY",
  recommendations: [
    {
      id: "rec-emergency-buffer",
      title: "Top up your emergency buffer",
      category: "Cash & liquidity",
      priorityLabel: "High",
      priorityTone: "warning" as BadgeTone,
      why: "Your idle savings cover roughly 3 months of expenses, while a 6-month buffer is the usual guidance for your profile.",
      action: "Consider moving part of your idle savings into a liquid fund.",
    },
    {
      id: "rec-rebalance-equity",
      title: "Rebalance towards your target mix",
      category: "Portfolio",
      priorityLabel: "Medium",
      priorityTone: "info" as BadgeTone,
      why: "Equity has drifted a few points above your chosen allocation, which nudges your risk higher than you planned.",
      action: "Review a rebalance back towards your target allocation.",
    },
    {
      id: "rec-tax-saving",
      title: "Use remaining tax-saving headroom",
      category: "Tax planning",
      priorityLabel: "Medium",
      priorityTone: "info" as BadgeTone,
      why: "Part of this year's tax-saving allowance is still unused, based on the contributions on your profile.",
      action: "Explore eligible tax-saving instruments before the year closes.",
    },
    {
      id: "rec-goal-sip",
      title: "Automate your goal contributions",
      category: "Goals",
      priorityLabel: "Low",
      priorityTone: "neutral" as BadgeTone,
      why: "Your retirement goal is on track, and a steady monthly SIP keeps it resilient to occasional missed months.",
      action: "Look into setting up an automatic monthly contribution.",
    },
  ] as Recommendation[],
} as const;
