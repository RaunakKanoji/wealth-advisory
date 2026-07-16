import { fireEvent } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import { NotFoundScreen } from "@/src/components/feedback/NotFoundScreen";
import { render } from "@/src/testing/render";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

describe("NotFoundScreen", () => {
  it("explains the page is missing and recovers via the root index", async () => {
    const replace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace });

    const { getByRole, getByText } = await render(<NotFoundScreen />);

    expect(getByText("Page not found")).toBeTruthy();

    await fireEvent.press(getByRole("button", { name: "Go to home" }));

    expect(replace).toHaveBeenCalledWith("/");
  });
});
