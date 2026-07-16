import type { BadgeTone } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Goals tab wireframe.
// Fictional customer, generalized figures. Not real data, not fetched, never
// calculated on device. Replaced by an authoritative API/service in a later
// task; nothing here should be treated as a source of financial truth.

export type GoalCard = {
  id: string;
  title: string;
  category: string;
  progress: number;
  current: string;
  target: string;
  targetDate: string;
  statusLabel: string;
  statusTone: BadgeTone;
};

export const GOALS_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  summary: {
    totalGoals: 4,
    onTrack: 2,
    totalTargetLabel: "₹1,05,00,000",
  },

  goals: [
    {
      id: "goal-retirement",
      title: "Retirement corpus",
      category: "Retirement",
      progress: 46,
      current: "₹23,00,000",
      target: "₹50,00,000",
      targetDate: "Target 2041",
      statusLabel: "On track",
      statusTone: "success" as BadgeTone,
    },
    {
      id: "goal-education",
      title: "Child's education",
      category: "Education",
      progress: 28,
      current: "₹8,40,000",
      target: "₹30,00,000",
      targetDate: "Target 2034",
      statusLabel: "Behind",
      statusTone: "warning" as BadgeTone,
    },
    {
      id: "goal-home",
      title: "Home down payment",
      category: "Property",
      progress: 63,
      current: "₹12,60,000",
      target: "₹20,00,000",
      targetDate: "Target 2028",
      statusLabel: "On track",
      statusTone: "success" as BadgeTone,
    },
    {
      id: "goal-travel",
      title: "Sabbatical fund",
      category: "Lifestyle",
      progress: 100,
      current: "₹5,00,000",
      target: "₹5,00,000",
      targetDate: "Reached Jun 2026",
      statusLabel: "Funded",
      statusTone: "primary" as BadgeTone,
    },
  ] as GoalCard[],
} as const;
