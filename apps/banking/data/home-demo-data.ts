import { BankAccount, BankingActivity, WealthInsight } from "../types/banking";

// Demo accounts that sum up exactly to ₹ 3,45,678.00
export const demoAccounts: BankAccount[] = [
  {
    id: "acc-savings-1",
    name: "SAVINGS ACCOUNT",
    type: "savings",
    availableBalance: 100000,
    lastFour: "1234",
    isPrimary: true,
    currency: "INR",
  },
  {
    id: "acc-current-1",
    name: "CURRENT ACCOUNT",
    type: "current",
    availableBalance: 150000,
    lastFour: "5678",
    isPrimary: false,
    currency: "INR",
  },
  {
    id: "acc-salary-1",
    name: "SALARY ACCOUNT",
    type: "salary",
    availableBalance: 45678,
    lastFour: "9012",
    isPrimary: false,
    currency: "INR",
  },
  {
    id: "acc-fd-1",
    name: "FIXED DEPOSIT",
    type: "fixed-deposit",
    availableBalance: 50000,
    lastFour: "3456",
    isPrimary: false,
    currency: "INR",
  },
];

export const demoActivities: BankingActivity[] = [
  {
    id: "act-amazon",
    title: "Amazon India",
    timestamp: "Today, 10:24 AM",
    amount: 1240,
    direction: "debit",
    category: "shopping",
  },
  {
    id: "act-salary",
    title: "Salary Credit",
    timestamp: "Yesterday, 09:00 AM",
    amount: 85000,
    direction: "credit",
    category: "salary",
  },
];

export const demoInsight: WealthInsight = {
  id: "insight-shopping",
  title: "You've spent 12% more on shopping this month.",
  comparisonLabel: "vs last month",
  severity: "attention",
  createdAt: new Date().toISOString(),
};
