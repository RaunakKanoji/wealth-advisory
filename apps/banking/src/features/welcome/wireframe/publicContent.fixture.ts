import type { IconName } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder copy for the public shell pages
// (Disclosures + Support). Generalized, clearly illustrative text; not real
// regulatory language, not real contact details. Replaced by authoritative,
// compliance-reviewed content in a later task; nothing here should be treated
// as legal, financial, or contact-of-record information.

export type DisclosureItem = { id: string; title: string; body: string };

export type SupportContact = {
  id: string;
  icon: IconName;
  label: string;
  value: string;
};

export type SupportFaq = { id: string; q: string; a: string };

export const PUBLIC_CONTENT_WIREFRAME = {
  kind: "WIREFRAME_ONLY",

  disclosures: [
    {
      id: "regulatory",
      title: "Regulatory information",
      body: "This preview is provided by a wealth advisory service operating under the applicable banking and securities regulations. Registration and licensing details would appear here in the live experience, along with the relevant regulator names and reference numbers.",
    },
    {
      id: "risk",
      title: "Investment risk disclaimer",
      body: "Investments are subject to market risk and the value of holdings can go up as well as down. Past performance is not indicative of future results. Any figures shown across this app are illustrative placeholders and must not be used to make financial decisions.",
    },
    {
      id: "scope",
      title: "Advisory scope",
      body: "Guidance offered here is general in nature and does not account for your complete personal circumstances. It is not a personalised recommendation to buy, sell, or hold any specific product. Please consult a qualified advisor before acting on any information.",
    },
    {
      id: "grievance",
      title: "Grievance redressal",
      body: "If you have a concern or complaint, a structured grievance process would be described here, including escalation levels, expected response times, and the contact points for the internal ombudsman and external redressal forums.",
    },
  ] as DisclosureItem[],

  support: {
    contacts: [
      {
        id: "phone",
        icon: "copilot",
        label: "Phone",
        value: "1800 000 0000 (toll-free, sample)",
      },
      {
        id: "email",
        icon: "documents",
        label: "Email",
        value: "care@example-advisory.test",
      },
      {
        id: "branch",
        icon: "home",
        label: "Nearest branch",
        value: "IDBI Sample Branch, MG Road",
      },
    ] as SupportContact[],

    faqs: [
      {
        id: "data",
        q: "How is my banking information used?",
        a: "Your information is only used after you review and grant permission, and you can change your choices later. This is placeholder text for the preview.",
      },
      {
        id: "advice",
        q: "Is the guidance a formal recommendation?",
        a: "No. Everything in this preview is general and illustrative. It is not personalised financial advice and figures shown are sample values.",
      },
      {
        id: "reset",
        q: "How do I reset access to my account?",
        a: "In the live experience you would find guided steps to recover access here, with identity verification handled through secure channels.",
      },
    ] as SupportFaq[],

    hours: "Service hours: Mon-Sat, 9:00 AM - 6:00 PM IST (sample)",
  },
} as const;
