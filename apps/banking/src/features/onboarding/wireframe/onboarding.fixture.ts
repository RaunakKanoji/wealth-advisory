import type { RadioOption } from "@/src/components/ui";

// WIREFRAME_ONLY — static placeholder content for the onboarding step
// screens (financial profile, risk profile, completion). Fictional customer,
// generalized figures. Nothing here is fetched, scored, or calculated on
// device; an authoritative service replaces it in a later task. Nothing here
// should be treated as a source of financial truth.

export const ONBOARDING_WIREFRAME = {
  kind: "WIREFRAME_ONLY",
  totalSteps: 3,

  // Step 1 — read-only review of what the bank already knows.
  financialProfile: {
    step: 1,
    title: "Financial profile",
    description:
      "Here's the snapshot we've assembled from your linked accounts. Review it before we tailor your advice.",
    summarySections: [
      {
        title: "Banking summary",
        rows: [
          { label: "Primary savings account", value: "₹3,20,000" },
          { label: "Current account", value: "₹85,000" },
          { label: "Fixed deposits", value: "₹6,50,000" },
        ],
      },
      {
        title: "Income & cash flow",
        rows: [
          { label: "Average monthly credits", value: "₹1,45,000" },
          { label: "Average monthly debits", value: "₹92,000" },
          { label: "Typical monthly surplus", value: "₹53,000" },
        ],
      },
      {
        title: "Investments",
        rows: [
          { label: "Mutual funds", value: "₹8,10,000" },
          { label: "Equities", value: "₹4,25,000" },
          { label: "Gold & bonds", value: "₹1,60,000" },
        ],
      },
      {
        title: "Loans & liabilities",
        rows: [
          { label: "Home loan outstanding", value: "₹18,40,000" },
          { label: "Auto loan outstanding", value: "₹2,10,000" },
          { label: "Credit card dues", value: "₹35,000" },
        ],
      },
    ],
    profileDetails: {
      title: "Profile details",
      note: "Prefilled from your bank records. Editing is not available in this preview.",
      fields: [
        { label: "Full name", value: "Ananya Sharma" },
        { label: "Date of birth", value: "12 Aug 1989" },
        { label: "Employment type", value: "Salaried" },
        { label: "City", value: "Pune" },
      ],
    },
  },

  // Step 2 — a single sample assessment question. The selection is visual
  // only; there is NO scoring anywhere in the wireframe.
  riskProfile: {
    step: 2,
    title: "Risk profile",
    intro:
      "A few quick questions help us understand how you feel about risk and returns. There are no right or wrong answers.",
    questionCounter: "Question 1 of 8",
    question:
      "Markets can swing sharply in the short term. If your portfolio dropped 15% in a month, what would you most likely do?",
    options: [
      {
        value: "conservative",
        label: "Move everything to safer options",
        description: "Protecting my capital matters most.",
      },
      {
        value: "moderate-conservative",
        label: "Shift some money to safer options",
        description: "I'd reduce risk but stay partly invested.",
      },
      {
        value: "moderate-aggressive",
        label: "Hold steady and wait it out",
        description: "Short-term dips don't worry me much.",
      },
      {
        value: "aggressive",
        label: "Invest more while prices are low",
        description: "I see a drop as a chance to buy in.",
      },
    ] as RadioOption[],
  },

  // Step 3 — celebration + summary of what onboarding set up.
  completion: {
    step: 3,
    title: "You're all set",
    subtitle: "Your wealth advisory workspace is ready.",
    summary: [
      {
        label: "Consent granted",
        detail: "You shared access to your banking and investment data.",
      },
      {
        label: "Financial profile reviewed",
        detail: "We assembled a snapshot from your linked accounts.",
      },
      {
        label: "Risk profile completed",
        detail: "Your comfort with risk and returns is on record.",
      },
    ],
    note: "You can update any of these later from Profile and settings.",
  },
} as const;
