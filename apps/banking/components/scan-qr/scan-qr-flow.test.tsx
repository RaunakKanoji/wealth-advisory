import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ScanQrFlow } from "./scan-qr-flow";

const mockRequestCameraPermission = jest.fn();
const mockGetCameraPermission = jest.fn();
const mockLaunchImageLibrary = jest.fn();
let mockCameraPermission = { granted: false, canAskAgain: true };

jest.mock("expo-camera", () => ({
  __esModule: true,
  CameraView: () => {
    const { View: MockView } = jest.requireActual("react-native");
    return <MockView testID="mock-camera-view" />;
  },
  Camera: { scanFromURLAsync: jest.fn() },
  useCameraPermissions: () => [
    mockCameraPermission,
    mockRequestCameraPermission,
    mockGetCameraPermission,
  ],
}));

jest.mock("expo-image-picker", () => ({
  __esModule: true,
  launchImageLibraryAsync: mockLaunchImageLibrary,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

describe("ScanQrFlow", () => {
  beforeEach(() => {
    mockRequestCameraPermission.mockReset();
    mockGetCameraPermission.mockReset();
    mockLaunchImageLibrary.mockReset();
    mockCameraPermission = { granted: false, canAskAgain: true };
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
  });

  it("lets manual UPI entry reach the shared payment review", async () => {
    const screen = await render(<ScanQrFlow />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("scan-option-enter-upi-id"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("manual-upi-id"), "customer@upi");
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("scan-action-continue"));
    });

    expect(await screen.findByText("Review payment")).toBeTruthy();
    expect(screen.getByText("customer@upi")).toBeTruthy();
    expect(screen.getByText("Recipient lookup unavailable · Not verified")).toBeTruthy();
  });

  it("offers Settings when camera access is permanently denied", async () => {
    mockCameraPermission = { granted: false, canAskAgain: false };

    const screen = await render(<ScanQrFlow />);

    expect(screen.getByText("Allow Camera Access")).toBeTruthy();
    expect(screen.getByTestId("scan-action-open-settings")).toBeTruthy();
  });

  it("keeps manual UPI validation errors specific to manual entry", async () => {
    const screen = await render(<ScanQrFlow />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("scan-option-enter-upi-id"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("manual-upi-id"), "not-a-upi-id");
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("scan-action-continue"));
    });

    expect(screen.getByText("Enter a valid UPI ID such as name@bank")).toBeTruthy();
  });

});
