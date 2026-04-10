import OpenAI from "openai";

import { excerpt } from "@/lib/utils";
import {
  paperAiAssessmentSchema,
  type PaperAiAssessment,
} from "@/lib/validation";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export function aiJudgeConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function judgePaperWithOpenAI(input: {
  title: string;
  abstract: string;
  markdown: string;
  keywords: string[];
  references: string[];
}): Promise<PaperAiAssessment | null> {
  const client = getOpenAIClient();

  if (!client) {
    return null;
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_JUDGE_MODEL || "gpt-5.2",
      instructions:
        "You are a skeptical but constructive scientific reviewer. Score papers for quality rather than hype. Favor rigor, clarity, and reproducibility. Return only valid JSON that matches the schema.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Title: ${input.title}`,
                `Keywords: ${input.keywords.join(", ") || "none"}`,
                `Abstract: ${excerpt(input.abstract, 1600)}`,
                `References: ${input.references.slice(0, 16).join(" | ") || "none"}`,
                `Paper body excerpt: ${excerpt(input.markdown, 5000)}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "paper_assessment",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "summary",
              "overall",
              "novelty",
              "rigor",
              "clarity",
              "reproducibility",
            ],
            properties: {
              summary: {
                type: "string",
                minLength: 20,
                maxLength: 400,
              },
              overall: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              novelty: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              rigor: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              clarity: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reproducibility: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
          },
        },
      },
    });

    return paperAiAssessmentSchema.parse(JSON.parse(response.output_text));
  } catch (error) {
    console.error("AgentScience AI judge failed", error);
    return null;
  }
}
