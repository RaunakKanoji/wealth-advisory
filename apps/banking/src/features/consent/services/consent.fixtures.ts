// DEVELOPMENT FIXTURES — deterministic, no real customer data. Used only by
// the dev consent adapter (consent.dev.ts) until the approved consent API
// is available.
//
// Judgment call (no source specifies this — documented in
// .project-context/migration/demo-inventory.md): banking-information and
// profile-and-kyc are required (the minimum needed for any advisory
// function); investments, loans-and-liabilities, and
// marketing-and-engagement are optional. Marketing is explicitly confirmed
// optional by both the task brief and docs/context/consent-and-compliance-context.md.

export const DEV_POLICY_VERSION = "dev-2026.1";

export const DEV_CONSENT_CATEGORY_DEFINITIONS = [
  {
    id: "banking-information",
    title: "Banking information",
    summary:
      "Account balances, transaction patterns, income deposits, and cash-flow activity across eligible IDBI accounts.",
    purposes: ["Build your financial overview", "Track spending and cash flow"],
    required: true,
  },
  {
    id: "investments",
    title: "Investments",
    summary:
      "Deposits, investments, holdings, and related portfolio information available through IDBI Bank.",
    purposes: ["Show your portfolio", "Assess diversification"],
    required: false,
  },
  {
    id: "loans-and-liabilities",
    title: "Loans and liabilities",
    summary: "Active loans, EMIs, outstanding balances, and other relevant liabilities.",
    purposes: ["Understand your full financial picture", "Assess affordability"],
    required: false,
  },
  {
    id: "profile-and-kyc",
    title: "Profile and KYC",
    summary:
      "Verified profile information such as age, occupation, contact details, and available KYC records.",
    purposes: ["Verify your identity", "Personalize guidance"],
    required: true,
  },
  {
    id: "marketing-and-engagement",
    title: "Marketing and engagement",
    summary:
      "Permission to receive relevant product information, educational content, and engagement communication.",
    purposes: ["Send product updates", "Share educational content"],
    required: false,
  },
] as const;

// Passing this as the customerId when submitting deterministically triggers
// a submission failure, for exercising the retry flow.
export const DEV_SERVICE_UNAVAILABLE_CUSTOMER_ID = "dev-consent-unavailable";
