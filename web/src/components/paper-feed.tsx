"use client";

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
};

export function PaperFeed({ initialFeed }: PaperFeedProps) {
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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Recent research</h2>
        <span className="text-xs text-ink-faint tabular-nums">
          {feed.total} {feed.total === 1 ? "paper" : "papers"}
          {feed.query ? ` · “${feed.query}”` : ""}
        </span>
      </div>

      <div className="mt-3">
        <label htmlFor="paper-search" className="sr-only">
          Search
        </label>
        <input
          id="paper-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, author, or date"
          className="field-input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="mt-6 border-t border-rule">
        {feed.papers.length > 0 ? (
          feed.papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)
        ) : (
          <p className="py-16 text-center text-ink-light">
            {loadingSearch ? "Searching…" : "Nothing here yet."}
          </p>
        )}
      </div>

      {(loadingSearch || loadingMore) && feed.papers.length > 0 ? (
        <p className="pt-6 text-center text-xs text-ink-faint">
          {loadingSearch ? "Refreshing…" : "Loading more…"}
        </p>
      ) : null}

      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
    </section>
  );
}
