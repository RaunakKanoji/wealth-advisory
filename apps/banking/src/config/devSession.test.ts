import { EnvConfigError } from "@/src/config/env";
import { resolveDevSessionShell } from "@/src/config/devSession";

describe("resolveDevSessionShell", () => {
  it("returns null (normal session bootstrap) when the switch is unset", () => {
    expect(resolveDevSessionShell(undefined, "development")).toBeNull();
    expect(resolveDevSessionShell("", "development")).toBeNull();
  });

  it("passes each shell keyword through in development", () => {
    expect(resolveDevSessionShell("public", "development")).toBe("public");
    expect(resolveDevSessionShell("onboarding", "development")).toBe("onboarding");
    expect(resolveDevSessionShell("authenticated", "development")).toBe("authenticated");
  });

  it("also honors the switch in preview builds", () => {
    expect(resolveDevSessionShell("authenticated", "preview")).toBe("authenticated");
  });

  it("rejects an unknown shell keyword", () => {
    expect(() => resolveDevSessionShell("dashboard", "development")).toThrow(EnvConfigError);
  });

  it("refuses to honor the switch in production, so it can never ship to customers", () => {
    expect(() => resolveDevSessionShell("authenticated", "production")).toThrow(EnvConfigError);
  });

  it("leaves production untouched when the switch is unset", () => {
    expect(resolveDevSessionShell(undefined, "production")).toBeNull();
  });
});
