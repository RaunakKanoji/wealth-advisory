import type { ApiTransaction } from "@/lib/api/types";
import type { WealthInsight } from "@/types/wealth-coach";

import {
  categoryTrendForInsight,
  filterInsights,
  goalProgress,
  rankInsights,
} from "./insights-dashboard";

const insight = (input: Partial<WealthInsight> & Pick<WealthInsight, "id" | "type">): WealthInsight => ({
  description: input.description ?? "Review this financial observation.",
  severity: input.severity ?? "neutral",
  title: input.title ?? input.id,
  ...input,
});

const transaction = (month: string, amount: string, category = "food_dining"): ApiTransaction => ({
  id: `${month}-${amount}`,
  accountId: "account-1",
  type: "purchase",
  direction: "debit",
  amount,
  currency: "INR",
  description: "Restaurant",
  merchantName: "Restaurant",
  category,
  categoryName: "Food & Dining",
  reference: null,
  transactionAt: `${month}-10T10:00:00.000Z`,
  status: "completed",
  metadata: {},
});

describe("insights dashboard domain", () => {
  it("ranks actionable attention insights ahead of neutral observations", () => {
    const result = rankInsights([
      insight({ id: "goal", type: "goal", title: "Goal progress" }),
      insight({ id: "food", type: "spending", severity: "attention", comparison: 18, source: { category: "food_dining", period: "2026-09" } }),
    ]);

    expect(result[0]?.id).toBe("food");
  });

  it("filters recent insights without changing the source collection", () => {
    const source = [
      insight({ id: "spending", type: "spending" }),
      insight({ id: "goal", type: "goal" }),
      insight({ id: "bill", type: "bills" }),
    ];

    expect(filterInsights(source, "goals").map((item) => item.id)).toEqual(["goal"]);
    expect(source).toHaveLength(3);
  });

  it("clamps goal progress and remaining amount", () => {
    expect(goalProgress({ id: "goal", name: "Fund", currentAmount: 120, targetAmount: 100, gapAmount: 0, progressPercentage: 120 })).toEqual({ percentage: 100, remaining: 0, completed: true });
  });

  it("builds a category trend from the current and prior comparable periods", () => {
    const result = categoryTrendForInsight(
      insight({ id: "food", type: "spending", source: { category: "food_dining" } }),
      {
        "2026-07": [transaction("2026-07", "100.00")],
        "2026-08": [transaction("2026-08", "200.00")],
        "2026-09": [transaction("2026-09", "350.00")],
      },
      "2026-09",
    );

    expect(result.map((point) => point.amount)).toEqual([100, 200, 350]);
    expect(result.at(-1)?.isCurrent).toBe(true);
  });
});
