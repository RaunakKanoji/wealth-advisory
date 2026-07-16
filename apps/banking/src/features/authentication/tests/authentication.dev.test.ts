import { createDevAuthenticationService } from "@/src/features/authentication/services/authentication.dev";
import {
  DEV_EXPIRED_OTP,
  DEV_RATE_LIMITED_IDENTIFIER,
  DEV_SERVICE_UNAVAILABLE_IDENTIFIER,
  DEV_VALID_OTP,
} from "@/src/features/authentication/services/authentication.fixtures";

describe("createDevAuthenticationService", () => {
  it("requests an OTP and verifies successfully with the correct code", async () => {
    const service = createDevAuthenticationService();
    const request = await service.requestOtp({ identifier: "9876543210" });

    const result = await service.verifyOtp({
      requestId: request.requestId,
      identifier: "9876543210",
      code: DEV_VALID_OTP,
    });

    expect(result.user).toEqual({ id: "dev-user-9876543210", identifier: "9876543210" });
  });

  it("rejects an incorrect code as invalid-otp", async () => {
    const service = createDevAuthenticationService();
    const request = await service.requestOtp({ identifier: "9876543210" });

    await expect(
      service.verifyOtp({ requestId: request.requestId, identifier: "9876543210", code: "000000" }),
    ).rejects.toMatchObject({ code: "invalid-otp" });
  });

  it("rejects the documented expired-code fixture as expired-otp", async () => {
    const service = createDevAuthenticationService();
    const request = await service.requestOtp({ identifier: "9876543210" });

    await expect(
      service.verifyOtp({
        requestId: request.requestId,
        identifier: "9876543210",
        code: DEV_EXPIRED_OTP,
      }),
    ).rejects.toMatchObject({ code: "expired-otp" });
  });

  it("rejects requesting an OTP for the service-unavailable fixture identifier", async () => {
    const service = createDevAuthenticationService();

    await expect(
      service.requestOtp({ identifier: DEV_SERVICE_UNAVAILABLE_IDENTIFIER }),
    ).rejects.toMatchObject({ code: "service-unavailable" });
  });

  it("rejects requesting an OTP for the rate-limited fixture identifier", async () => {
    const service = createDevAuthenticationService();

    await expect(
      service.requestOtp({ identifier: DEV_RATE_LIMITED_IDENTIFIER }),
    ).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("issues a new requestId on resend, invalidating the previous one", async () => {
    const service = createDevAuthenticationService();
    const first = await service.requestOtp({ identifier: "9876543210" });
    const resent = await service.resendOtp({ requestId: first.requestId, identifier: "9876543210" });

    expect(resent.requestId).not.toBe(first.requestId);

    await expect(
      service.verifyOtp({ requestId: first.requestId, identifier: "9876543210", code: DEV_VALID_OTP }),
    ).rejects.toMatchObject({ code: "invalid-otp" });

    const result = await service.verifyOtp({
      requestId: resent.requestId,
      identifier: "9876543210",
      code: DEV_VALID_OTP,
    });
    expect(result.user.identifier).toBe("9876543210");
  });
});
