import { fireEvent } from "@testing-library/react-native";

import { EmptyState } from "@/src/components/feedback/EmptyState";
import { render } from "@/src/testing/render";

describe("EmptyState", () => {
  it("shows the empty message", async () => {
    const { getByText } = await render(<EmptyState message="No goals yet" />);

    expect(getByText("No goals yet")).toBeTruthy();
  });

  it("calls onAction when the action button is pressed", async () => {
    const onAction = jest.fn();
    const { getByRole } = await render(
      <EmptyState message="No goals yet" actionLabel="Create a goal" onAction={onAction} />,
    );

    await fireEvent.press(getByRole("button", { name: "Create a goal" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders no button unless both actionLabel and onAction are provided", async () => {
    const { queryByRole } = await render(
      <EmptyState message="No goals yet" actionLabel="Create a goal" />,
    );

    expect(queryByRole("button")).toBeNull();
  });
});
