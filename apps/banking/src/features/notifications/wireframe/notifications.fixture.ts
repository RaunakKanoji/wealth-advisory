import type { IconName } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Notifications wireframe.
// Fictional alerts, generalized copy. Not real data, not fetched, never wired
// to a live notification system. Replaced by an authoritative API/service in a
// later task; nothing here should be treated as a source of truth.

export type NotificationItem = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

export const NOTIFICATIONS_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  notifications: [
    {
      id: "n1",
      icon: "portfolio",
      title: "Portfolio rebalanced",
      body: "Your equity allocation drifted above target and was trimmed back to plan.",
      time: "2h ago",
      unread: true,
    },
    {
      id: "n2",
      icon: "recommendations",
      title: "New advisory insight",
      body: "A liquid fund could lift the yield on your idle savings without a lock-in.",
      time: "5h ago",
      unread: true,
    },
    {
      id: "n3",
      icon: "goals",
      title: "Goal milestone reached",
      body: "Your retirement corpus goal just crossed 45% funded — nicely on track.",
      time: "Yesterday",
      unread: false,
    },
    {
      id: "n4",
      icon: "documents",
      title: "Q2 report ready",
      body: "Your Q2 2026 portfolio review is available to open and download.",
      time: "3 days ago",
      unread: false,
    },
    {
      id: "n5",
      icon: "consent",
      title: "Data sharing consent renewed",
      body: "Your account aggregation consent was renewed for another 12 months.",
      time: "1 week ago",
      unread: false,
    },
  ] as NotificationItem[],
} as const;
