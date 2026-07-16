import { fireEvent } from "@testing-library/react-native";

import { RadioGroup } from "@/src/components/ui/RadioGroup";
import { render } from "@/src/testing/render";

const OPTIONS = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "growth", label: "Growth" },
];

describe("RadioGroup", () => {
  it("marks the selected option and leaves the others unselected", async () => {
    const { getByRole } = await render(
      <RadioGroup options={OPTIONS} value="balanced" onChange={() => {}} />,
    );

    expect(getByRole("radio", { name: "Balanced" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(getByRole("radio", { name: "Conservative" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("calls onChange with the pressed option's value", async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <RadioGroup options={OPTIONS} value="balanced" onChange={onChange} />,
    );

    await fireEvent.press(getByRole("radio", { name: "Growth" }));

    expect(onChange).toHaveBeenCalledWith("growth");
  });
});
