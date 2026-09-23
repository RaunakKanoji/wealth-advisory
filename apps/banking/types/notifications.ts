export type NotificationType =
  | "transaction"
  | "security"
  | "account"
  | "card"
  | "coach"
  | "service";

export type NotificationSeverity = "info" | "success" | "attention" | "critical";

export type NotificationFilter = "all" | "transactions" | "security" | "coach" | "services";

export type NotificationDestination = {
  pathname: string;
  params?: Record<string, string>;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  severity?: NotificationSeverity;
  destination?: NotificationDestination;
  metadata?: Record<string, string>;
};
