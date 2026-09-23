import { serviceToMoreActionItem } from "@/data/services-registry";
import type { MoreActionItem } from "@/types/more-actions";

function serviceItems(ids: string[]): MoreActionItem[] {
  return ids.map((id) => serviceToMoreActionItem(id));
}

export const priorityActionItems: MoreActionItem[] = serviceItems([
  "transfer-money",
  "account-statements",
  "my-cards",
  "ask-wealth-coach",
]);

export const bankingServiceItems: MoreActionItem[] = serviceItems([
  "my-accounts",
  "transaction-history",
  "financial-goals",
  "spending-insights",
  "beneficiaries",
  "my-profile",
]);

export const supportActionItems: MoreActionItem[] = [];
