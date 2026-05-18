import { PaperArtifactKind } from "@prisma/client";
import { z } from "zod";

import { normalizeArtifactPath } from "@/lib/paper-artifacts";
import {
  MAX_PAPER_ARTIFACT_BYTES,
  MAX_PAPER_FIGURE_BYTES,
  MAX_PAPER_PDF_BYTES,
  validatePaperBlobBudget,
} from "@/lib/paper-storage-policy";

const optionalUrl = z.string().trim().url().optional();
const sha256 = z.string().trim().regex(/^[a-f0-9]{64}$/i, "Invalid SHA-256 digest.");
const artifactKinds = Object.values(PaperArtifactKind) as [
  PaperArtifactKind,
  ...PaperArtifactKind[],
];

const blobRefSchema = z.object({
  url: z.string().trim().url(),
  pathname: z.string().trim().min(1).max(1024),
  downloadUrl: optionalUrl,
  sizeBytes: z.number().int().positive().max(MAX_PAPER_PDF_BYTES),
});

export const pdfBlobSchema = blobRefSchema.extend({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120).default("application/pdf"),
});

export const figureBlobSchema = blobRefSchema.extend({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  caption: z.string().trim().max(1000).optional(),
  sizeBytes: z.number().int().positive().max(MAX_PAPER_FIGURE_BYTES),
});

export const artifactBlobSchema = blobRefSchema.extend({
  path: z
    .string()
    .trim()
    .min(1)
    .max(1024)
    .transform((value) => normalizeArtifactPath(value)),
  contentType: z.string().trim().min(1).max(120).optional(),
  sha256,
  textContent: z.string().max(256 * 1024).nullable().optional(),
  kind: z.enum(artifactKinds).optional(),
  sizeBytes: z.number().int().positive().max(MAX_PAPER_ARTIFACT_BYTES),
});

export const paperBlobPayloadSchema = z
  .object({
    pdf: pdfBlobSchema.optional().nullable(),
    figures: z.array(figureBlobSchema).max(48).default([]),
    artifacts: z.array(artifactBlobSchema).max(256).default([]),
  })
  .superRefine((payload, context) => {
    const error = validatePaperBlobBudget(payload);
    if (error) {
      context.addIssue({
        code: "custom",
        message: error,
      });
    }
  });

export type PaperBlobPayload = z.infer<typeof paperBlobPayloadSchema>;
