import type { BankingActivity } from "@/types/banking";

type DemoLedgerActivity = BankingActivity & { customerId: string };

// Deliberately in-memory: demo activity is synthetic and must never be mixed
// into live persistence or browser storage.
const activities: DemoLedgerActivity[] = [];

export function recordDemoPaymentActivity(activity: DemoLedgerActivity) {
  if (activities.some((item) => item.id === activity.id && item.customerId === activity.customerId)) {
    return;
  }

  activities.unshift(activity);
}

export function getDemoPaymentActivities(customerId: string): BankingActivity[] {
  return activities
    .filter((activity) => activity.customerId === customerId)
    .map(({ customerId: _customerId, ...activity }) => activity);
}

export function clearDemoPaymentLedger() {
  activities.length = 0;
}
