import { fireEvent } from "@testing-library/react-native";

import { ErrorState } from "@/src/components/feedback/ErrorState";
import { render } from "@/src/testing/render";

describe("ErrorState", () => {
  it("shows customer-safe copy by default, never a raw error message", async () => {
    const { getByText } = await render(<ErrorState />);

    expect(getByText("Something went wrong. Please try again.")).toBeTruthy();
  });

  it("calls onRetry when the retry button is pressed", async () => {
    const onRetry = jest.fn();
    const { getByRole } = await render(<ErrorState onRetry={onRetry} />);

    await fireEvent.press(getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a retry button when onRetry is omitted", async () => {
    const { queryByRole } = await render(<ErrorState />);

    expect(queryByRole("button")).toBeNull();
  });
});
