import { ApiError } from "../lib/errors.js";
import { id } from "../lib/ids.js";
import * as beneficiariesRepository from "../db/repositories/beneficiaries.repository.js";

type BeneficiaryRow = NonNullable<Awaited<ReturnType<typeof beneficiariesRepository.getBeneficiary>>>;

function beneficiaryDto(beneficiary: BeneficiaryRow) {
  return {
    id: beneficiary.id,
    type: beneficiary.type,
    name: beneficiary.name,
    nickname: beneficiary.nickname,
    maskedAccountNumber: beneficiary.maskedAccountNumber,
    ifsc: beneficiary.ifsc,
    upiId: beneficiary.upiId,
    status: beneficiary.status,
    coolingOffUntil: beneficiary.coolingOffUntil?.toISOString() ?? null,
    createdAt: beneficiary.createdAt.toISOString(),
    updatedAt: beneficiary.updatedAt.toISOString(),
  };
}

export type CreateBeneficiaryInput = {
  type: "bank" | "upi";
  name: string;
  nickname?: string;
  accountNumber?: string;
  maskedAccountNumber?: string;
  ifsc?: string;
  upiId?: string;
};

export async function listBeneficiaries(userId: string) {
  return (await beneficiariesRepository.listBeneficiaries(userId)).map(beneficiaryDto);
}

export async function getBeneficiary(userId: string, beneficiaryId: string) {
  const beneficiary = await beneficiariesRepository.getBeneficiary(userId, beneficiaryId);
  if (!beneficiary) throw new ApiError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
  return beneficiaryDto(beneficiary);
}

export async function createBeneficiary(userId: string, input: CreateBeneficiaryInput) {
  const name = input.name.trim();
  if (!name) throw new ApiError("INVALID_BENEFICIARY", "Recipient name is required.", 422);
  if (input.type === "upi") {
    if (!input.upiId || !/^[\w.-]+@[\w.-]+$/.test(input.upiId.trim())) {
      throw new ApiError("INVALID_UPI_ID", "Enter a valid UPI ID.", 422);
    }
  } else if (!input.accountNumber && !input.maskedAccountNumber) {
    throw new ApiError("INVALID_ACCOUNT_NUMBER", "A bank account number is required.", 422);
  }

  const accountNumber = input.accountNumber?.trim();
  const maskedAccountNumber = input.maskedAccountNumber?.trim() ?? (accountNumber ? `•••• ${accountNumber.slice(-4)}` : null);
  const coolingOffUntil = input.type === "bank" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
  const beneficiary = await beneficiariesRepository.insertBeneficiary({
    id: id("ben"),
    userId,
    type: input.type,
    name,
    nickname: input.nickname?.trim() || null,
    maskedAccountNumber,
    ifsc: input.ifsc?.trim().toUpperCase() || null,
    upiId: input.upiId?.trim() || null,
    status: coolingOffUntil ? "cooling_off" : "active",
    coolingOffUntil,
  });
  return beneficiaryDto(beneficiary);
}

export function assertBeneficiaryUsable(beneficiary: BeneficiaryRow) {
  if (beneficiary.status === "disabled") throw new ApiError("BENEFICIARY_DISABLED", "This beneficiary is disabled.", 409);
  if (beneficiary.coolingOffUntil && beneficiary.coolingOffUntil > new Date()) {
    throw new ApiError("BENEFICIARY_COOLING_OFF", "This beneficiary is still in the cooling-off period.", 409);
  }
}
