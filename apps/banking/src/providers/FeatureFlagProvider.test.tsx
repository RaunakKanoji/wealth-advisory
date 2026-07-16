import { Text } from "react-native";

import { FeatureFlagProvider, useFeatureFlag } from "@/src/providers/FeatureFlagProvider";
import { render } from "@/src/testing/render";

function VoiceProbe() {
  const enabled = useFeatureFlag("copilotVoice");
  return <Text>{enabled ? "voice on" : "voice off"}</Text>;
}

describe("FeatureFlagProvider", () => {
  it("exposes the build's resolved flags by default", async () => {
    const { getByText } = await render(
      <FeatureFlagProvider>
        <VoiceProbe />
      </FeatureFlagProvider>,
    );
    expect(getByText("voice off")).toBeTruthy();
  });

  it("exposes injected flags for tests", async () => {
    const { getByText } = await render(
      <FeatureFlagProvider flags={{ copilotVoice: true, avatarAnimation: false }}>
        <VoiceProbe />
      </FeatureFlagProvider>,
    );
    expect(getByText("voice on")).toBeTruthy();
  });

  it("throws when useFeatureFlag is used outside the provider", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<VoiceProbe />)).rejects.toThrow(
      "useFeatureFlag must be used within FeatureFlagProvider",
    );
    consoleError.mockRestore();
  });
});
