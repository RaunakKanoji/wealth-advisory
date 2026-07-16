import type {
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";

/**
 * The single authentication boundary. Screens and hooks depend on this
 * interface only — they must not know whether the active implementation is
 * the deterministic mock, Clerk, or the future bank adapter. Adapter
 * selection happens in authentication.factory.ts from typed runtime
 * configuration.
 */
export interface AuthenticationService {
  requestOtp(input: RequestOtpInput): Promise<RequestOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  resendOtp(challengeId: string): Promise<RequestOtpResult>;
  signOut(): Promise<void>;
}
