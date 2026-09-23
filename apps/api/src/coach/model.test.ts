import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiCoachModel } from "./model.js";

describe("GeminiCoachModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Gemini's responseSchema subset and applies the safe planner default", async () => {
    let requestBody: Record<string, any> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        intent: "education",
                        filters: {},
                        grouping: "none",
                        sort: "date_desc",
                        limit: 0,
                        inherit: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const result = await new GeminiCoachModel("test-key", "gemini-3.6-flash").plan(
      "What is a simple monthly budget?",
      undefined,
      [],
    );

    expect(result).toMatchObject({ intent: "education", limit: 20 });
    expect(requestBody?.generationConfig.responseSchema).toBeDefined();
    expect(requestBody?.generationConfig.responseJsonSchema).toBeUndefined();
    expect(JSON.stringify(requestBody?.generationConfig.responseSchema)).not.toContain(
      "additionalProperties",
    );
    expect(JSON.stringify(requestBody?.generationConfig.responseSchema)).not.toContain(
      "$schema",
    );
  });
});
