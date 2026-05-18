import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import {
  assertBlobStoreHasRoomFor,
  getPaperUploadRole,
  getPaperUploadRoleLimitBytes,
} from "@/lib/paper-storage-policy";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/x-bibtex",
  "application/x-latex",
  "application/x-ipynb+json",
  "application/json",
  "application/octet-stream",
  "application/toml",
  "application/typescript",
  "application/x-sh",
  "application/yaml",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/tsx",
  "text/x-rsrc",
];

function parseClientPayloadSizeBytes(clientPayload: string | null) {
  if (!clientPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(clientPayload) as { sizeBytes?: unknown };
    return typeof payload.sizeBytes === "number" &&
      Number.isSafeInteger(payload.sizeBytes) &&
      payload.sizeBytes > 0
      ? payload.sizeBytes
      : null;
  } catch {
    return null;
  }
}

function isSafeUploadPath(pathname: string, userId: string) {
  return (
    pathname.startsWith(`papers/staged/${userId}/`) &&
    !pathname.includes("..") &&
    !pathname.includes("//")
  );
}

function parseCleanupPathnames(value: unknown, userId: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  const pathnames = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (pathnames.length > 256) {
    throw new Error("Too many blobs requested for cleanup.");
  }

  for (const pathname of pathnames) {
    if (!isSafeUploadPath(pathname, userId)) {
      throw new Error("Invalid upload path.");
    }
  }

  return [...new Set(pathnames)];
}

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getApiUser(request);
        if (!user) {
          throw new Error("Unauthorized.");
        }

        if (!isSafeUploadPath(pathname, user.id)) {
          throw new Error("Invalid upload path.");
        }

        const role = getPaperUploadRole(pathname);
        if (!role) {
          throw new Error("Invalid paper upload role.");
        }

        const maximumSizeInBytes = getPaperUploadRoleLimitBytes(role);
        const declaredSizeBytes = parseClientPayloadSizeBytes(clientPayload);
        await assertBlobStoreHasRoomFor(
          declaredSizeBytes && declaredSizeBytes <= maximumSizeInBytes
            ? declaredSizeBytes
            : maximumSizeInBytes
        );

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: user.id,
            clientPayload,
          }),
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized.") {
      return unauthorizedJson();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return unauthorizedJson();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pathnames = parseCleanupPathnames(
      (body as { pathnames?: unknown }).pathnames,
      user.id
    );

    if (pathnames.length > 0) {
      await del(pathnames);
    }

    return NextResponse.json({ ok: true, deleted: pathnames.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Blob cleanup failed." },
      { status: 400 }
    );
  }
}
