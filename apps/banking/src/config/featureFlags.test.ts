import { EnvConfigError } from "@/src/config/env";
import { DEFAULT_FLAGS, resolveFeatureFlags } from "@/src/config/featureFlags";

describe("resolveFeatureFlags", () => {
  it("returns the defaults when no overrides are set", () => {
    expect(resolveFeatureFlags({}, "development")).toEqual(DEFAULT_FLAGS);
    expect(resolveFeatureFlags({}, "production")).toEqual(DEFAULT_FLAGS);
  });

  it("does not mutate the shared defaults", () => {
    const flags = resolveFeatureFlags({ copilotVoice: "true" }, "development");
    expect(flags.copilotVoice).toBe(true);
    expect(DEFAULT_FLAGS.copilotVoice).toBe(false);
  });

  it("applies explicit overrides in development", () => {
    expect(
      resolveFeatureFlags({ copilotVoice: "true", avatarAnimation: "false" }, "development"),
    ).toEqual({ copilotVoice: true, avatarAnimation: false });
  });

  it("applies explicit overrides in preview", () => {
    expect(resolveFeatureFlags({ avatarAnimation: "true" }, "preview").avatarAnimation).toBe(true);
  });

  it("rejects any override in production", () => {
    expect(() => resolveFeatureFlags({ copilotVoice: "false" }, "production")).toThrow(
      /not allowed in production/,
    );
  });

  it("rejects override values that are not exactly true or false", () => {
    expect(() => resolveFeatureFlags({ copilotVoice: "yes" }, "development")).toThrow(
      EnvConfigError,
    );
  });
});
