import { TextField } from "@/src/components/ui/TextField";
import { render } from "@/src/testing/render";

describe("TextField", () => {
  it("renders the error message with an alert role", async () => {
    const { getByText } = await render(<TextField label="Email" error="Enter a valid email" />);

    const error = getByText("Enter a valid email");
    expect(error.props.accessibilityRole).toBe("alert");
  });

  it("does not render an error message when none is passed", async () => {
    const { queryByText } = await render(<TextField label="Email" />);

    expect(queryByText("Enter a valid email")).toBeNull();
  });

  it("exposes the label as the input's accessible label", async () => {
    const { getByLabelText } = await render(<TextField label="Email" />);

    expect(getByLabelText("Email")).toBeTruthy();
  });
});
