import { z } from "zod";

import { apiFetch } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { CoachModelStatus } from "@/types/wealth-coach-conversation";

const coachModelResponseSchema = z.object({
  text: z.string().trim().min(1).max(6_000),
  provider: z.literal("gemini"),
  model: z.string().trim().min(1).max(120),
});

type GenerateCoachModelInput = {
  question: string;
  explanation: string;
};

type GenerateCoachModelOptions = {
  authToken?: string | null;
  signal?: AbortSignal;
};

export type CoachModelGeneration = {
  text: string;
  modelStatus: CoachModelStatus;
  provider: "gemini" | "test-adapter";
  model: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
    ) {
      return (payload as { error: string }).error;
    }
  } catch {
    // Fall through to a stable client-facing message.
  }
  return "The Wealth Coach model provider is temporarily unavailable.";
}

export async function generateCoachModelText(
  input: GenerateCoachModelInput,
  options?: GenerateCoachModelOptions,
): Promise<CoachModelGeneration> {
  if (env.EXPO_PUBLIC_USE_MOCK_DATA === "true") {
    return {
      text: input.explanation,
      modelStatus: "test-adapter",
      provider: "test-adapter",
      model: "deterministic-test-adapter",
    };
  }

  const authToken = options?.authToken?.trim();
  if (!authToken) {
    throw new Error("Your secure session could not be verified. Please sign in again.");
  }

  const response = await apiFetch("/api/wealth-coach/generate", {
    method: "POST",
    signal: options?.signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: input.question,
      explanation: input.explanation,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = coachModelResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("The Wealth Coach model returned an invalid response.");
  }

  return {
    ...parsed.data,
    modelStatus: "server-provider",
  };
}
