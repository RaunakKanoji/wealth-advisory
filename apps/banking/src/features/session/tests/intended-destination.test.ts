import {
  clearIntendedDestination,
  consumeIntendedDestination,
  setIntendedDestination,
} from "@/src/features/session/services/intended-destination";

describe("intended destination", () => {
  beforeEach(() => {
    // The slot is module-level in-memory state; start every test empty.
    clearIntendedDestination();
  });

  it("returns null when nothing has been recorded", () => {
    expect(consumeIntendedDestination()).toBeNull();
  });

  it("returns the recorded destination exactly once", () => {
    setIntendedDestination("/(app)/(tabs)/portfolio");

    expect(consumeIntendedDestination()).toBe("/(app)/(tabs)/portfolio");
    expect(consumeIntendedDestination()).toBeNull();
  });

  it("clear() empties the slot so a later consume finds nothing", () => {
    setIntendedDestination("/(app)/(tabs)/portfolio");

    clearIntendedDestination();

    expect(consumeIntendedDestination()).toBeNull();
  });

  it("rejects paths that do not start with '/' by storing null", () => {
    setIntendedDestination("relative/path");

    expect(consumeIntendedDestination()).toBeNull();
  });

  it("a rejected path also wipes a previously recorded destination", () => {
    setIntendedDestination("/(app)/(tabs)/portfolio");

    setIntendedDestination("not-a-route");

    expect(consumeIntendedDestination()).toBeNull();
  });

  it("overwriting keeps only the latest destination", () => {
    setIntendedDestination("/(app)/(tabs)/portfolio");
    setIntendedDestination("/(app)/(tabs)/services");

    expect(consumeIntendedDestination()).toBe("/(app)/(tabs)/services");
    expect(consumeIntendedDestination()).toBeNull();
  });
});
