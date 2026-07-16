import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useConsent } from "@/src/features/consent/hooks/useConsent";
import { ConsentProvider } from "@/src/features/consent/state/ConsentProvider";
import { SessionProvider } from "@/src/features/session";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConsentProvider>{children}</ConsentProvider>
    </SessionProvider>
  );
}

async function renderLoadedConsent() {
  const { result } = await renderHook(() => useConsent(), { wrapper });
  await waitFor(() => expect(result.current.state.phase).toBe("editing"));
  return result;
}

describe("ConsentProvider — selection", () => {
  it("persists toggling an optional category", async () => {
    const result = await renderLoadedConsent();
    const optional = result.current.optionalCategories[0];

    await act(async () => {
      result.current.toggleCategory(optional.id);
    });

    const updated = result.current.state.categories.find((c) => c.id === optional.id);
    expect(updated?.selected).toBe(true);
  });

  it("does not allow toggling a required category off", async () => {
    const result = await renderLoadedConsent();
    const required = result.current.requiredCategories[0];
    expect(required.selected).toBe(true);

    await act(async () => {
      result.current.toggleCategory(required.id);
    });

    const updated = result.current.state.categories.find((c) => c.id === required.id);
    expect(updated?.selected).toBe(true);
  });
});

describe("ConsentProvider — details", () => {
  it("opens and closes category details", async () => {
    const result = await renderLoadedConsent();
    const category = result.current.state.categories[0];

    await act(async () => {
      result.current.openDetails(category.id);
    });
    expect(result.current.state.detailsCategoryId).toBe(category.id);

    await act(async () => {
      result.current.closeDetails();
    });
    expect(result.current.state.detailsCategoryId).toBeNull();
  });
});

describe("ConsentProvider — review and submission", () => {
  it("blocks submission when the review acknowledgement has not been given", async () => {
    const result = await renderLoadedConsent();

    await act(async () => {
      result.current.goToReview();
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state.phase).toBe("submission-error");
    expect(result.current.state.errorMessage).toMatch(/confirm/i);
  });

  it("submits successfully once acknowledged, producing a receipt", async () => {
    const result = await renderLoadedConsent();

    await act(async () => {
      result.current.goToReview();
      result.current.setAcknowledged(true);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state.phase).toBe("submitted");
    expect(result.current.state.receipt).not.toBeNull();
    expect(result.current.state.receipt?.decisions.length).toBe(
      result.current.state.categories.length,
    );
  });
});
