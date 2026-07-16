import { createDevConsentService } from "@/src/features/consent/services/consent.dev";
import { DEV_SERVICE_UNAVAILABLE_CUSTOMER_ID } from "@/src/features/consent/services/consent.fixtures";

describe("createDevConsentService — getConsentConfiguration", () => {
  it("marks banking-information and profile-and-kyc as required and preselected", async () => {
    const service = createDevConsentService();
    const { categories } = await service.getConsentConfiguration();

    const banking = categories.find((category) => category.id === "banking-information");
    const kyc = categories.find((category) => category.id === "profile-and-kyc");

    expect(banking).toMatchObject({ required: true, selected: true });
    expect(kyc).toMatchObject({ required: true, selected: true });
  });

  it("keeps marketing-and-engagement optional and not preselected", async () => {
    const service = createDevConsentService();
    const { categories } = await service.getConsentConfiguration();

    const marketing = categories.find((category) => category.id === "marketing-and-engagement");

    expect(marketing).toMatchObject({ required: false, selected: false });
  });

  it("does not preselect any optional category", async () => {
    const service = createDevConsentService();
    const { categories } = await service.getConsentConfiguration();

    const optional = categories.filter((category) => !category.required);
    expect(optional.every((category) => !category.selected)).toBe(true);
    expect(optional.length).toBeGreaterThan(0);
  });
});

describe("createDevConsentService — submitConsent", () => {
  it("rejects submission for the service-unavailable fixture customer, then succeeds on retry with a real customer", async () => {
    const service = createDevConsentService();
    const decisions = [
      {
        categoryId: "banking-information" as const,
        decision: "granted" as const,
        required: true,
        policyVersion: "dev-2026.1",
        decidedAt: new Date().toISOString(),
      },
    ];

    await expect(
      service.submitConsent({
        customerId: DEV_SERVICE_UNAVAILABLE_CUSTOMER_ID,
        decisions,
        policyVersion: "dev-2026.1",
        channel: "mobile",
        acknowledgedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: "service-unavailable" });

    const receipt = await service.submitConsent({
      customerId: "dev-user-9876543210",
      decisions,
      policyVersion: "dev-2026.1",
      channel: "mobile",
      acknowledgedAt: new Date().toISOString(),
    });

    expect(receipt.customerId).toBe("dev-user-9876543210");
    expect(receipt.receiptId).toMatch(/^dev-consent-receipt-/);
    expect(receipt.decisions).toEqual(decisions);
  });

  it("reflects the submitted status after a successful submission", async () => {
    const service = createDevConsentService();
    await service.submitConsent({
      customerId: "dev-user-9876543210",
      decisions: [],
      policyVersion: "dev-2026.1",
      channel: "web",
      acknowledgedAt: new Date().toISOString(),
    });

    await expect(service.getConsentStatus()).resolves.toBe("submitted");
  });
});
