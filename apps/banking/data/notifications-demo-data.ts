import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import { formatINR } from "@/lib/currency";
import type { NotificationItem } from "@/types/notifications";

const demoNotificationsCustomerA: NotificationItem[] = [
  {
    id: "notification-money-received",
    type: "transaction",
    title: "Money received",
    message: `${formatINR(12500)} was credited to Savings ••••1234.`,
    createdAt: "2026-09-06T10:42:00+05:30",
    read: false,
    severity: "success",
    destination: {
      pathname: "/(app)/activity",
      params: { period: "last-90-days" },
    },
  },
  {
    id: "notification-transfer-completed",
    type: "transaction",
    title: "Transfer completed",
    message: `${formatINR(5000)} was sent to Sunita Sharma.`,
    createdAt: "2026-09-06T08:12:00+05:30",
    read: false,
    severity: "success",
    destination: {
      pathname: "/(app)/transfers/history",
    },
  },
  {
    id: "notification-coach-insight",
    type: "coach",
    title: "Wealth Coach insight",
    message: "Food & Dining spending is 18% above your recent average.",
    createdAt: "2026-09-05T18:30:00+05:30",
    read: true,
    severity: "attention",
    destination: {
      pathname: "/(app)/(tabs)/coach",
    },
  },
  {
    id: "notification-new-login",
    type: "security",
    title: "New login detected",
    message: "A login was detected from a new device. Review your security activity.",
    createdAt: "2026-09-04T20:12:00+05:30",
    read: false,
    severity: "critical",
    destination: {
      pathname: "/(app)/security",
    },
  },
  {
    id: "notification-deposit-update",
    type: "service",
    title: "Deposit update available",
    message: "Your recurring deposit contribution is ready to review.",
    createdAt: "2026-09-03T09:15:00+05:30",
    read: true,
    severity: "info",
    destination: {
      pathname: "/(app)/(tabs)/accounts",
    },
  },
  {
    id: "notification-statement-ready",
    type: "account",
    title: "Statement ready",
    message: "Your August account statement is available to view.",
    createdAt: "2026-09-01T11:05:00+05:30",
    read: true,
    severity: "info",
    destination: {
      pathname: "/(app)/accounts/statements",
    },
  },
];

export function getDemoNotifications(customerId: string): NotificationItem[] {
  if (customerId === DEMO_CUSTOMER_B || customerId.includes("customer-b")) {
    return [];
  }

  if (customerId === DEMO_CUSTOMER_A || customerId.includes("customer-a")) {
    return demoNotificationsCustomerA.map((item) => ({ ...item }));
  }

  return demoNotificationsCustomerA.map((item) => ({ ...item }));
}
