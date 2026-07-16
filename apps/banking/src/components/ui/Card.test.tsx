import { fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { Card } from "@/src/components/ui/Card";
import { render } from "@/src/testing/render";

describe("Card", () => {
  it("calls onPress when pressable", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Card onPress={onPress} accessibilityLabel="Goal card">
        <Text>Retirement</Text>
      </Card>,
    );

    await fireEvent.press(getByRole("button", { name: "Goal card" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders as static, non-interactive content with no onPress", async () => {
    const { queryByRole, getByText } = await render(
      <Card>
        <Text>Retirement</Text>
      </Card>,
    );

    expect(queryByRole("button")).toBeNull();
    expect(getByText("Retirement")).toBeTruthy();
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Card onPress={onPress} accessibilityLabel="Goal card" disabled>
        <Text>Retirement</Text>
      </Card>,
    );

    await fireEvent.press(getByRole("button", { name: "Goal card" }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
