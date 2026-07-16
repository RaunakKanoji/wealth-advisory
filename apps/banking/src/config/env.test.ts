import { EnvConfigError, parseEnv } from "@/src/config/env";

describe("parseEnv", () => {
  it("defaults to development with localhost API and mock mode off when nothing is set", () => {
    expect(parseEnv({})).toEqual({
      appEnv: "development",
      apiBaseUrl: "http://localhost:8080",
      useMockData: false,
    });
  });

  it("enables mock mode only when explicitly requested", () => {
    expect(parseEnv({ EXPO_PUBLIC_USE_MOCK_DATA: "true" }).useMockData).toBe(true);
    expect(parseEnv({ EXPO_PUBLIC_USE_MOCK_DATA: "false" }).useMockData).toBe(false);
  });

  it("accepts a fully specified production configuration", () => {
    expect(
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.example.bank",
      }),
    ).toEqual({
      appEnv: "production",
      apiBaseUrl: "https://api.example.bank",
      useMockData: false,
    });
  });

  it("accepts a preview configuration with an API base URL", () => {
    expect(
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "preview",
        EXPO_PUBLIC_API_BASE_URL: "https://preview.api.example.bank",
      }).appEnv,
    ).toBe("preview");
  });

  it("rejects an unknown app environment", () => {
    expect(() => parseEnv({ EXPO_PUBLIC_APP_ENV: "staging" })).toThrow(EnvConfigError);
  });

  it("rejects a malformed API base URL", () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_BASE_URL: "not-a-url" })).toThrow(EnvConfigError);
  });

  it("rejects a mock-mode value that is not exactly true or false", () => {
    expect(() => parseEnv({ EXPO_PUBLIC_USE_MOCK_DATA: "yes" })).toThrow(EnvConfigError);
  });

  it("fails safely when preview or production is missing the API base URL", () => {
    expect(() => parseEnv({ EXPO_PUBLIC_APP_ENV: "preview" })).toThrow(
      /EXPO_PUBLIC_API_BASE_URL: required/,
    );
    expect(() => parseEnv({ EXPO_PUBLIC_APP_ENV: "production" })).toThrow(
      /EXPO_PUBLIC_API_BASE_URL: required/,
    );
  });

  it("rejects a non-https API base URL in production", () => {
    expect(() =>
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "http://api.example.bank",
      }),
    ).toThrow(/https in production/);
  });

  it("allows http API base URLs outside production", () => {
    expect(
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "preview",
        EXPO_PUBLIC_API_BASE_URL: "http://preview.api.example.bank",
      }).apiBaseUrl,
    ).toBe("http://preview.api.example.bank");
  });

  it("rejects mock mode in production, even when explicitly disabled", () => {
    const base = {
      EXPO_PUBLIC_APP_ENV: "production",
      EXPO_PUBLIC_API_BASE_URL: "https://api.example.bank",
    };
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_USE_MOCK_DATA: "true" })).toThrow(
      /mock mode is development-only/,
    );
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_USE_MOCK_DATA: "false" })).toThrow(
      /mock mode is development-only/,
    );
  });

  it("reports every problem at once", () => {
    try {
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_USE_MOCK_DATA: "true",
      });
      throw new Error("expected parseEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvConfigError);
      expect((error as Error).message).toMatch(/EXPO_PUBLIC_API_BASE_URL: required/);
      expect((error as Error).message).toMatch(/mock mode is development-only/);
    }
  });
});
