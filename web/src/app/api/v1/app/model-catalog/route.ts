import { NextResponse } from "next/server";

const CODEX_GPT_CAPABILITIES = {
  reasoningEffortLevels: [
    { value: "xhigh", label: "Extra High" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium", isDefault: true },
    { value: "low", label: "Low" },
  ],
  supportsFastMode: true,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

export async function GET() {
  return NextResponse.json(
    {
      version: 1,
      providers: {
        codex: {
          models: [
            {
              slug: "gpt-5.5",
              name: "GPT-5.5",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.4",
              name: "GPT-5.4",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.4-mini",
              name: "GPT-5.4 Mini",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.3-codex",
              name: "GPT-5.3 Codex",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.3-codex-spark",
              name: "GPT-5.3 Codex Spark",
              availableFor: ["chatgpt"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.2-codex",
              name: "GPT-5.2 Codex",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
            {
              slug: "gpt-5.2",
              name: "GPT-5.2",
              availableFor: ["apiKey", "chatgpt", "unknown"],
              capabilities: CODEX_GPT_CAPABILITIES,
            },
          ],
        },
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
