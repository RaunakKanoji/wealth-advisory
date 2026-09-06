import { getServiceDefinition, serviceToMoreActionItem, serviceRegistry, validateServiceRegistry } from "@/data/services-registry";
import {
  clearRecentServices,
  clearServiceDirectoryState,
  getServiceAvailability,
  getServicePreferences,
  MAX_FAVOURITES,
  moveFavourite,
  recordRecentService,
  resolveServiceNavigation,
  searchServices,
  toggleFavourite,
} from "@/services/service-directory-service";

describe("service registry", () => {
  it("has unique IDs, valid categories, icons, and trusted destinations", () => {
    expect(validateServiceRegistry()).toEqual([]);
    expect(new Set(serviceRegistry.map((service) => service.id)).size).toBe(serviceRegistry.length);
  });

  it("can provide shared More navigation items from the registry", () => {
    const item = serviceToMoreActionItem("transfer-money");
    expect(item.label).toBe("Transfer money");
    expect(item.route).toBe("/(app)/transfers");
  });

  it("resolves only trusted destinations and preserves resource context", () => {
    const accountService = getServiceDefinition("account-statements");
    const cardService = getServiceDefinition("card-limits");
    expect(accountService && resolveServiceNavigation(accountService)).toBeUndefined();
    expect(accountService && resolveServiceNavigation(accountService, { accountId: "savings-primary" })).toMatchObject({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId: "savings-primary", section: "documents" },
    });
    expect(cardService && resolveServiceNavigation(cardService, { cardId: "card-debit-primary" })).toMatchObject({
      pathname: "/(app)/cards/[cardId]",
      params: { cardId: "card-debit-primary", section: "controls" },
    });
  });

  it("distinguishes information entries from unavailable resource entries", () => {
    const informationService = getServiceDefinition("loans");
    const cardsService = getServiceDefinition("card-limits");
    expect(getServiceAvailability(informationService!, { accounts: [], cards: [], accountState: "ready", cardState: "ready" }).state).toBe("information");
    expect(getServiceAvailability(cardsService!, { accounts: [], cards: [], accountState: "ready", cardState: "ready" }).state).toBe("unavailable");
  });
});

describe("service search", () => {
  it("ranks exact and ordinary task terminology without duplicates", () => {
    expect(searchServices("statement")[0]?.id).toBe("account-statements");
    expect(searchServices("send money").map((service) => service.id)).toContain("transfer-money");
    expect(searchServices("passbook").map((service) => service.id)).toContain("transaction-history");
    expect(searchServices("block card").map((service) => service.id)).toEqual(["lost-stolen-card"]);
    expect(searchServices("privacy").map((service) => service.id)).toContain("privacy-consent");
    expect(new Set(searchServices("statement").map((service) => service.id)).size).toBe(searchServices("statement").length);
  });

  it("combines query and category filters and supports no-result recovery", () => {
    expect(searchServices("statement", "cards").map((service) => service.id)).toEqual(["card-statements"]);
    expect(searchServices("statement", "payments-transfers")).toEqual([]);
    expect(searchServices("chequebook").map((service) => service.id)).toEqual(["service-requests"]);
  });

  it("keeps search local and does not change the registry", () => {
    const before = serviceRegistry.map((service) => service.id);
    searchServices("block my card");
    expect(serviceRegistry.map((service) => service.id)).toEqual(before);
    expect(getServiceDefinition("lost-stolen-card")?.title).toBe("Report lost or stolen card");
  });
});

describe("customer-scoped service preferences", () => {
  const customerA = "services-test-customer-a";
  const customerB = "services-test-customer-b";

  beforeEach(async () => {
    await clearServiceDirectoryState(customerA);
    await clearServiceDirectoryState(customerB);
  });

  it("persists favourites, enforces the limit, and keeps customers isolated", async () => {
    await toggleFavourite("transfer-money", { customerId: customerA });
    await toggleFavourite("scan-qr", { customerId: customerA });
    expect((await getServicePreferences({ customerId: customerA })).favouriteServiceIds).toEqual(["transfer-money", "scan-qr"]);
    expect((await getServicePreferences({ customerId: customerB })).favouriteServiceIds).toEqual([]);

    const favourites = ["my-accounts", "my-cards", "beneficiaries", "ask-wealth-coach"];
    for (const serviceId of favourites) await toggleFavourite(serviceId, { customerId: customerA });
    await expect(toggleFavourite("financial-goals", { customerId: customerA })).rejects.toThrow(`up to ${MAX_FAVOURITES}`);
  });

  it("supports accessible favourite reordering and recent-service clearing", async () => {
    await toggleFavourite("transfer-money", { customerId: customerA });
    await toggleFavourite("scan-qr", { customerId: customerA });
    await moveFavourite("scan-qr", "earlier", { customerId: customerA });
    expect((await getServicePreferences({ customerId: customerA })).favouriteServiceIds).toEqual(["scan-qr", "transfer-money"]);

    await recordRecentService("my-cards", { customerId: customerA, openedAt: "2026-09-06T10:00:00.000Z" });
    await recordRecentService("transfer-money", { customerId: customerA, openedAt: "2026-09-06T10:01:00.000Z" });
    expect((await getServicePreferences({ customerId: customerA })).recentServices.map((item) => item.serviceId)).toEqual(["transfer-money", "my-cards"]);
    await clearRecentServices({ customerId: customerA });
    expect((await getServicePreferences({ customerId: customerA })).recentServices).toEqual([]);
  });
});
