import { EnvConfigError } from "@/src/config/env";
import { resolveDevSessionStatus } from "@/src/config/devSession";

describe("resolveDevSessionStatus", () => {
  it("defaults to unauthenticated (the real entry point) when the switch is unset", () => {
    expect(resolveDevSessionStatus(undefined, "development")).toBe("unauthenticated");
    expect(resolveDevSessionStatus("", "development")).toBe("unauthenticated");
  });

  it("maps each shell keyword to its session status in development", () => {
    expect(resolveDevSessionStatus("public", "development")).toBe("unauthenticated");
    expect(resolveDevSessionStatus("onboarding", "development")).toBe("onboarding-required");
    expect(resolveDevSessionStatus("authenticated", "development")).toBe("active");
  });

  it("also honors the switch in preview builds", () => {
    expect(resolveDevSessionStatus("authenticated", "preview")).toBe("active");
  });

  it("rejects an unknown shell keyword", () => {
    expect(() => resolveDevSessionStatus("dashboard", "development")).toThrow(EnvConfigError);
  });

  it("refuses to honor the switch in production, so it can never ship to customers", () => {
    expect(() => resolveDevSessionStatus("authenticated", "production")).toThrow(EnvConfigError);
  });

  it("leaves production untouched when the switch is unset", () => {
    expect(resolveDevSessionStatus(undefined, "production")).toBe("unauthenticated");
  });
});
