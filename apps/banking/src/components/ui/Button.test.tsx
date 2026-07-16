import { fireEvent } from "@testing-library/react-native";

import { Button } from "@/src/components/ui/Button";
import { render } from "@/src/testing/render";

describe("Button", () => {
  it("calls onPress when enabled", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Continue" onPress={onPress} />);

    await fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Continue" disabled onPress={onPress} />);

    await fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("marks itself busy and disabled while loading, keeping its accessible name", async () => {
    const { getByRole } = await render(<Button label="Continue" loading onPress={() => {}} />);

    const button = getByRole("button", { name: "Continue" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });

  it("hides the visible label while loading", async () => {
    const { queryByText } = await render(<Button label="Continue" loading onPress={() => {}} />);

    expect(queryByText("Continue")).toBeNull();
  });
});
