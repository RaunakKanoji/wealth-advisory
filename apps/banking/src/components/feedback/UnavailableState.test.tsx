import { fireEvent } from "@testing-library/react-native";

import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { UnavailableState } from "@/src/components/feedback/UnavailableState";
import { render } from "@/src/testing/render";

describe("UnavailableState", () => {
  it("shows customer-safe unavailable copy by default", async () => {
    const { getByText } = await render(<UnavailableState />);

    expect(getByText(FEEDBACK_COPY.unavailable.message)).toBeTruthy();
  });

  it("calls onRetry when the retry button is pressed", async () => {
    const onRetry = jest.fn();
    const { getByRole } = await render(<UnavailableState onRetry={onRetry} />);

    await fireEvent.press(getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a retry button when onRetry is omitted", async () => {
    const { queryByRole } = await render(<UnavailableState />);

    expect(queryByRole("button")).toBeNull();
  });
});
