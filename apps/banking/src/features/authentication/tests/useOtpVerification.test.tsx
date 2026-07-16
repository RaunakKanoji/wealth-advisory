import { act, renderHook } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import type { PropsWithChildren } from "react";

import { useOtpVerification } from "@/src/features/authentication/hooks/useOtpVerification";
import { authenticationService } from "@/src/features/authentication/services/authentication.service";
import { DEV_VALID_OTP } from "@/src/features/authentication/services/authentication.fixtures";
import { SessionProvider, useSession } from "@/src/providers/SessionProvider";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

function wrapper({ children }: PropsWithChildren) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe("useOtpVerification", () => {
  it("transitions the session to onboarding-required after a successful verification", async () => {
    const replace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace });

    const otpRequest = await authenticationService.requestOtp({ identifier: "9876543210" });

    const { result, unmount } = await renderHook(
      () => ({
        otp: useOtpVerification({
          identifier: "9876543210",
          initialRequestId: otpRequest.requestId,
          initialResendAvailableAt: otpRequest.resendAvailableAt,
        }),
        session: useSession(),
      }),
      { wrapper },
    );

    expect(result.current.session.status).toBe("unauthenticated");

    await act(async () => {
      result.current.otp.setCode(DEV_VALID_OTP);
    });
    await act(async () => {
      await result.current.otp.verify();
    });

    expect(result.current.session.status).toBe("onboarding-required");
    expect(replace).toHaveBeenCalledWith("/(onboarding)");

    unmount();
  });

  it("surfaces a customer-safe error and stays unauthenticated for an incorrect code", async () => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });

    const otpRequest = await authenticationService.requestOtp({ identifier: "9998887770" });

    const { result, unmount } = await renderHook(
      () => ({
        otp: useOtpVerification({
          identifier: "9998887770",
          initialRequestId: otpRequest.requestId,
          initialResendAvailableAt: otpRequest.resendAvailableAt,
        }),
        session: useSession(),
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.otp.setCode("000000");
    });
    await act(async () => {
      await result.current.otp.verify();
    });

    expect(result.current.otp.submitError).toBeTruthy();
    expect(result.current.session.status).toBe("unauthenticated");

    unmount();
  });
});
