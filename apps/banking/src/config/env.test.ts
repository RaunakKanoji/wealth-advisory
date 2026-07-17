import { EnvConfigError, parseEnv } from "@/src/config/env";

const clerkEnv = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
} as const;

describe("parseEnv", () => {
  it("defaults to development with localhost API and Clerk authentication", () => {
    expect(parseEnv(clerkEnv)).toEqual({
      appEnv: "development",
      apiBaseUrl: "http://localhost:8080",
      useMockData: false,
      clerkPublishableKey: "pk_test_fixture",
    });
  });

  it("requires the Clerk publishable key in every environment", () => {
    expect(() => parseEnv({})).toThrow(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
    expect(() => parseEnv({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "" })).toThrow(
      /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/,
    );
  });

  it("enables mock data only when explicitly requested", () => {
    expect(parseEnv({ ...clerkEnv, EXPO_PUBLIC_USE_MOCK_DATA: "true" }).useMockData).toBe(true);
    expect(parseEnv({ ...clerkEnv, EXPO_PUBLIC_USE_MOCK_DATA: "false" }).useMockData).toBe(false);
  });

  it("accepts a fully specified production configuration", () => {
    expect(
      parseEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.example.bank",
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture",
      }),
    ).toEqual({
      appEnv: "production",
      apiBaseUrl: "https://api.example.bank",
      useMockData: false,
      clerkPublishableKey: "pk_live_fixture",
    });
  });

  it("rejects malformed environment values", () => {
    expect(() => parseEnv({ ...clerkEnv, EXPO_PUBLIC_APP_ENV: "staging" })).toThrow(
      EnvConfigError,
    );
    expect(() => parseEnv({ ...clerkEnv, EXPO_PUBLIC_API_BASE_URL: "not-a-url" })).toThrow(
      EnvConfigError,
    );
    expect(() => parseEnv({ ...clerkEnv, EXPO_PUBLIC_USE_MOCK_DATA: "yes" })).toThrow(
      EnvConfigError,
    );
  });

  it("requires the API URL outside development and HTTPS in production", () => {
    expect(() => parseEnv({ ...clerkEnv, EXPO_PUBLIC_APP_ENV: "preview" })).toThrow(
      /EXPO_PUBLIC_API_BASE_URL: required/,
    );
    expect(() => parseEnv({ ...clerkEnv, EXPO_PUBLIC_APP_ENV: "production" })).toThrow(
      /EXPO_PUBLIC_API_BASE_URL: required/,
    );
    expect(() =>
      parseEnv({
        ...clerkEnv,
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "http://api.example.bank",
      }),
    ).toThrow(/https in production/);
  });

  it("rejects integration mock data in production", () => {
    expect(() =>
      parseEnv({
        ...clerkEnv,
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.example.bank",
        EXPO_PUBLIC_USE_MOCK_DATA: "true",
      }),
    ).toThrow(/mock mode is development-only/);
  });
});
