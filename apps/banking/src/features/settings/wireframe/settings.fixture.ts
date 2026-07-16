import type { IconName } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the Settings detail wireframe.
// Fictional, generalized preferences grouped into sections. Not real data, not
// fetched, never persisted on device. Replaced by an authoritative settings
// API/service in a later task; nothing here should be treated as live state.

export type SettingsItem = {
  id: string;
  icon: IconName;
  label: string;
  value?: string;
};

export type SettingsGroup = {
  id: string;
  title: string;
  items: SettingsItem[];
};

export const SETTINGS_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  groups: [
    {
      id: "appearance",
      title: "Appearance",
      items: [
        { id: "theme", icon: "settings", label: "Theme", value: "System default" },
        { id: "language", icon: "documents", label: "Language", value: "English" },
      ],
    },
    {
      id: "notifications",
      title: "Notifications",
      items: [
        { id: "push", icon: "notifications", label: "Push notifications", value: "On" },
        { id: "email-alerts", icon: "documents", label: "Email alerts", value: "On" },
        { id: "advisory-nudges", icon: "recommendations", label: "Advisory nudges", value: "Weekly" },
      ],
    },
    {
      id: "security",
      title: "Security",
      items: [
        { id: "app-lock", icon: "consent", label: "App lock", value: "Biometric" },
        { id: "change-passcode", icon: "settings", label: "Change passcode" },
        { id: "login-activity", icon: "profile", label: "Login activity" },
      ],
    },
    {
      id: "consent",
      title: "Consent",
      items: [
        { id: "data-sharing", icon: "consent", label: "Data sharing consents", value: "3 active" },
        { id: "linked-accounts", icon: "wealth", label: "Linked accounts" },
        { id: "marketing", icon: "recommendations", label: "Marketing preferences", value: "Limited" },
      ],
    },
    {
      id: "accessibility",
      title: "Accessibility",
      items: [
        { id: "text-size", icon: "documents", label: "Text size", value: "Default" },
        { id: "screen-reader", icon: "copilot", label: "Screen reader hints", value: "Off" },
        { id: "reduce-motion", icon: "simulator", label: "Reduce motion", value: "Off" },
      ],
    },
    {
      id: "help",
      title: "Help",
      items: [
        { id: "help-centre", icon: "copilot", label: "Help centre" },
        { id: "contact-support", icon: "profile", label: "Contact support" },
        { id: "report-problem", icon: "recommendations", label: "Report a problem" },
      ],
    },
    {
      id: "about",
      title: "About",
      items: [
        { id: "version", icon: "settings", label: "App version", value: "IDBI Wealth Advisory • v1.0.0" },
        { id: "terms", icon: "documents", label: "Terms & privacy" },
        { id: "licences", icon: "documents", label: "Open-source licences" },
      ],
    },
  ] as SettingsGroup[],
} as const;
