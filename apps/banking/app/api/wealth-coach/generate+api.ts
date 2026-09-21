type ClerkJwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type ClerkJwtPayload = {
  iss?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  azp?: string;
};

type JsonWebKeyWithKid = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type JwksResponse = {
  keys?: JsonWebKeyWithKid[];
};

type GeminiInteraction = {
  model?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const MAX_QUESTION_LENGTH = 1_200;
const MAX_EXPLANATION_LENGTH = 12_000;
const JWKS_TTL_MS = 5 * 60 * 1_000;

let cachedJwks:
  | {
      issuer: string;
      expiresAt: number;
      keys: JsonWebKeyWithKid[];
    }
  | undefined;

function json(
  body: Record<string, unknown>,
  init?: ResponseInit,
): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function decodeJwtJson<T>(segment: string): T {
  const bytes = base64UrlToBytes(segment);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function getJwks(issuer: string): Promise<JsonWebKeyWithKid[]> {
  if (
    cachedJwks &&
    cachedJwks.issuer === issuer &&
    cachedJwks.expiresAt > Date.now()
  ) {
    return cachedJwks.keys;
  }

  const response = await fetch(
    `${issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new Error("Unable to load the authentication verification keys.");
  }

  const payload = (await response.json()) as JwksResponse;
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (!keys.length) {
    throw new Error("No authentication verification keys are available.");
  }

  cachedJwks = {
    issuer,
    expiresAt: Date.now() + JWKS_TTL_MS,
    keys,
  };
  return keys;
}

async function verifyClerkBearerToken(
  request: Request,
): Promise<ClerkJwtPayload> {
  const expectedIssuer = process.env.CLERK_JWT_ISSUER?.trim().replace(/\/+$/, "");
  if (!expectedIssuer) {
    throw new Error("Server authentication is not configured.");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error("Authentication is required.");
  }

  const token = match[1];
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("The authentication token is malformed.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeJwtJson<ClerkJwtHeader>(encodedHeader);
  const payload = decodeJwtJson<ClerkJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("The authentication token uses an unsupported signing method.");
  }
  if (payload.iss?.replace(/\/+$/, "") !== expectedIssuer) {
    throw new Error("The authentication token issuer is invalid.");
  }
  if (!payload.sub) {
    throw new Error("The authentication token does not identify a user.");
  }

  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (!payload.exp || payload.exp <= nowSeconds) {
    throw new Error("Your secure session has expired.");
  }
  if (payload.nbf && payload.nbf > nowSeconds + 30) {
    throw new Error("The authentication token is not active yet.");
  }

  const keys = await getJwks(expectedIssuer);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    cachedJwks = undefined;
    const refreshedKeys = await getJwks(expectedIssuer);
    const refreshed = refreshedKeys.find((candidate) => candidate.kid === header.kid);
    if (!refreshed) {
      throw new Error("The authentication signing key is unavailable.");
    }
    return verifyJwtSignature(
      encodedHeader,
      encodedPayload,
      encodedSignature,
      refreshed,
      payload,
    );
  }

  return verifyJwtSignature(
    encodedHeader,
    encodedPayload,
    encodedSignature,
    jwk,
    payload,
  );
}

async function verifyJwtSignature(
  encodedHeader: string,
  encodedPayload: string,
  encodedSignature: string,
  jwk: JsonWebKeyWithKid,
  payload: ClerkJwtPayload,
): Promise<ClerkJwtPayload> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!verified) {
    throw new Error("The authentication token signature is invalid.");
  }
  return payload;
}

function readInput(value: unknown): {
  question: string;
  explanation: string;
} {
  if (!value || typeof value !== "object") {
    throw new Error("The request body is invalid.");
  }

  const record = value as Record<string, unknown>;
  const question =
    typeof record.question === "string" ? record.question.trim() : "";
  const explanation =
    typeof record.explanation === "string" ? record.explanation.trim() : "";

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    throw new Error("The Wealth Coach question is invalid.");
  }
  if (!explanation || explanation.length > MAX_EXPLANATION_LENGTH) {
    throw new Error("The grounded Wealth Coach explanation is invalid.");
  }

  return { question, explanation };
}

function extractGeminiText(interaction: GeminiInteraction): string {
  return (
    interaction.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim() ?? ""
  );
}

async function callGemini(input: {
  question: string;
  explanation: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Gemini is not configured on the server.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const prompt = [
    "You are the IDBI Wealth Coach response writer.",
    "Your job is to turn an already-verified banking analysis into clear, concise customer-facing language.",
    "Treat the VERIFIED ANALYSIS below as authoritative.",
    "Do not invent, infer, change, recompute, or add any amount, date, percentage, merchant, account, recommendation, eligibility decision, or factual claim that is not explicitly present in the verified analysis.",
    "If the verified analysis says data is unavailable, incomplete, demo-only, or uncertain, preserve that limitation clearly.",
    "Do not claim that money was moved, an investment was executed, or a financial product was approved.",
    "Keep the answer useful and conversational. Prefer 1-3 short paragraphs. Do not add a table.",
    "",
    `USER QUESTION:\n${input.question}`,
    "",
    `VERIFIED ANALYSIS:\n${input.explanation}`,
  ].join("\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini could not prepare the Wealth Coach response.");
  }

  const interaction = (await response.json()) as GeminiInteraction;
  const text = extractGeminiText(interaction);
  if (!text) {
    throw new Error("Gemini returned an empty Wealth Coach response.");
  }

  return {
    text,
    model: interaction.model?.trim() || model,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    await verifyClerkBearerToken(request);
    const input = readInput(await request.json());
    const result = await callGemini(input);
    return json({
      text: result.text,
      provider: "gemini",
      model: result.model,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The Wealth Coach request could not be completed.";

    const status = /Authentication|required|token|session/i.test(message)
      ? 401
      : /not configured/i.test(message)
        ? 503
        : /invalid|malformed/i.test(message)
          ? 400
          : 502;

    return json({ error: message }, { status });
  }
}
