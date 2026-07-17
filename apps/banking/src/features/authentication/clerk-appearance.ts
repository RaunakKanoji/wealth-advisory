import { colors, radius } from "@/src/theme";

// Appearance for Clerk's WEB components (SignIn/SignUp/UserProfile/
// UserButton) — the web counterpart of clerk-theme.json, which themes the
// NATIVE components at prebuild. Both map the same IDBI design tokens so the
// prebuilt auth surfaces match the app on every platform.
//
// Passed once on ClerkProvider (the root layout); native builds simply ignore
// web-only appearance settings.
export const clerkAppearance = {
  variables: {
    colorPrimary: colors.brandPrimary,
    colorText: colors.textPrimary,
    colorTextSecondary: colors.textSecondary,
    colorTextOnPrimaryBackground: colors.textInverse,
    colorBackground: colors.surface,
    colorInputBackground: colors.surface,
    colorInputText: colors.textPrimary,
    colorNeutral: colors.textSecondary,
    colorDanger: colors.error,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    borderRadius: `${radius.control}px`,
  },
} as const;
