import { fireEvent, render } from "@testing-library/react-native";
import { useAuth } from "@clerk/expo";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { buildAccountsOverview } from "@/lib/account-overview";
import type { ApiAccount } from "@/lib/api/types";
import { apiAccountToBankAccount } from "@/lib/api/view-models";

import { AccountActionScreen } from "./account-action-screen";
import { AccountDetailsScreen } from "./account-details-screen";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockApiRequest = jest.fn();
const mockUseFinancialData = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    accountId: "acc_demo_savings",
    section: "details",
    // This used to force the local fixture adapter even in remote mode.
    source: "demo",
  }),
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => true,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock("@/lib/env", () => ({
  isFinancialAuthReady: (isLoaded: boolean, isSignedIn: boolean | undefined) => isLoaded && isSignedIn === true,
  isRemoteDataEnabled: true,
}));

jest.mock("@/lib/api/hooks", () => ({
  useFinancialData: (...args: unknown[]) => mockUseFinancialData(...args),
}));

jest.mock("@/lib/api/client", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

const remoteApiAccount: ApiAccount = {
  id: "acc_demo_savings",
  type: "savings",
  name: "Remote Seed Savings",
  nickname: "Remote Seed Savings",
  maskedAccountNumber: "•••• 2468",
  currency: "INR",
  isPrimary: true,
  status: "active",
  branchName: "IDBI Remote Branch",
  ifsc: "IBKL0000999",
  ledgerBalance: "101250.00",
  availableBalance: "100000.00",
  holds: "1250.00",
  asOf: "2026-09-20T08:00:00.000Z",
  updatedAt: "2026-09-20T08:00:00.000Z",
  sourceProvider: "seed",
  sourceEnvironment: "demo",
};

const remoteAccount = apiAccountToBankAccount(remoteApiAccount);
const remoteOverview = buildAccountsOverview([remoteAccount], {
  summary: {
    totalBalanceMinorUnits: 10_000_000,
    availableToSpendMinorUnits: 10_000_000,
    depositBalanceMinorUnits: 0,
  },
  lastUpdated: remoteApiAccount.asOf,
});

describe("Accounts owner-scoped routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      getToken: jest.fn(async () => "test-token"),
      isLoaded: true,
      isSignedIn: true,
      userId: "remote-owner",
    });
    mockUseFinancialData.mockReturnValue({
      overview: remoteOverview,
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    });
    mockApiRequest.mockImplementation(async (path: string) => (
      path.includes("/transactions") ? { items: [], nextCursor: null } : remoteApiAccount
    ));
  });

  it("uses canonical remote accounts for statement selection", async () => {
    const screen = await render(
      <AccountActionScreen
        allowAccountSelection
        description="Review account statements."
        title="Statements"
      />,
    );

    expect((await screen.findAllByText("Remote Seed Savings")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Account ending in 2468").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Select account. Currently Remote Seed Savings"));
    expect(screen.queryByText("Current Account")).toBeNull();
    expect(mockUseFinancialData).toHaveBeenCalledWith(true);
  });

  it("ignores a demo source parameter while the app is in remote mode", async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <AccountDetailsScreen />
      </SafeAreaProvider>,
    );

    expect((await screen.findAllByText("Remote Seed Savings")).length).toBeGreaterThan(0);
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/accounts/acc_demo_savings",
      expect.objectContaining({ getToken: expect.any(Function) }),
    );
    expect(screen.queryByText("Account unavailable")).toBeNull();
  });
});
