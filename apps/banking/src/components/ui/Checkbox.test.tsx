import { fireEvent } from "@testing-library/react-native";

import { Checkbox } from "@/src/components/ui/Checkbox";
import { render } from "@/src/testing/render";

describe("Checkbox", () => {
  it("exposes a checkbox role and checked state for screen readers", async () => {
    const { getByRole } = await render(
      <Checkbox checked={false} onChange={() => {}} label="I agree" />,
    );

    const checkbox = getByRole("checkbox", { name: "I agree" });
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  });

  it("toggles checked state on press", async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree" />,
    );

    await fireEvent.press(getByRole("checkbox", { name: "I agree" }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree" disabled />,
    );

    await fireEvent.press(getByRole("checkbox", { name: "I agree" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
