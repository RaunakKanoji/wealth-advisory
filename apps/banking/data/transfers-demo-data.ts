import { DEMO_CUSTOMER_A, DEMO_CUSTOMER_B, DEMO_SCENARIO_DATE, DEMO_SOURCE_LABEL } from "@/data/accounts-demo-data";
import type { Beneficiary } from "@/types/transfers";

type SeedBeneficiary = Beneficiary & {
  accountNumber?: string;
};

function beneficiary(input: Omit<SeedBeneficiary, "sourceEnvironment" | "updatedAt">): SeedBeneficiary {
  return {
    ...input,
    sourceEnvironment: DEMO_SOURCE_LABEL,
    updatedAt: DEMO_SCENARIO_DATE,
  };
}

export const demoBeneficiaries: Record<string, SeedBeneficiary[]> = {
  [DEMO_CUSTOMER_A]: [
    beneficiary({
      id: "beneficiary-a-sunita",
      customerId: DEMO_CUSTOMER_A,
      type: "bank-account",
      nickname: "Sunita Sharma",
      bankReturnedName: "Sunita Sharma",
      enteredName: "Sunita Sharma",
      accountNumber: "001234567890",
      maskedAccountNumber: "•••• 7890",
      ifsc: "IBKL0000123",
      bankName: "IDBI Bank",
      status: "active",
      resolutionStatus: "resolved",
      lookupReference: "LOOKUP-DEMO-SUNITA",
      lookupAt: DEMO_SCENARIO_DATE,
      registeredAt: DEMO_SCENARIO_DATE,
      revision: 1,
    }),
    beneficiary({
      id: "beneficiary-a-activation",
      customerId: DEMO_CUSTOMER_A,
      type: "bank-account",
      nickname: "New recipient",
      bankReturnedName: "Vikram Mehta",
      enteredName: "Vikram Mehta",
      accountNumber: "009876543210",
      maskedAccountNumber: "•••• 3210",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
      status: "cooling-off",
      resolutionStatus: "resolved",
      lookupReference: "LOOKUP-DEMO-VIKRAM",
      lookupAt: DEMO_SCENARIO_DATE,
      eligibleAt: "2026-09-08T12:00:00.000Z",
      revision: 1,
    }),
    beneficiary({
      id: "beneficiary-a-upi",
      customerId: DEMO_CUSTOMER_A,
      type: "upi",
      nickname: "Aarav Demo UPI",
      bankReturnedName: "Demo UPI Recipient",
      enteredName: "Demo UPI Recipient",
      upiId: "success@demo",
      status: "active",
      resolutionStatus: "resolved",
      lookupReference: "UPI-LOOKUP-DEMO-SUCCESS",
      lookupAt: DEMO_SCENARIO_DATE,
      registeredAt: DEMO_SCENARIO_DATE,
      revision: 1,
    }),
  ],
  [DEMO_CUSTOMER_B]: [
    beneficiary({
      id: "beneficiary-b-upi",
      customerId: DEMO_CUSTOMER_B,
      type: "upi",
      nickname: "Nisha Demo UPI",
      bankReturnedName: "Nisha Demo Recipient",
      enteredName: "Nisha Demo Recipient",
      upiId: "nisha@demo",
      status: "active",
      resolutionStatus: "resolved",
      lookupReference: "UPI-LOOKUP-DEMO-B",
      lookupAt: DEMO_SCENARIO_DATE,
      registeredAt: DEMO_SCENARIO_DATE,
      revision: 1,
    }),
  ],
};

export function getDemoBeneficiaries(customerId: string): SeedBeneficiary[] {
  return demoBeneficiaries[customerId] ?? demoBeneficiaries[DEMO_CUSTOMER_A];
}

export function getDemoBeneficiary(customerId: string, beneficiaryId: string): SeedBeneficiary | undefined {
  return getDemoBeneficiaries(customerId).find((item) => item.id === beneficiaryId);
}
