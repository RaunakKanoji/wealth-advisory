import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B } from "@/data/accounts-demo-data";
import { getWealthCoachDashboard } from "@/services/wealth-coach-service";

describe("wealth coach demo adapter", () => {
  it("never exposes customer A wealth data to customer B", async () => {
    const [customerA, customerB] = await Promise.all([
      getWealthCoachDashboard({ customerId: DEMO_CUSTOMER_A }),
      getWealthCoachDashboard({ customerId: DEMO_CUSTOMER_B }),
    ]);

    expect(customerA.metrics.length).toBeGreaterThan(0);
    expect(customerA.insights.length).toBeGreaterThan(0);
    expect(customerA.goals.length).toBeGreaterThan(0);
    expect(customerB).toMatchObject({
      metrics: [],
      insights: [],
      goals: [],
      recommendations: [],
    });
    expect(JSON.stringify(customerB)).not.toContain("Retirement Fund");
  });

  it("uses the same isolated empty fixture for customer-B aliases", async () => {
    await expect(getWealthCoachDashboard({ customerId: "signed-in-customer-b-alias" })).resolves.toMatchObject({
      metrics: [],
      insights: [],
      goals: [],
    });
  });
});
