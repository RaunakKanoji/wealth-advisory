import { serviceToMoreActionItem } from "@/data/services-registry";
import type { MoreActionItem } from "@/types/more-actions";

function serviceItems(ids: string[]): MoreActionItem[] {
  return ids.map((id) => serviceToMoreActionItem(id));
}

export const priorityActionItems: MoreActionItem[] = serviceItems([
  "transfer-money",
  "account-statements",
  "security-settings",
  "offers",
]);

export const bankingServiceItems: MoreActionItem[] = serviceItems([
  "my-accounts",
  "loans",
  "my-cards",
  "investments-overview",
  "insurance",
  "tax-documents",
  "beneficiaries",
  "service-requests",
]);

export const supportActionItems: MoreActionItem[] = serviceItems([
  "help-center",
  "contact-support",
  "branch-atm-locator",
]);
