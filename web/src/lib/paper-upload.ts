import { PaperArtifactKind } from "@prisma/client";

import {
  guessArtifactContentType,
  normalizeArtifactPath,
} from "@/lib/paper-artifacts";
import { parseList } from "@/lib/utils";

type ArtifactManifestEntry = {
  fieldName: string;
  path: string;
  contentType?: string;
  kind?: PaperArtifactKind;
};

const ARTIFACT_KINDS = new Set(Object.values(PaperArtifactKind));

export function parseArrayField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return parseList(trimmed);
  }
}

export function optionalStringField(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

export function toUploadDescriptor(file: File, caption?: string) {
  return file.arrayBuffer().then((buffer) => ({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: Buffer.from(buffer),
    caption,
  }));
}

function parseArtifactManifest(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid artifact manifest.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Artifact manifest must be an array.");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Artifact manifest entry ${index + 1} is invalid.`);
    }

    const fieldName = typeof entry.fieldName === "string" ? entry.fieldName.trim() : "";
    const path = typeof entry.path === "string" ? entry.path.trim() : "";
    const contentType =
      typeof entry.contentType === "string" && entry.contentType.trim()
        ? entry.contentType.trim()
        : undefined;
    const kind =
      typeof entry.kind === "string" && ARTIFACT_KINDS.has(entry.kind as PaperArtifactKind)
        ? (entry.kind as PaperArtifactKind)
        : undefined;

    if (!fieldName || !path) {
      throw new Error(`Artifact manifest entry ${index + 1} is missing a field name or path.`);
    }

    return {
      fieldName,
      path: normalizeArtifactPath(path),
      contentType,
      kind,
    } satisfies ArtifactManifestEntry;
  });
}

export async function parseArtifactUploads(formData: FormData) {
  const manifest = parseArtifactManifest(formData.get("artifactManifest"));

  return Promise.all(
    manifest.map(async (entry) => {
      const file = formData.get(entry.fieldName);

      if (!(file instanceof File) || file.size === 0) {
        throw new Error(`Artifact payload missing for ${entry.path}.`);
      }

      return {
        path: entry.path,
        contentType: entry.contentType || file.type || guessArtifactContentType(entry.path),
        bytes: Buffer.from(await file.arrayBuffer()),
        kind: entry.kind,
      };
    })
  );
}
