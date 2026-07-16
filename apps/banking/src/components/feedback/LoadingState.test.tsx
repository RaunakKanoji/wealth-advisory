import { LoadingState } from "@/src/components/feedback/LoadingState";
import { render } from "@/src/testing/render";

describe("LoadingState", () => {
  it("exposes a progressbar role with the label as its accessible name", async () => {
    const { getByRole } = await render(<LoadingState label="Loading goals" />);

    expect(getByRole("progressbar", { name: "Loading goals" })).toBeTruthy();
  });

  it("falls back to a generic accessible label when none is passed", async () => {
    const { getByRole } = await render(<LoadingState />);

    expect(getByRole("progressbar", { name: "Loading" })).toBeTruthy();
  });
});
