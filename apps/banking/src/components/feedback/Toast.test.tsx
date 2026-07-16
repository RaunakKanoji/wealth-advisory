import { act, fireEvent } from "@testing-library/react-native";

import { ToastProvider, useToast } from "@/src/components/feedback/Toast";
import { Button } from "@/src/components/ui/Button";
import { render } from "@/src/testing/render";

function ShowToastButton({ text }: { text: string }) {
  const { showToast } = useToast();
  return <Button label={`Notify ${text}`} onPress={() => showToast(text)} />;
}

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a toast when requested", async () => {
    const { getByRole, getByText } = await render(
      <ToastProvider>
        <ShowToastButton text="Goal saved" />
      </ToastProvider>,
    );

    await fireEvent.press(getByRole("button", { name: "Notify Goal saved" }));

    expect(getByText("Goal saved")).toBeTruthy();
  });

  it("dismisses the toast automatically after 4 seconds", async () => {
    const { getByRole, queryByText } = await render(
      <ToastProvider>
        <ShowToastButton text="Goal saved" />
      </ToastProvider>,
    );

    await fireEvent.press(getByRole("button", { name: "Notify Goal saved" }));

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    expect(queryByText("Goal saved")).toBeNull();
  });

  it("stacks toasts and dismisses each on its own schedule", async () => {
    const { getByRole, getByText, queryByText } = await render(
      <ToastProvider>
        <ShowToastButton text="First" />
        <ShowToastButton text="Second" />
      </ToastProvider>,
    );

    await fireEvent.press(getByRole("button", { name: "Notify First" }));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await fireEvent.press(getByRole("button", { name: "Notify Second" }));

    expect(getByText("First")).toBeTruthy();
    expect(getByText("Second")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(queryByText("First")).toBeNull();
    expect(getByText("Second")).toBeTruthy();
  });

  it("throws when useToast is used outside ToastProvider", async () => {
    function Bare() {
      useToast();
      return null;
    }

    await expect(render(<Bare />)).rejects.toThrow(
      "useToast must be used within ToastProvider",
    );
  });
});
