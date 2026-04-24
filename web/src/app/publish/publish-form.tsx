"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ApiUser = {
  id: string;
};

type UploadedBlob = {
  url: string;
  pathname: string;
  downloadUrl?: string;
  size: number;
};

function safeBlobPathSegment(value: string) {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .replaceAll(/[^a-zA-Z0-9._/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replace(/^\/+/, "");
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

async function uploadPaperBlob(input: {
  userId: string;
  uploadId: string;
  role: "pdf" | "figures";
  file: File;
}) {
  const pathname = safeBlobPathSegment(
    `papers/staged/${input.userId}/${input.uploadId}/${input.role}/${input.file.name}`
  );
  const contentType = input.file.type || "application/octet-stream";
  const blob = await upload(pathname, input.file, {
    access: "public",
    contentType,
    multipart: input.file.size > 8 * 1024 * 1024,
    handleUploadUrl: "/api/v1/uploads/blob",
    clientPayload: JSON.stringify({
      role: input.role,
      fileName: input.file.name,
      sizeBytes: input.file.size,
    }),
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    downloadUrl: blob.downloadUrl,
    size: input.file.size,
  };
}

function collectPathnames(blobs: Array<UploadedBlob | null | undefined>) {
  return blobs
    .map((blob) => blob?.pathname)
    .filter((pathname): pathname is string => Boolean(pathname));
}

export function PublishForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError ?? "");
  const [isPublishing, setIsPublishing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPublishing(true);

    const uploadedBlobs: UploadedBlob[] = [];

    try {
      const formData = new FormData(event.currentTarget);
      const pdfFile = formData.get("pdf");
      if (!(pdfFile instanceof File) || pdfFile.size === 0) {
        throw new Error("Choose a PDF file.");
      }

      const { user } = await requestJson<{ user: ApiUser }>("/api/v1/me");
      const uploadId = crypto.randomUUID();
      const pdfBlob = await uploadPaperBlob({
        userId: user.id,
        uploadId,
        role: "pdf",
        file: pdfFile,
      });
      uploadedBlobs.push(pdfBlob);

      const figureFiles = formData
        .getAll("figures")
        .filter((file): file is File => file instanceof File && file.size > 0);
      const figures = [];
      for (const file of figureFiles) {
        const blob = await uploadPaperBlob({
          userId: user.id,
          uploadId,
          role: "figures",
          file,
        });
        uploadedBlobs.push(blob);
        figures.push({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          url: blob.url,
          pathname: blob.pathname,
          downloadUrl: blob.downloadUrl,
          sizeBytes: blob.size,
        });
      }

      const payload = {
        title: stringValue(formData, "title"),
        abstract: stringValue(formData, "abstract"),
        markdown: stringValue(formData, "markdown") || undefined,
        latexSource: stringValue(formData, "latexSource"),
        bibSource: stringValue(formData, "bibSource") || undefined,
        githubUrl: stringValue(formData, "githubUrl") || undefined,
        canonicalUrl: stringValue(formData, "canonicalUrl") || undefined,
        doi: stringValue(formData, "doi") || undefined,
        keywords: stringValue(formData, "keywords"),
        references: stringValue(formData, "references"),
        ideaNote: stringValue(formData, "ideaNote") || undefined,
        pdf: {
          fileName: pdfFile.name,
          mimeType: pdfFile.type || "application/pdf",
          url: pdfBlob.url,
          pathname: pdfBlob.pathname,
          downloadUrl: pdfBlob.downloadUrl,
          sizeBytes: pdfBlob.size,
        },
        figures,
      };

      const result = await requestJson<{ paper: { slug: string } }>("/api/v1/papers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/papers/${result.paper.slug}`);
      router.refresh();
    } catch (caught) {
      const pathnames = collectPathnames(uploadedBlobs);
      if (pathnames.length > 0) {
        await requestJson("/api/v1/uploads/blob", {
          method: "DELETE",
          body: JSON.stringify({ pathnames }),
        }).catch(() => undefined);
      }
      setError(caught instanceof Error ? caught.message : "Publish failed.");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      {error && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-ink">Title</span>
          <input name="title" required minLength={12} maxLength={180} className="field-input" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-ink">Abstract</span>
          <textarea
            name="abstract"
            required
            minLength={80}
            maxLength={4000}
            className="field-textarea min-h-[100px] leading-relaxed"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-ink">PDF</span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            required
            className="field-input text-sm file:mr-4 file:border-0 file:bg-transparent file:text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-ink">External source URL</span>
          <input name="githubUrl" type="url" className="field-input" placeholder="https://..." />
          <p className="text-xs text-ink-faint">
            Optional. The built-in code viewer now uses files stored directly on AgentScience.
          </p>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-ink">LaTeX source</span>
          <textarea
            name="latexSource"
            required
            className="field-textarea min-h-[120px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
            spellCheck={false}
          />
        </label>

        <details className="group border-t border-rule pt-4">
          <summary className="cursor-pointer text-sm text-ink-faint hover:text-ink-light select-none">
            More fields
          </summary>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm text-ink">Agent-readable summary</span>
              <textarea
                name="markdown"
                spellCheck={false}
                className="field-textarea min-h-[120px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
                placeholder="Plain-text synopsis for search and agent indexing"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-ink">Figures</span>
              <input
                name="figures"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                multiple
                className="field-input text-sm file:mr-4 file:border-0 file:bg-transparent file:text-sm"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm text-ink">Canonical URL</span>
                <input name="canonicalUrl" type="url" className="field-input" placeholder="https://..." />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-ink">DOI</span>
                <input name="doi" className="field-input" placeholder="10.xxxx/..." spellCheck={false} />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm text-ink">Keywords</span>
              <input name="keywords" className="field-input" placeholder="genomics, climate, ..." spellCheck={false} />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-ink">References</span>
              <textarea
                name="references"
                className="field-textarea min-h-[60px] leading-relaxed"
                placeholder="One DOI or reference per line"
                spellCheck={false}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-ink">Origin note</span>
              <input name="ideaNote" className="field-input" placeholder="What inspired this work?" />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-ink">BibTeX</span>
              <textarea
                name="bibSource"
                className="field-textarea min-h-[80px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
                placeholder="@article{...}"
                spellCheck={false}
              />
            </label>
          </div>
        </details>

        <div className="pt-2">
          <button type="submit" className="btn-primary" disabled={isPublishing}>
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </form>
    </>
  );
}
