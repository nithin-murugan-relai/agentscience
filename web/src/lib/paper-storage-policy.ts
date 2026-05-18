import { del, list } from "@vercel/blob";

import type { PaperBlobPayload } from "@/lib/paper-blob-payload";
import { prisma } from "@/lib/prisma";

export const PAPER_BLOB_PREFIX = "papers/staged/";
export const MAX_PAPER_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PAPER_ARTIFACT_BYTES = 5 * 1024 * 1024;
export const MAX_PAPER_TOTAL_ARTIFACT_BYTES = 25 * 1024 * 1024;
export const MAX_PAPER_FIGURE_BYTES = 15 * 1024 * 1024;
export const MAX_PAPER_TOTAL_FIGURE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_BLOB_STORE_SOFT_LIMIT_BYTES = 900 * 1024 * 1024;
export const DEFAULT_STAGED_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export type PaperUploadRole = "pdf" | "artifacts" | "figures";

export type PaperBlobBudget = {
  pdfBytes: number;
  artifactBytes: number;
  figureBytes: number;
};

export type BlobStorageUsage = {
  count: number;
  totalBytes: number;
};

type ManagedBlob = {
  pathname: string;
  size?: number;
  uploadedAt?: Date | string;
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBlobStoreSoftLimitBytes() {
  return parsePositiveInteger(
    process.env.AGENTSCIENCE_BLOB_STORE_SOFT_LIMIT_BYTES,
    DEFAULT_BLOB_STORE_SOFT_LIMIT_BYTES
  );
}

export function getStagedOrphanGraceMs() {
  return parsePositiveInteger(
    process.env.AGENTSCIENCE_STAGED_ORPHAN_GRACE_MS,
    DEFAULT_STAGED_ORPHAN_GRACE_MS
  );
}

export function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }

  return `${bytes} B`;
}

export function getPaperUploadRole(pathname: string): PaperUploadRole | null {
  const normalized = pathname.replaceAll("\\", "/");
  if (normalized.includes("/pdf/")) return "pdf";
  if (normalized.includes("/artifacts/")) return "artifacts";
  if (normalized.includes("/figures/")) return "figures";
  return null;
}

export function getPaperUploadRoleLimitBytes(role: PaperUploadRole) {
  switch (role) {
    case "pdf":
      return MAX_PAPER_PDF_BYTES;
    case "artifacts":
      return MAX_PAPER_ARTIFACT_BYTES;
    case "figures":
      return MAX_PAPER_FIGURE_BYTES;
  }
}

export function getPaperBlobBudget(payload: PaperBlobPayload): PaperBlobBudget {
  return {
    pdfBytes: payload.pdf?.sizeBytes ?? 0,
    artifactBytes: payload.artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0),
    figureBytes: payload.figures.reduce((sum, figure) => sum + figure.sizeBytes, 0),
  };
}

export function validatePaperBlobBudget(payload: PaperBlobPayload): string | null {
  if (payload.pdf && payload.pdf.sizeBytes > MAX_PAPER_PDF_BYTES) {
    return `PDF uploads are limited to ${formatStorageBytes(MAX_PAPER_PDF_BYTES)}.`;
  }

  const oversizedFigure = payload.figures.find(
    (figure) => figure.sizeBytes > MAX_PAPER_FIGURE_BYTES
  );
  if (oversizedFigure) {
    return `Figure uploads are limited to ${formatStorageBytes(MAX_PAPER_FIGURE_BYTES)} each.`;
  }

  const oversizedArtifact = payload.artifacts.find(
    (artifact) => artifact.sizeBytes > MAX_PAPER_ARTIFACT_BYTES
  );
  if (oversizedArtifact) {
    return `Supplemental artifacts are limited to ${formatStorageBytes(MAX_PAPER_ARTIFACT_BYTES)} each. Large raw datasets should be linked or registered separately instead of uploaded with the paper.`;
  }

  const budget = getPaperBlobBudget(payload);
  if (budget.artifactBytes > MAX_PAPER_TOTAL_ARTIFACT_BYTES) {
    return `Supplemental artifacts are limited to ${formatStorageBytes(MAX_PAPER_TOTAL_ARTIFACT_BYTES)} total. Large raw datasets should be linked or registered separately instead of uploaded with the paper.`;
  }

  if (budget.figureBytes > MAX_PAPER_TOTAL_FIGURE_BYTES) {
    return `Figures are limited to ${formatStorageBytes(MAX_PAPER_TOTAL_FIGURE_BYTES)} total.`;
  }

  return null;
}

function isManagedPaperBlobPathname(pathname: string, userId?: string) {
  const managedPrefix = userId ? `${PAPER_BLOB_PREFIX}${userId}/` : PAPER_BLOB_PREFIX;
  return pathname.startsWith(managedPrefix);
}

export function collectManagedPaperBlobPathnamesFromPayload(
  payload: Partial<PaperBlobPayload>,
  userId?: string
) {
  return [
    payload.pdf?.pathname,
    ...(payload.artifacts ?? []).map((artifact) => artifact.pathname),
    ...(payload.figures ?? []).map((figure) => figure.pathname),
  ].filter(
    (pathname): pathname is string =>
      typeof pathname === "string" && isManagedPaperBlobPathname(pathname, userId)
  );
}

export function collectManagedPaperBlobPathnamesFromUnknown(value: unknown, userId?: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const pathnames: string[] = [];
  const pushPathname = (entry: unknown) => {
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as { pathname?: unknown }).pathname === "string"
    ) {
      const pathname = (entry as { pathname: string }).pathname.trim();
      if (isManagedPaperBlobPathname(pathname, userId)) {
        pathnames.push(pathname);
      }
    }
  };

  pushPathname(record.pdf);
  if (Array.isArray(record.artifacts)) {
    for (const artifact of record.artifacts) {
      pushPathname(artifact);
    }
  }
  if (Array.isArray(record.figures)) {
    for (const figure of record.figures) {
      pushPathname(figure);
    }
  }

  return [...new Set(pathnames)];
}

export async function deleteManagedPaperBlobPathnames(pathnames: readonly string[]) {
  const managed = [...new Set(pathnames.filter((pathname) => pathname.startsWith(PAPER_BLOB_PREFIX)))];
  if (managed.length === 0) {
    return 0;
  }

  await del(managed);
  return managed.length;
}

export async function listManagedPaperBlobs(token = process.env.BLOB_READ_WRITE_TOKEN) {
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required.");
  }

  const blobs: ManagedBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      cursor,
      limit: 1000,
      prefix: PAPER_BLOB_PREFIX,
      token,
    });
    blobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);

  return blobs;
}

export async function getBlobStorageUsage(token = process.env.BLOB_READ_WRITE_TOKEN): Promise<BlobStorageUsage> {
  const blobs = await listManagedPaperBlobs(token);
  return {
    count: blobs.length,
    totalBytes: blobs.reduce((sum, blob) => sum + (blob.size ?? 0), 0),
  };
}

export async function assertBlobStoreHasRoomFor(bytes: number) {
  const usage = await getBlobStorageUsage();
  const softLimit = getBlobStoreSoftLimitBytes();
  if (usage.totalBytes + bytes <= softLimit) {
    return;
  }

  throw new Error(
    `AgentScience storage is temporarily full (${formatStorageBytes(usage.totalBytes)} used of ${formatStorageBytes(softLimit)} reserved). Try again after older staged uploads are cleaned up, or link/register large datasets separately.`
  );
}

export async function getReferencedManagedPaperBlobPathnames() {
  const papers = await prisma.paper.findMany({
    select: {
      pdfStoragePath: true,
      artifacts: {
        select: {
          blobPath: true,
        },
      },
      assets: {
        select: {
          blobPath: true,
        },
      },
    },
  });
  const referenced = new Set<string>();

  for (const paper of papers) {
    if (paper.pdfStoragePath?.startsWith(PAPER_BLOB_PREFIX)) {
      referenced.add(paper.pdfStoragePath);
    }
    for (const artifact of paper.artifacts) {
      if (artifact.blobPath.startsWith(PAPER_BLOB_PREFIX)) {
        referenced.add(artifact.blobPath);
      }
    }
    for (const asset of paper.assets) {
      if (asset.blobPath.startsWith(PAPER_BLOB_PREFIX)) {
        referenced.add(asset.blobPath);
      }
    }
  }

  return referenced;
}

function isOlderThanGrace(blob: ManagedBlob, now: Date, graceMs: number) {
  if (!blob.uploadedAt) {
    return false;
  }

  const uploadedAt = blob.uploadedAt instanceof Date ? blob.uploadedAt : new Date(blob.uploadedAt);
  return Number.isFinite(uploadedAt.getTime()) && now.getTime() - uploadedAt.getTime() > graceMs;
}

export async function runBlobStorageMaintenance(options: {
  deleteOrphans?: boolean;
  now?: Date;
  graceMs?: number;
} = {}) {
  const [blobs, referenced] = await Promise.all([
    listManagedPaperBlobs(),
    getReferencedManagedPaperBlobPathnames(),
  ]);
  const now = options.now ?? new Date();
  const graceMs = options.graceMs ?? getStagedOrphanGraceMs();
  const orphanBlobs = blobs.filter(
    (blob) => !referenced.has(blob.pathname) && isOlderThanGrace(blob, now, graceMs)
  );
  const orphanPathnames = orphanBlobs.map((blob) => blob.pathname);
  const orphanBytes = orphanBlobs.reduce((sum, blob) => sum + (blob.size ?? 0), 0);

  let deleted = 0;
  if (options.deleteOrphans && orphanPathnames.length > 0) {
    deleted = await deleteManagedPaperBlobPathnames(orphanPathnames);
  }

  return {
    scanned: blobs.length,
    referenced: referenced.size,
    orphanCount: orphanBlobs.length,
    orphanBytes,
    deleted,
    totalBytes: blobs.reduce((sum, blob) => sum + (blob.size ?? 0), 0),
    softLimitBytes: getBlobStoreSoftLimitBytes(),
  };
}
