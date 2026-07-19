import type {
  MoreActionItem,
  PriorityActionItem,
  SupportActionItem,
} from "@/types/more-actions";

export const priorityActionItems: PriorityActionItem[] = [
  {
    id: "payments",
    label: "Payments",
    icon: { family: "material-community", name: "currency-inr" },
    iconTone: "orange",
    route: "/(app)/payments",
    accessibilityLabel: "Open payments",
  },
  {
    id: "statements",
    label: "Statements",
    icon: { family: "ionicons", name: "receipt-outline" },
    iconTone: "green",
    route: "/(app)/statements",
    accessibilityLabel: "View statements",
  },
  {
    id: "security",
    label: "Security",
    icon: { family: "ionicons", name: "shield-checkmark-outline" },
    iconTone: "green",
    route: "/(app)/security",
    accessibilityLabel: "Open security settings",
  },
  {
    id: "offers",
    label: "Offers",
    icon: { family: "material-community", name: "gift-outline" },
    iconTone: "orange",
    route: "/(app)/offers",
    accessibilityLabel: "View available offers",
  },
];

export const bankingServiceItems: MoreActionItem[] = [
  {
    id: "account-management",
    label: "Account Management",
    icon: { family: "ionicons", name: "person-outline" },
    iconTone: "green",
    route: "/(app)/account-management",
    accessibilityLabel: "Manage accounts",
  },
  {
    id: "loans",
    label: "Loans",
    icon: { family: "material-community", name: "wallet-outline" },
    iconTone: "orange",
    route: "/(app)/loans",
    accessibilityLabel: "View loans",
  },
  {
    id: "cards",
    label: "Cards",
    icon: { family: "ionicons", name: "card-outline" },
    iconTone: "green",
    route: "/(app)/cards",
    accessibilityLabel: "Manage cards",
  },
  {
    id: "investments",
    label: "Investments",
    icon: { family: "ionicons", name: "trending-up-outline" },
    iconTone: "orange",
    route: "/(app)/investments",
    accessibilityLabel: "View investments",
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: { family: "ionicons", name: "shield-outline" },
    iconTone: "green",
    route: "/(app)/insurance",
    accessibilityLabel: "View insurance",
  },
  {
    id: "tax-documents",
    label: "Tax & Documents",
    icon: { family: "ionicons", name: "folder-outline" },
    iconTone: "orange",
    route: "/(app)/documents",
    accessibilityLabel: "Open tax and documents",
  },
  {
    id: "beneficiaries",
    label: "Beneficiaries",
    icon: { family: "ionicons", name: "people-outline" },
    iconTone: "green",
    route: "/(app)/beneficiaries",
    accessibilityLabel: "Manage beneficiaries",
  },
  {
    id: "service-requests",
    label: "Service Requests",
    icon: { family: "ionicons", name: "headset-outline" },
    iconTone: "orange",
    route: "/(app)/service-requests",
    accessibilityLabel: "View service requests",
  },
];

export const supportActionItems: SupportActionItem[] = [
  {
    id: "help-center",
    label: "Help Center",
    icon: { family: "ionicons", name: "help-circle-outline" },
    iconTone: "green",
    route: "/(app)/support",
    accessibilityLabel: "Open Help Center",
  },
  {
    id: "contact-us",
    label: "Contact Us",
    icon: { family: "ionicons", name: "chatbox-outline" },
    iconTone: "orange",
    route: "/(app)/support/contact",
    accessibilityLabel: "Contact IDBI Bank",
  },
  {
    id: "locations",
    label: "Locate Branch / ATM",
    icon: { family: "ionicons", name: "location-outline" },
    iconTone: "green",
    route: "/(app)/locations",
    accessibilityLabel: "Locate a branch or ATM",
  },
];
