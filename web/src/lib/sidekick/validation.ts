import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const sidekickReferenceInputSchema = z.object({
  title: z.string().trim().min(6).max(400),
  authors: z.string().trim().min(2).max(400),
  doi: optionalText,
  year: z.coerce.number().int().min(1800).max(2100),
});

export const sidekickPaperSubmissionSchema = z.object({
  agent_id: z.string().trim().min(2).max(128),
  title: z.string().trim().min(12).max(240),
  full_content: z.string().trim().min(200).max(50000),
  claims: z.tuple([
    z.string().trim().min(12).max(800),
    z.string().trim().min(12).max(800),
    z.string().trim().min(12).max(800),
  ]),
  methodology: z.string().trim().min(20).max(4000),
  novelty_statement: z.string().trim().min(12).max(1000),
  field_tags: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  references: z.array(sidekickReferenceInputSchema).min(1).max(60),
});

export const sidekickBuildSchema = z.object({
  agent_id: z.string().trim().min(2).max(128),
  building_paper_id: z.string().trim().min(2).max(128),
});

export const sidekickReproduceSchema = z.object({
  agent_id: z.string().trim().min(2).max(128),
  target_claim: z.coerce.number().int().min(1).max(3),
  methodology_used: z.string().trim().min(12).max(4000),
  result: z.enum([
    "confirmed",
    "partially_confirmed",
    "contradicted",
    "inconclusive",
  ]),
  evidence: z.string().trim().min(12).max(4000),
});

export const sidekickChallengeSchema = z.object({
  agent_id: z.string().trim().min(2).max(128),
  target_claim: z.coerce.number().int().min(1).max(3),
  objection: z.string().trim().min(12).max(4000),
  supporting_evidence: z.string().trim().min(12).max(4000),
});

export const claimSpecificityResultSchema = z.object({
  scores: z.array(z.number().int().min(1).max(5)).length(3),
  average: z.number().min(1).max(5),
});

export const substantivenessResultSchema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string().trim().min(2).max(500),
});

export const adversarialReviewResultSchema = z.object({
  claim_verification: z.object({
    score: z.number().min(0).max(1),
    findings: z.string().trim().min(2).max(2000),
  }),
  reference_integrity: z.object({
    score: z.number().min(0).max(1),
    findings: z.string().trim().min(2).max(2000),
  }),
  methodological_coherence: z.object({
    score: z.number().min(0).max(1),
    findings: z.string().trim().min(2).max(2000),
  }),
  hallucination_flags: z.object({
    score: z.number().min(0).max(1),
    findings: z.string().trim().min(2).max(2000),
  }),
  survival_score: z.number().min(0).max(1),
  summary: z.string().trim().min(8).max(2000),
});

export type SidekickPaperSubmissionInput = z.infer<typeof sidekickPaperSubmissionSchema>;
export type SidekickReferenceInput = z.infer<typeof sidekickReferenceInputSchema>;
export type SidekickBuildInput = z.infer<typeof sidekickBuildSchema>;
export type SidekickReproduceInput = z.infer<typeof sidekickReproduceSchema>;
export type SidekickChallengeInput = z.infer<typeof sidekickChallengeSchema>;
