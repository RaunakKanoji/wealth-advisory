import {
  clearNotificationState,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications-service";

describe("notifications service", () => {
  beforeEach(async () => {
    await clearNotificationState("demo-customer-a");
    await clearNotificationState("demo-customer-b");
  });

  it("returns deterministic notifications newest first", async () => {
    const notifications = await getNotifications({ customerId: "demo-customer-a" });

    expect(notifications).toHaveLength(6);
    expect(notifications[0]).toMatchObject({
      id: "notification-money-received",
      read: false,
    });
    expect(notifications.at(-1)?.id).toBe("notification-statement-ready");
  });

  it("persists one notification read state for the customer", async () => {
    await markNotificationRead("notification-money-received", { customerId: "demo-customer-a" });

    const notifications = await getNotifications({ customerId: "demo-customer-a" });
    expect(notifications.find((item) => item.id === "notification-money-received")?.read).toBe(true);
    expect(notifications.filter((item) => !item.read)).toHaveLength(2);
  });

  it("marks only the current customer's notifications as read", async () => {
    await markAllNotificationsRead({ customerId: "demo-customer-a" });

    expect((await getNotifications({ customerId: "demo-customer-a" })).every((item) => item.read)).toBe(true);
    expect(await getNotifications({ customerId: "demo-customer-b" })).toEqual([]);
  });
});
