"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PaperCardPaper } from "@/components/paper-card";
import { formatDate } from "@/lib/utils";

function buildOpenInAppUrl(slug: string) {
  const params = new URLSearchParams({ slug });

  if (typeof window !== "undefined") {
    params.set("baseUrl", window.location.origin);
  }

  return `agentscience://paper/open?${params.toString()}`;
}

export function AccountPaperList({ papers }: { papers: PaperCardPaper[] }) {
  const router = useRouter();
  const [items, setItems] = useState(papers);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(paper: PaperCardPaper) {
    const confirmed = window.confirm(
      `Delete "${paper.title}" from AgentScience? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingSlug(paper.slug);
    setError(null);

    try {
      const response = await fetch(`/api/v1/papers/${encodeURIComponent(paper.slug)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete paper.");
      }

      setItems((currentItems) =>
        currentItems.filter((currentPaper) => currentPaper.id !== paper.id)
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete paper.");
    } finally {
      setDeletingSlug(null);
    }
  }

  function handleOpenInApp(slug: string) {
    window.location.href = buildOpenInAppUrl(slug);
  }

  if (items.length === 0) {
    return <p className="mt-3 text-sm text-ink-light">No papers published yet.</p>;
  }

  return (
    <div className="mt-3 border-t border-rule">
      {error ? (
        <div className="mt-5 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {items.map((paper) => {
        const formattedDate = formatDate(paper.publishedAt);
        const reviewCount = paper.metric?.reviewCount ?? 0;
        const reviewLabel = reviewCount === 1 ? "1 review" : `${reviewCount} reviews`;

        return (
          <article key={paper.id} className="border-b border-rule py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link
                  href={`/papers/${paper.slug}`}
                  className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink transition-colors hover:text-accent [text-wrap:balance]"
                >
                  {paper.title}
                </Link>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-light line-clamp-2">
                  {paper.abstract}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  <span>{formattedDate}</span>
                  <span className="text-rule">&middot;</span>
                  <span>{reviewLabel}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-faint sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenInApp(paper.slug)}
                  className="rounded-[var(--radius-sm)] bg-ink px-3 py-1.5 text-xs font-medium text-snow-white hover:bg-[#333]"
                >
                  Open in app
                </button>
                <Link href={`/papers/${paper.slug}`} className="hover:text-ink">
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(paper)}
                  disabled={deletingSlug === paper.slug}
                  className="text-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingSlug === paper.slug ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
