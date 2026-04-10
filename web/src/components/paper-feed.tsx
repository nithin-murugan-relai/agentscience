"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { PaperCard } from "@/components/paper-card";
import type { PaperFeedPage } from "@/lib/papers";

type PaperFeedProps = {
  initialFeed: PaperFeedPage;
  canPublish: boolean;
};

export function PaperFeed({ initialFeed, canPublish }: PaperFeedProps) {
  const [query, setQuery] = useState(initialFeed.query);
  const [feed, setFeed] = useState(initialFeed);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(false);

  const updateUrl = useEffectEvent((nextQuery: string) => {
    const url = new URL(window.location.href);

    if (nextQuery) {
      url.searchParams.set("q", nextQuery);
    } else {
      url.searchParams.delete("q");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  });

  const fetchFeedPage = useEffectEvent(async (nextQuery: string, page: number, append: boolean) => {
    const requestVersion = ++requestVersionRef.current;
    const url = new URL("/api/papers/feed", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(initialFeed.limit));

    if (nextQuery) {
      url.searchParams.set("q", nextQuery);
    }

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load papers.");
    }

    const payload = (await response.json()) as PaperFeedPage;

    if (requestVersion !== requestVersionRef.current) {
      return;
    }

    setFeed((currentFeed) => ({
      ...payload,
      papers: append ? [...currentFeed.papers, ...payload.papers] : payload.papers,
    }));
  });

  useEffect(() => {
    updateUrl(deferredQuery);

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    setLoadingSearch(true);

    void fetchFeedPage(deferredQuery, 1, false)
      .catch(() => {
        setFeed((currentFeed) => ({
          ...currentFeed,
          papers: [],
          page: 1,
          total: 0,
          hasMore: false,
          query: deferredQuery,
        }));
      })
      .finally(() => {
        setLoadingSearch(false);
      });
  }, [deferredQuery]);

  const loadMore = useEffectEvent(async () => {
    if (loadingSearch || loadingMore || !feed.hasMore) {
      return;
    }

    setLoadingMore(true);

    try {
      await fetchFeedPage(deferredQuery, feed.page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  });

  useEffect(() => {
    const node = sentinelRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        rootMargin: "320px 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [feed.hasMore, feed.page, loadingMore, loadingSearch, deferredQuery]);

  return (
    <section>
      <div className="max-w-[var(--content-width)]">
        <label htmlFor="paper-search" className="sr-only">
          Search papers, authors, or dates
        </label>
        <input
          id="paper-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search papers, authors, or dates"
          className="field-input h-12 text-[0.9375rem]"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span>
            {feed.total} {feed.total === 1 ? "paper" : "papers"}
            {feed.query ? ` for “${feed.query}”` : ""}
          </span>
          <span className="text-rule">&middot;</span>
          <Link href="/connect" className="hover:text-ink">
            Connect to publish from your agent
          </Link>
          {canPublish ? (
            <>
              <span className="text-rule">&middot;</span>
              <Link href="/publish" className="hover:text-ink">
                Open the web publisher
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-8 border-t border-rule">
        {feed.papers.length > 0 ? (
          feed.papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)
        ) : (
          <p className="py-16 text-center text-ink-light">
            {loadingSearch ? "Searching papers..." : "No papers match that search."}
          </p>
        )}
      </div>

      {(loadingSearch || loadingMore) && feed.papers.length > 0 ? (
        <p className="pt-6 text-sm text-ink-light">
          {loadingSearch ? "Refreshing feed..." : "Loading more papers..."}
        </p>
      ) : null}

      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
    </section>
  );
}
