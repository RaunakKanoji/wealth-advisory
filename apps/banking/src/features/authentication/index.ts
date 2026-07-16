export { OtpVerificationScreen } from "@/src/features/authentication/screens/OtpVerificationScreen";
export { SignInScreen } from "@/src/features/authentication/screens/SignInScreen";
export { useSignOut } from "@/src/features/authentication/hooks/useSignOut";
export { OTP_LENGTH, maskMobileNumber } from "@/src/features/authentication/models/authentication";
export type {
  AuthenticatedCustomer,
  AuthenticationSession,
  CustomerIdentifierType,
  CustomerOnboardingStatus,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
export {
  AuthenticationServiceError,
  getAuthenticationErrorMessage,
  isAuthenticationError,
  normalizeAuthenticationError,
} from "@/src/features/authentication/models/authentication-errors";
export type {
  AuthenticationError,
  AuthenticationErrorCode,
} from "@/src/features/authentication/models/authentication-errors";
export type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";
export {
  AuthenticationServiceProvider,
  useAuthenticationService,
} from "@/src/features/authentication/services/authentication.context";
