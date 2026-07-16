import { fireEvent } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import { WelcomeScreen } from "@/src/features/welcome/screens/WelcomeScreen";
import { render } from "@/src/testing/render";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

describe("WelcomeScreen", () => {
  it("navigates to sign-in when the customer continues", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });

    const { getByRole } = await render(<WelcomeScreen />);

    await fireEvent.press(getByRole("button", { name: "Get started" }));

    expect(push).toHaveBeenCalledWith("/(auth)/sign-in");
  });
});
