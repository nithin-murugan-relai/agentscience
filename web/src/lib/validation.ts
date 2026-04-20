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

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: handleSchema,
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  institution: optionalText,
  bio: z.string().trim().max(220).optional().or(z.literal("").transform(() => undefined)),
});

export const signInSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

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

export const researchPlanSchema = z.object({
  title: z.string().trim().min(8).max(240),
  hypothesis: z.string().trim().min(20).max(2000),
  methodology: z.array(z.string().trim().min(6).max(400)).min(2).max(8),
  experiments: z.array(z.string().trim().min(6).max(400)).min(1).max(8),
  deliverables: z.array(z.string().trim().min(6).max(240)).min(1).max(8),
  keywords: z.array(z.string().trim().min(2).max(40)).max(16).default([]),
});

export const integrationKeySchema = z.object({
  name: z.string().trim().min(2).max(48),
});

export const apiTokenSignInSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  name: z.string().trim().min(2).max(48).default("CLI token"),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  handle: handleSchema.optional(),
  bio: z.string().trim().max(220).optional().or(z.literal("").transform(() => "")),
  institution: z.string().trim().max(120).optional().or(z.literal("").transform(() => "")),
  researchInterests: z.array(z.string().trim().min(2).max(60)).max(20).default([]),
  digestEnabled: z.boolean().optional(),
  digestEmailEnabled: z.boolean().optional(),
});

export const sidekickAuthorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: optionalText,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  institution: optionalText,
  isCorresponding: z.boolean().optional(),
});

export const sidekickPublishSchema = z.object({
  externalId: z.string().trim().min(3).max(120),
  title: z.string().trim().min(12).max(180),
  abstract: z.string().trim().min(80).max(4000),
  markdown: z.string().trim().min(300),
  latexSource: optionalText,
  bibSource: optionalText,
  pdfUrl: optionalUrl,
  canonicalUrl: optionalUrl,
  githubUrl: optionalUrl,
  doi: optionalText,
  keywords: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
  sourceNoteIds: z.array(z.string().trim().min(1).max(120)).max(32).default([]),
  noteHighlights: z.array(z.string().trim().min(8).max(400)).max(16).default([]),
  theme: optionalText,
  authors: z.array(sidekickAuthorSchema).min(1).max(8),
  references: z
    .array(
      z.object({
        title: optionalText,
        doi: optionalText,
        targetSlug: optionalText,
      })
    )
    .max(40)
    .default([]),
});

export const paperAiAssessmentSchema = z.object({
  summary: z.string().trim().min(500).max(2000),
  overall: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  rigor: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  reproducibility: z.number().min(0).max(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PaperFormInput = z.infer<typeof paperFormSchema>;
export type ReviewFormInput = z.infer<typeof reviewFormSchema>;
export type IdeaFormInput = z.infer<typeof ideaFormSchema>;
export type ResearchPlanInput = z.infer<typeof researchPlanSchema>;
export type IntegrationKeyInput = z.infer<typeof integrationKeySchema>;
export type ApiTokenSignInInput = z.infer<typeof apiTokenSignInSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SidekickPublishInput = z.infer<typeof sidekickPublishSchema>;
export type PaperAiAssessment = z.infer<typeof paperAiAssessmentSchema>;
