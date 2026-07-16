import type { IconName } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Profile tab wireframe.
// Fictional customer, generalized values, no real PII or account numbers. Not
// fetched, never derived on device. An authoritative profile/account service
// replaces this in a later task; navigation targets stay in the screen, so the
// fixture carries only display copy and a semantic icon name per entry.

export type ProfileNavItem = { id: string; icon: IconName; label: string; detail: string };
export type ProfileSection = { id: string; title: string; items: ProfileNavItem[] };

export const PROFILE_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  customer: {
    name: "Ananya Rao",
    initials: "AR",
    maskedId: "Member • •••• 4321",
    tier: "Priority Wealth",
    memberSince: "Member since Mar 2019",
  },

  sections: [
    {
      id: "account",
      title: "Account",
      items: [
        {
          id: "consent",
          icon: "consent",
          label: "Consent & permissions",
          detail: "Manage data-sharing approvals",
        },
        {
          id: "security",
          icon: "settings",
          label: "Security",
          detail: "Sign-in, devices & alerts",
        },
        {
          id: "preferences",
          icon: "profile",
          label: "Preferences",
          detail: "Language, notifications & display",
        },
      ] as ProfileNavItem[],
    },
    {
      id: "more",
      title: "Reports & support",
      items: [
        {
          id: "reports",
          icon: "documents",
          label: "Reports",
          detail: "Portfolio & advisory statements",
        },
        {
          id: "settings",
          icon: "settings",
          label: "Settings",
          detail: "App configuration",
        },
        {
          id: "support",
          icon: "copilot",
          label: "Support",
          detail: "Chat with the advisory desk",
        },
        {
          id: "legal",
          icon: "documents",
          label: "Legal & disclosures",
          detail: "Terms, privacy & regulatory notices",
        },
      ] as ProfileNavItem[],
    },
  ] as ProfileSection[],
} as const;
