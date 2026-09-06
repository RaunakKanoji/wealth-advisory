import type { MoreActionIcon } from "@/types/more-actions";

export type ServiceCategoryId =
  | "accounts-deposits"
  | "payments-transfers"
  | "cards"
  | "wealth-planning"
  | "loans-insurance"
  | "documents-requests"
  | "profile-security"
  | "help-support";

export type ServiceImplementationState = "operational" | "information-only";
export type ServiceEnvironment = "demo" | "application-native";
export type ServiceResourceType = "account" | "card";
export type ServiceAvailabilityState =
  | "available"
  | "choose-resource"
  | "information"
  | "unavailable"
  | "checking";

export type ServiceRouteKey =
  | "accounts"
  | "account-details"
  | "account-transactions"
  | "account-documents"
  | "transfer-money"
  | "scan-qr"
  | "beneficiaries"
  | "transfer-history"
  | "cards"
  | "card-controls"
  | "card-limits"
  | "card-lost-stolen"
  | "card-billing"
  | "coach-dashboard"
  | "ask-coach"
  | "profile"
  | "notifications"
  | "service-information";

export type ServiceInformation = {
  whatItIs: string;
  availableHere: string;
  notConnected?: string;
  nextStep: string;
  relatedServiceId?: string;
};

export type ServiceDestination =
  | {
      kind: "route";
      routeKey: ServiceRouteKey;
      resource?: ServiceResourceType;
      capability?: string;
    }
  | {
      kind: "information";
      routeKey: "service-information";
      information: ServiceInformation;
    };

export type ServiceDefinition = {
  id: string;
  title: string;
  description: string;
  categoryId: ServiceCategoryId;
  aliases: string[];
  icon: MoreActionIcon;
  iconTone: "green" | "orange";
  sortOrder: number;
  destination: ServiceDestination;
  implementationState: ServiceImplementationState;
  environment: ServiceEnvironment;
  favouriteAllowed: boolean;
  requiresResource?: ServiceResourceType;
  availabilityDescription?: string;
};

export type ServiceCategory = {
  id: ServiceCategoryId;
  title: string;
  shortTitle: string;
  sortOrder: number;
};

export type ServiceRecentItem = {
  serviceId: string;
  openedAt: string;
};

export type ServicePreferences = {
  version: number;
  favouriteServiceIds: string[];
  recentServices: ServiceRecentItem[];
};

export type ServiceAvailability = {
  state: ServiceAvailabilityState;
  label: string;
  reason?: string;
  resourceType?: ServiceResourceType;
  eligibleResourceIds?: string[];
};
