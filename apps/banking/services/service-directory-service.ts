import type { Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getServiceDefinition, getServiceEntryHref, serviceRegistry } from "@/data/services-registry";
import { getAccounts } from "@/services/accounts-service";
import { getCards } from "@/services/cards-service";
import type { BankAccount } from "@/types/banking";
import type { CardRecord } from "@/types/cards";
import type {
  ServiceAvailability,
  ServiceCategoryId,
  ServiceDefinition,
  ServicePreferences,
  ServiceRecentItem,
} from "@/types/services";

const DEFAULT_CUSTOMER_ID = "demo-customer-a";
const DEFAULT_ENVIRONMENT = "demo";
const MAX_QUERY_LENGTH = 80;
export const MAX_FAVOURITES = 6;
export const MAX_RECENT_SERVICES = 4;
const STORAGE_PREFIX = "idbi-services";

type StoredServicePreferences = ServicePreferences & { clearedRecentAt?: string };

const inMemoryPreferences = new Map<string, StoredServicePreferences>();

function customerScope(customerId?: string | null): string {
  return customerId?.trim() || DEFAULT_CUSTOMER_ID;
}

function storageKey(customerId: string, environment = DEFAULT_ENVIRONMENT): string {
  const safeCustomerId = customerScope(customerId).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${STORAGE_PREFIX}.${environment}.${safeCustomerId}`;
}

function emptyPreferences(): StoredServicePreferences {
  return { version: 1, favouriteServiceIds: [], recentServices: [] };
}

function validServiceIds(ids: unknown, favouritesOnly = false): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => {
    if (typeof id !== "string") return false;
    const service = getServiceDefinition(id);
    return Boolean(service && (!favouritesOnly || service.favouriteAllowed));
  }))];
}

function parsePreferences(value: string | null): StoredServicePreferences {
  if (!value) return emptyPreferences();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return emptyPreferences();
    const record = parsed as Record<string, unknown>;
    const recentServices = Array.isArray(record.recentServices)
      ? record.recentServices.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const recent = item as Record<string, unknown>;
          if (typeof recent.serviceId !== "string" || typeof recent.openedAt !== "string") return [];
          return getServiceDefinition(recent.serviceId)
            ? [{ serviceId: recent.serviceId, openedAt: recent.openedAt }]
            : [];
        })
      : [];
    return {
      version: typeof record.version === "number" ? record.version : 1,
      favouriteServiceIds: validServiceIds(record.favouriteServiceIds, true).slice(0, MAX_FAVOURITES),
      recentServices: recentServices.slice(0, MAX_RECENT_SERVICES),
      clearedRecentAt: typeof record.clearedRecentAt === "string" ? record.clearedRecentAt : undefined,
    };
  } catch {
    return emptyPreferences();
  }
}

async function loadPreferences(customerId?: string | null, environment = DEFAULT_ENVIRONMENT): Promise<StoredServicePreferences> {
  const scope = customerScope(customerId);
  const key = `${environment}:${scope}`;
  const current = inMemoryPreferences.get(key);
  if (current) return current;

  try {
    let stored = await SecureStore.getItemAsync(storageKey(scope, environment));
    if (!stored && Platform.OS === "web" && typeof localStorage !== "undefined") {
      stored = localStorage.getItem(storageKey(scope, environment));
    }
    const parsed = parsePreferences(stored);
    inMemoryPreferences.set(key, parsed);
    return parsed;
  } catch {
    const parsed = Platform.OS === "web" && typeof localStorage !== "undefined"
      ? parsePreferences(localStorage.getItem(storageKey(scope, environment)))
      : emptyPreferences();
    inMemoryPreferences.set(key, parsed);
    return parsed;
  }
}

async function savePreferences(customerId: string, preferences: StoredServicePreferences, environment = DEFAULT_ENVIRONMENT): Promise<StoredServicePreferences> {
  const scope = customerScope(customerId);
  const key = `${environment}:${scope}`;
  const next = { ...preferences, version: preferences.version + 1 };
  inMemoryPreferences.set(key, next);
  const serialized = JSON.stringify(next);

  try {
    await SecureStore.setItemAsync(storageKey(scope, environment), serialized);
  } catch {
    // The current session remains usable. A production adapter should persist
    // these customer-owned preferences server-side with a version check.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey(scope, environment), serialized);
    } catch {
      // Browser storage is optional; do not block directory browsing.
    }
  }
  return next;
}

function normalizeQuery(query: string): string {
  return query.trim().slice(0, MAX_QUERY_LENGTH).toLocaleLowerCase();
}

function tokenScore(query: string, service: ServiceDefinition): number {
  if (!query) return 0;
  const title = service.title.toLocaleLowerCase();
  const aliases = service.aliases.map((alias) => alias.toLocaleLowerCase());
  const category = service.categoryId.replace(/-/g, " ");
  const description = service.description.toLocaleLowerCase();
  if (title === query) return 1000;
  if (title.startsWith(query)) return 850;
  if (title.split(/\s+/).some((token) => token.startsWith(query))) return 800;
  if (aliases.some((alias) => alias === query)) return 700;
  if (aliases.some((alias) => alias.startsWith(query))) return 650;
  if (title.includes(query)) return 600;
  if (aliases.some((alias) => alias.includes(query))) return 550;
  if (description.includes(query) || category.includes(query)) return 400;
  const words = query.split(/\s+/).filter(Boolean);
  const haystack = [title, ...aliases, description, category].join(" ");
  return words.every((word) => haystack.includes(word)) ? 300 : -1;
}

export function searchServices(
  query: string,
  categoryId: ServiceCategoryId | "all" = "all",
  services: ServiceDefinition[] = serviceRegistry,
): ServiceDefinition[] {
  const normalized = normalizeQuery(query);
  return services
    .filter((service) => categoryId === "all" || service.categoryId === categoryId)
    .map((service) => ({ service, score: tokenScore(normalized, service) }))
    .filter(({ score }) => !normalized || score >= 0)
    .sort((left, right) => right.score - left.score || left.service.sortOrder - right.service.sortOrder || left.service.id.localeCompare(right.service.id))
    .map(({ service }) => service);
}

export async function getServicePreferences(options?: { customerId?: string | null; environment?: string }): Promise<ServicePreferences> {
  const preferences = await loadPreferences(options?.customerId, options?.environment ?? DEFAULT_ENVIRONMENT);
  return {
    version: preferences.version,
    favouriteServiceIds: [...preferences.favouriteServiceIds],
    recentServices: [...preferences.recentServices],
  };
}

export async function toggleFavourite(
  serviceId: string,
  options?: { customerId?: string | null; environment?: string },
): Promise<ServicePreferences> {
  const service = getServiceDefinition(serviceId);
  if (!service || !service.favouriteAllowed) throw new Error("This service cannot be saved as a favourite");
  const environment = options?.environment ?? DEFAULT_ENVIRONMENT;
  const customerId = customerScope(options?.customerId);
  const preferences = await loadPreferences(customerId, environment);
  const isFavourite = preferences.favouriteServiceIds.includes(serviceId);
  if (!isFavourite && preferences.favouriteServiceIds.length >= MAX_FAVOURITES) {
    throw new Error(`You can save up to ${MAX_FAVOURITES} favourites`);
  }
  const favouriteServiceIds = isFavourite
    ? preferences.favouriteServiceIds.filter((id) => id !== serviceId)
    : [...preferences.favouriteServiceIds, serviceId];
  return savePreferences(customerId, { ...preferences, favouriteServiceIds }, environment);
}

export async function moveFavourite(
  serviceId: string,
  direction: "earlier" | "later",
  options?: { customerId?: string | null; environment?: string },
): Promise<ServicePreferences> {
  const environment = options?.environment ?? DEFAULT_ENVIRONMENT;
  const customerId = customerScope(options?.customerId);
  const preferences = await loadPreferences(customerId, environment);
  const index = preferences.favouriteServiceIds.indexOf(serviceId);
  if (index < 0) return getServicePreferences({ customerId, environment });
  const nextIndex = direction === "earlier" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= preferences.favouriteServiceIds.length) return getServicePreferences({ customerId, environment });
  const favouriteServiceIds = [...preferences.favouriteServiceIds];
  [favouriteServiceIds[index], favouriteServiceIds[nextIndex]] = [favouriteServiceIds[nextIndex], favouriteServiceIds[index]];
  return savePreferences(customerId, { ...preferences, favouriteServiceIds }, environment);
}

export async function recordRecentService(
  serviceId: string,
  options?: { customerId?: string | null; environment?: string; openedAt?: string },
): Promise<ServicePreferences> {
  if (!getServiceDefinition(serviceId)) throw new Error("Unknown service");
  const environment = options?.environment ?? DEFAULT_ENVIRONMENT;
  const customerId = customerScope(options?.customerId);
  const preferences = await loadPreferences(customerId, environment);
  const recentServices: ServiceRecentItem[] = [
    { serviceId, openedAt: options?.openedAt ?? new Date().toISOString() },
    ...preferences.recentServices.filter((item) => item.serviceId !== serviceId),
  ].slice(0, MAX_RECENT_SERVICES);
  return savePreferences(customerId, { ...preferences, recentServices }, environment);
}

export async function clearRecentServices(options?: { customerId?: string | null; environment?: string }): Promise<ServicePreferences> {
  const environment = options?.environment ?? DEFAULT_ENVIRONMENT;
  const customerId = customerScope(options?.customerId);
  const preferences = await loadPreferences(customerId, environment);
  return savePreferences(customerId, { ...preferences, recentServices: [], clearedRecentAt: new Date().toISOString() }, environment);
}

export async function clearServiceDirectoryState(customerId?: string | null, environment = DEFAULT_ENVIRONMENT): Promise<void> {
  const scope = customerScope(customerId);
  inMemoryPreferences.delete(`${environment}:${scope}`);
  try {
    await SecureStore.deleteItemAsync(storageKey(scope, environment));
  } catch {
    // Test and browser fallbacks may not expose SecureStore deletion.
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try { localStorage.removeItem(storageKey(scope, environment)); } catch { /* optional */ }
  }
}

export type DirectoryResourceSnapshot = {
  accounts: BankAccount[];
  cards: CardRecord[];
  accountState: "ready" | "error";
  cardState: "ready" | "error";
};

export async function loadDirectoryResources(customerId?: string | null): Promise<DirectoryResourceSnapshot> {
  const [accountsResult, cardsResult] = await Promise.allSettled([
    getAccounts({ customerId }),
    getCards({ customerId }),
  ]);
  return {
    accounts: accountsResult.status === "fulfilled" ? accountsResult.value : [],
    cards: cardsResult.status === "fulfilled" ? cardsResult.value : [],
    accountState: accountsResult.status === "fulfilled" ? "ready" : "error",
    cardState: cardsResult.status === "fulfilled" ? "ready" : "error",
  };
}

function eligibleAccounts(service: ServiceDefinition, accounts: BankAccount[]): BankAccount[] {
  if (!service.requiresResource || service.requiresResource !== "account") return [];
  return accounts.filter((account) => account.status === "active");
}

function eligibleCards(service: ServiceDefinition, cards: CardRecord[]): CardRecord[] {
  if (!service.requiresResource || service.requiresResource !== "card") return [];
  if (service.destination.kind !== "route") return [];
  const capability = service.destination.capability;
  return cards.filter((card) => {
    if (card.lifecycleStatus === "expired") return false;
    switch (capability) {
      case "controls": return card.capabilities.canManageDomesticUsage || card.capabilities.canManageInternationalUsage;
      case "limits": return card.capabilities.canManageLimits;
      case "hotlist": return card.capabilities.canHotlist;
      case "billing": return card.capabilities.canViewStatements && Boolean(card.creditFacility);
      default: return true;
    }
  });
}

export function getServiceAvailability(service: ServiceDefinition, resources: DirectoryResourceSnapshot): ServiceAvailability {
  if (service.implementationState === "information-only" || service.destination.kind === "information") {
    return { state: "information", label: "Information", reason: service.availabilityDescription };
  }
  if (!service.requiresResource) return { state: "available", label: "Available" };
  if (service.requiresResource === "account") {
    if (resources.accountState === "error") return { state: "unavailable", label: "Unavailable", reason: "Unable to check account availability." };
    const accounts = eligibleAccounts(service, resources.accounts);
    if (accounts.length === 0) return { state: "unavailable", label: "Unavailable", reason: "No eligible account is available for this service." };
    return { state: accounts.length === 1 ? "available" : "choose-resource", label: accounts.length === 1 ? "Available" : "Choose an account", resourceType: "account", eligibleResourceIds: accounts.map((account) => account.id) };
  }
  if (resources.cardState === "error") return { state: "unavailable", label: "Unavailable", reason: "Unable to check card availability." };
  const cards = eligibleCards(service, resources.cards);
  if (cards.length === 0) return { state: "unavailable", label: "Unavailable", reason: "No eligible card is available for this service." };
  return { state: cards.length === 1 ? "available" : "choose-resource", label: cards.length === 1 ? "Available" : "Choose a card", resourceType: "card", eligibleResourceIds: cards.map((card) => card.id) };
}

export function resolveServiceNavigation(
  service: ServiceDefinition,
  context?: { accountId?: string; cardId?: string },
): Href | undefined {
  const destination = service.destination;
  if (destination.kind === "information") {
    return { pathname: "/(app)/services/info/[serviceId]" as never, params: { serviceId: service.id } } as Href;
  }

  switch (destination.routeKey) {
    case "account-details":
    case "account-transactions":
    case "account-documents":
      if (!context?.accountId) return undefined;
      return {
        pathname: "/(app)/accounts/[accountId]" as never,
        params: {
          accountId: context.accountId,
          section: destination.routeKey === "account-details"
            ? "details"
            : destination.routeKey === "account-transactions"
              ? "transactions"
              : "documents",
        },
      } as Href;
    case "card-controls":
    case "card-limits":
    case "card-lost-stolen":
    case "card-billing":
      if (!context?.cardId) return undefined;
      return {
        pathname: "/(app)/cards/[cardId]" as never,
        params: { cardId: context.cardId, section: destination.routeKey === "card-billing" ? "billing" : "controls" },
      } as Href;
    case "profile":
      return { pathname: "/(app)/profile", params: { returnTo: "/(app)/services" } };
    default:
      return getServiceEntryHref(service);
  }
}
