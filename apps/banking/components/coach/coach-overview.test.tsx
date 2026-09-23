import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { CoachTopicActions } from "./coach-topic-actions";
import { FinancialSnapshotCard } from "./financial-snapshot-card";
import { GoalProgressCard } from "./goal-progress-card";
import { GoalsSection } from "./goals-section";
import { InsightsSection } from "./insights-section";
import { RecentConversations } from "./recent-conversations";

describe("Wealth Coach overview components", () => {
  it("fills the composer with the concrete affordability prompt", async () => {
    const onSelect = jest.fn();
    const screen = await render(<CoachTopicActions onSelect={onSelect} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ask Wealth Coach about affordability"));
    });

    expect(onSelect).toHaveBeenCalledWith("Can I afford a ₹50,000.00 purchase?");
    expect(screen.getByText("Quick questions")).toBeTruthy();
  });

  it("formats the account balance summary in INR and exposes its Coach action", async () => {
    const onAskCoach = jest.fn();
    const screen = await render(
      <FinancialSnapshotCard
        balanceVisible
        balanceSummary={{
          totalBalanceMinorUnits: 34567800,
          availableToSpendMinorUnits: 22500000,
          depositsMinorUnits: 12067800,
        }}
        onAskCoach={onAskCoach}
      />,
    );

    expect(screen.getByText("Total Balance")).toBeTruthy();
    expect(screen.getByText("₹3,45,678.00")).toBeTruthy();
    expect(screen.getByText("₹2,25,000.00")).toBeTruthy();
    expect(screen.getByText("₹1,20,678.00")).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByText("Deposits")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ask Wealth Coach about this month"));
    });
    expect(onAskCoach).toHaveBeenCalledTimes(1);
  });

  it("keeps goal progress compact without a redundant in-progress label", async () => {
    const screen = await render(
      <GoalProgressCard
        goal={{
          id: "goal-emergency",
          name: "Emergency fund",
          targetAmount: 100000,
          currentAmount: 68000,
          progressPercentage: 68,
          gapAmount: 32000,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.getByText("₹32,000.00 remaining")).toBeTruthy();
    expect(screen.queryByText("In progress")).toBeNull();
  });

  it("does not expose goal amounts or percentages while balances are hidden", async () => {
    const screen = await render(
      <GoalProgressCard
        balanceVisible={false}
        goal={{
          id: "goal-private",
          name: "₹1,00,000 emergency fund",
          targetAmount: 100000,
          currentAmount: 68000,
          progressPercentage: 68,
          gapAmount: 32000,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Financial goal")).toBeTruthy();
    expect(screen.queryByText("68%")).toBeNull();
    expect(screen.queryByText("₹32,000.00 remaining")).toBeNull();
  });

  it("resumes the selected recent conversation and offers a new one", async () => {
    const onConversationPress = jest.fn();
    const onStartConversation = jest.fn();
    const screen = await render(
      <RecentConversations
        balanceVisible
        conversations={[{
          id: "conversation-laptop",
          title: "Can I afford a new laptop?",
          status: "active",
          messageCount: 2,
          createdAt: "2026-09-07T10:00:00.000Z",
          updatedAt: "2026-09-07T10:01:00.000Z",
        }]}
        onConversationPress={onConversationPress}
        onStartConversation={onStartConversation}
        onViewAll={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Resume Can I afford a new laptop?"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Start a new Wealth Coach conversation"));
    });

    expect(onConversationPress).toHaveBeenCalledWith("conversation-laptop");
    expect(onStartConversation).toHaveBeenCalledTimes(1);
  });

  it("shows an insight error instead of a false empty state", async () => {
    const insights = await render(
      <InsightsSection
        errorMessage="Insights could not be loaded."
        insights={[]}
        onAskCoach={jest.fn()}
        onInsightPress={jest.fn()}
        onRetry={jest.fn()}
        onViewAll={jest.fn()}
      />,
    );
    expect(insights.getByText("Insights unavailable")).toBeTruthy();
    expect(insights.queryByText("You're all caught up")).toBeNull();
  });

  it("keeps useful money and percentage detail in visible insight summaries", async () => {
    const screen = await render(
      <InsightsSection
        balanceVisible
        insights={[
          {
            id: "spending-summary",
            type: "spending",
            title: "Dining changed",
            description: "Fallback spending copy.",
            summary: "Dining was ₹12,400, up 18% from last month.",
            comparison: 18,
            severity: "attention",
          },
          {
            id: "investment-summary",
            type: "investment",
            title: "SIP opportunity",
            description: "Fallback investment copy.",
            summary: "Increasing your SIP by ₹2,000 could lift contributions by 10%.",
            severity: "attention",
          },
          {
            id: "generic-summary",
            type: "savings",
            title: "Savings improved",
            description: "Fallback savings copy.",
            summary: "You saved ₹8,500, or 14% of income.",
            percentage: 14,
            metricUnit: "percentage",
            severity: "attention",
          },
        ]}
        onAskCoach={jest.fn()}
        onInsightPress={jest.fn()}
        onViewAll={jest.fn()}
      />,
    );

    expect(screen.getByText("Dining was ₹12,400, up 18% from last month.")).toBeTruthy();
    expect(screen.getByText("Increasing your SIP by ₹2,000 could lift contributions by 10%.")).toBeTruthy();
    expect(screen.getByText("You saved ₹8,500, or 14% of income.")).toBeTruthy();
  });

  it("sanitizes financial insight summaries only while balances are hidden", async () => {
    const screen = await render(
      <InsightsSection
        balanceVisible={false}
        insights={[
          {
            id: "spending-summary",
            type: "spending",
            title: "Dining changed by ₹12,400",
            description: "Fallback spending copy.",
            summary: "Dining was ₹12,400, up 18% from last month.",
            comparison: 18,
            severity: "attention",
          },
          {
            id: "investment-summary",
            type: "investment",
            title: "Raise SIP by ₹2,000",
            description: "Fallback investment copy.",
            summary: "Increasing your SIP by ₹2,000 could lift contributions by 10%.",
            severity: "attention",
          },
          {
            id: "generic-summary",
            type: "savings",
            title: "Savings improved by 14%",
            description: "Fallback savings copy.",
            summary: "You saved ₹8,500, or 14% of income.",
            percentage: 14,
            metricUnit: "percentage",
            severity: "attention",
          },
        ]}
        onAskCoach={jest.fn()}
        onInsightPress={jest.fn()}
        onViewAll={jest.fn()}
      />,
    );

    expect(screen.queryByText("Dining was ₹12,400, up 18% from last month.")).toBeNull();
    expect(screen.queryByText("Increasing your SIP by ₹2,000 could lift contributions by 10%.")).toBeNull();
    expect(screen.queryByText("You saved ₹8,500, or 14% of income.")).toBeNull();
    expect(screen.getByText("This spending insight is based on your latest posted transactions.")).toBeTruthy();
    expect(screen.getByText("This investment insight is based on the financial context currently available.")).toBeTruthy();
    expect(screen.getByText("This insight is based on your latest available account activity.")).toBeTruthy();
  });

  it("shows a goal error instead of a false empty state", async () => {
    const goals = await render(
      <GoalsSection
        errorMessage="Goals could not be loaded."
        goals={[]}
        onGoalPress={jest.fn()}
        onRetry={jest.fn()}
        onViewAll={jest.fn()}
      />,
    );
    expect(goals.getByText("Goals unavailable")).toBeTruthy();
    expect(goals.queryByText("Start your first financial goal")).toBeNull();
  });
});
