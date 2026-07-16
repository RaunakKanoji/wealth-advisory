import { AccessibilityInfo } from "react-native";

import { OfflineBanner } from "@/src/components/feedback/OfflineBanner";
import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { render } from "@/src/testing/render";

jest.mock("@/src/hooks/useNetworkStatus", () => ({
  useNetworkStatus: jest.fn(),
}));

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;

describe("OfflineBanner", () => {
  it("renders nothing while online", async () => {
    mockUseNetworkStatus.mockReturnValue({ offline: false });
    const { queryByText } = await render(<OfflineBanner />);

    expect(queryByText(FEEDBACK_COPY.offline.message)).toBeNull();
  });

  it("shows the offline banner and announces it when offline", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    mockUseNetworkStatus.mockReturnValue({ offline: true });
    const { getByText } = await render(<OfflineBanner />);

    expect(getByText(FEEDBACK_COPY.offline.message)).toBeTruthy();
    // jest-expo runs as iOS, where the alert role is silent without an
    // explicit VoiceOver announcement.
    expect(announce).toHaveBeenCalledWith(FEEDBACK_COPY.offline.message);
    announce.mockRestore();
  });
});
