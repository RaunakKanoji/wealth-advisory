import type { BadgeTone, IconName } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Reports detail wireframe.
// Fictional report catalogue and history, generalized figures. Not real data,
// not fetched, never generated on device. Replaced by an authoritative
// reporting API/service in a later task; nothing here is a source of truth.

export type ReportType = {
  id: string;
  icon: IconName;
  title: string;
  description: string;
};

export type ReportStatus = "ready" | "generating" | "failed";

export type RecentReport = {
  id: string;
  title: string;
  date: string;
  status: ReportStatus;
  statusLabel: string;
  statusTone: BadgeTone;
};

export const REPORTS_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  reportTypes: [
    {
      id: "portfolio-review",
      icon: "portfolio",
      title: "Portfolio review",
      description: "Holdings, allocation and performance across your accounts.",
    },
    {
      id: "tax-summary",
      icon: "documents",
      title: "Tax summary",
      description: "Realised gains and interest, organised for filing season.",
    },
    {
      id: "goal-progress",
      icon: "goals",
      title: "Goal progress",
      description: "Funding status and projections for every active goal.",
    },
    {
      id: "net-worth-statement",
      icon: "wealth",
      title: "Net-worth statement",
      description: "A dated snapshot of your assets, liabilities and net worth.",
    },
  ] as ReportType[],

  recent: [
    {
      id: "q2-2026-review",
      title: "Q2 2026 portfolio review",
      date: "12 Jul 2026",
      status: "ready",
      statusLabel: "Ready",
      statusTone: "success" as BadgeTone,
    },
    {
      id: "fy26-tax-summary",
      title: "FY 2025-26 tax summary",
      date: "17 Jul 2026",
      status: "generating",
      statusLabel: "Generating",
      statusTone: "warning" as BadgeTone,
    },
    {
      id: "jun-2026-networth",
      title: "June 2026 net-worth statement",
      date: "01 Jul 2026",
      status: "ready",
      statusLabel: "Ready",
      statusTone: "success" as BadgeTone,
    },
    {
      id: "h1-2026-goals",
      title: "H1 2026 goal progress",
      date: "30 Jun 2026",
      status: "failed",
      statusLabel: "Failed",
      statusTone: "error" as BadgeTone,
    },
  ] as RecentReport[],
} as const;
