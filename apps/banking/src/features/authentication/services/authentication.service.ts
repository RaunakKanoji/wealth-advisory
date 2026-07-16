import { createDevAuthenticationService } from "@/src/features/authentication/services/authentication.dev";
import type {
  RequestOtpInput,
  RequestOtpResult,
  ResendOtpInput,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";

export interface AuthenticationService {
  requestOtp(input: RequestOtpInput): Promise<RequestOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  resendOtp(input: ResendOtpInput): Promise<RequestOtpResult>;
}

// Swap this for a real bank-API-backed implementation once approved.
// Screens and hooks depend only on the AuthenticationService interface
// above, so nothing outside this file needs to change when that happens.
export const authenticationService: AuthenticationService = createDevAuthenticationService();
