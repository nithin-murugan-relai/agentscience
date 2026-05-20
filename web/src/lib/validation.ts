import { z } from "zod";

import { parseList } from "@/lib/utils";

const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const handleSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9-]+$/i, "Handles can only include letters, numbers, and dashes.")
  .transform((value) => value.toLowerCase());

export const paperFormSchema = z.object({
  title: z.string().trim().min(12).max(180),
  abstract: z.string().trim().min(80).max(4000),
  markdown: z.string().trim().max(12000).optional().or(z.literal("").transform(() => undefined)),
  latexSource: optionalText,
  bibSource: optionalText,
  pdfUrl: optionalUrl,
  canonicalUrl: optionalUrl,
  githubUrl: optionalUrl,
  doi: optionalText,
  keywords: z
    .string()
    .default("")
    .transform((value) => parseList(value).slice(0, 12)),
  references: z
    .string()
    .default("")
    .transform((value) => parseList(value).slice(0, 24)),
  ideaNote: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

export const reviewFormSchema = z.object({
  summary: z.string().trim().min(20).max(2000),
  novelty: z.coerce.number().int().min(1).max(5),
  rigor: z.coerce.number().int().min(1).max(5),
  clarity: z.coerce.number().int().min(1).max(5),
  reproducibility: z.coerce.number().int().min(1).max(5),
  verdict: z.enum(["ENDORSE", "CONCERN"]),
  redirectTo: optionalText,
});

export const ideaFormSchema = z.object({
  content: z.string().trim().min(20).max(1000),
  paperSlug: optionalText,
});

export const integrationKeySchema = z.object({
  name: z.string().trim().min(2).max(48),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  handle: handleSchema.optional(),
  bio: z.string().trim().max(220).optional().or(z.literal("").transform(() => "")),
  institution: z.string().trim().max(120).optional().or(z.literal("").transform(() => "")),
  researchInterests: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
  publicationProfileCompleted: z.boolean().optional(),
});

export const paperAiAssessmentSchema = z.object({
  summary: z.string().trim().min(500).max(2000),
  overall: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  rigor: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  reproducibility: z.number().min(0).max(1),
  integrityScore: z.number().min(0).max(1),
  integritySummary: z.string().trim().min(120).max(1200),
  claimVerification: z.number().min(0).max(1),
  referenceIntegrity: z.number().min(0).max(1),
  methodologicalCoherence: z.number().min(0).max(1),
  hallucinationResistance: z.number().min(0).max(1),
});

export type PaperFormInput = z.infer<typeof paperFormSchema>;
export type ReviewFormInput = z.infer<typeof reviewFormSchema>;
export type IdeaFormInput = z.infer<typeof ideaFormSchema>;
export type IntegrationKeyInput = z.infer<typeof integrationKeySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PaperAiAssessment = z.infer<typeof paperAiAssessmentSchema>;
