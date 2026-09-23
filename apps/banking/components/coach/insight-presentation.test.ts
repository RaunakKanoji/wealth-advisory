import type { WealthInsight } from "@/types/wealth-coach";

import { activityParamsForInsight, sourceLabelsForInsight } from "./insight-presentation";

describe("insight presentation privacy and routing", () => {
  it("removes arbitrary money-bearing source metadata while values are hidden", () => {
    const insight: WealthInsight = {
      id: "private-source",
      type: "spending",
      title: "Spending observation",
      description: "Review this observation.",
      severity: "attention",
      source: {
        category: "food",
        note: "Available INR 100000",
        period: "this-month",
      },
    };

    expect(sourceLabelsForInsight(insight, false)).toEqual([
      "Category: Food",
      "Period: This month",
    ]);
  });

  it("routes structured current-month spending context to current activity", () => {
    const insight: WealthInsight = {
      id: "food-current",
      type: "spending",
      title: "Food spending increased.",
      description: "Food spending increased this month.",
      severity: "attention",
      source: { category: "food", period: "this-month" },
    };

    expect(activityParamsForInsight(insight)).toEqual({ category: "food", period: "this-month" });
  });
});
