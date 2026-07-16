import { fireEvent } from "@testing-library/react-native";

import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { RouteErrorFallback } from "@/src/components/feedback/RouteErrorFallback";
import { render } from "@/src/testing/render";

describe("RouteErrorFallback", () => {
  it("shows customer-safe copy, never the raw error", async () => {
    const { getByText, queryByText } = await render(
      <RouteErrorFallback error={new Error("ECONNREFUSED 10.0.0.1:8080")} retry={jest.fn()} />,
    );

    expect(getByText(FEEDBACK_COPY.appError.message)).toBeTruthy();
    expect(queryByText(/ECONNREFUSED/)).toBeNull();
  });

  it("retries via the router when the customer asks to try again", async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = await render(
      <RouteErrorFallback error={new Error("boom")} retry={retry} />,
    );

    await fireEvent.press(getByRole("button", { name: FEEDBACK_COPY.appError.retryLabel }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
