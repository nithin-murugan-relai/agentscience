"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DatasetListItem } from "@/lib/datasets";
import { formatDate } from "@/lib/utils";

const ALL_DOMAINS = "All";

export function DatasetRegistry({ datasets }: { datasets: DatasetListItem[] }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<string>(ALL_DOMAINS);

  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dataset of datasets) {
      const key = dataset.domain.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [datasets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((dataset) => {
      if (domain !== ALL_DOMAINS && dataset.domain !== domain) return false;
      if (!q) return true;
      return (
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.domain.toLowerCase().includes(q) ||
        dataset.sourcePaper?.title.toLowerCase().includes(q) ||
        dataset.keywords.some((keyword) => keyword.toLowerCase().includes(q))
      );
    });
  }, [datasets, query, domain]);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Registered datasets</h2>
        <span className="text-xs text-ink-faint tabular-nums">
          {filtered.length} {filtered.length === 1 ? "dataset" : "datasets"}
        </span>
      </div>

      <div className="mt-3">
        <label htmlFor="dataset-search" className="sr-only">
          Search
        </label>
        <input
          id="dataset-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, domain, paper, or keyword"
          className="field-input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {domains.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <DomainPill
            label={ALL_DOMAINS}
            active={domain === ALL_DOMAINS}
            onClick={() => setDomain(ALL_DOMAINS)}
          />
          {domains.map((name) => (
            <DomainPill
              key={name}
              label={name}
              active={domain === name}
              onClick={() => setDomain(name)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6 border-t border-rule">
        {filtered.length > 0 ? (
          filtered.map((dataset) => (
            <DatasetRow key={dataset.id} dataset={dataset} />
          ))
        ) : (
          <p className="py-16 text-center text-ink-light">Nothing here yet.</p>
        )}
      </div>
    </section>
  );
}

function DomainPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink-light hover:text-ink hover:border-ink-faint")
      }
    >
      {label}
    </button>
  );
}

function DatasetRow({ dataset }: { dataset: DatasetListItem }) {
  const formattedDate = formatDate(dataset.createdAt);

  return (
    <article className="border-b border-rule py-5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-10">
      <div className="min-w-0 md:pr-2">
        <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink [text-wrap:balance]">
          <a
            href={dataset.url}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-accent"
          >
            {dataset.name}
          </a>
        </h3>
      </div>

      <div className="hidden min-w-[8rem] items-start justify-end pt-0.5 text-right text-xs text-ink-faint md:flex">
        <span className="tabular-nums">{formattedDate}</span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-ink-light md:col-span-2 md:mt-2">
        {dataset.description}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-faint md:col-span-2">
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
            {dataset.domain}
          </span>
          {dataset.keywords.slice(0, 4).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light"
            >
              {keyword}
            </span>
          ))}
        </span>

        {dataset.sourcePaper ? (
          <>
            <span className="text-rule">&middot;</span>
            <span className="[overflow-wrap:anywhere]">
              From{" "}
              <Link
                href={`/papers/${dataset.sourcePaper.slug}`}
                className="text-ink-light hover:text-accent"
              >
                {dataset.sourcePaper.title}
              </Link>
            </span>
          </>
        ) : null}

        {dataset.url ? (
          <>
            <span className="text-rule">&middot;</span>
            <a
              href={dataset.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-light hover:text-accent [overflow-wrap:anywhere]"
            >
              {dataset.domain}
            </a>
          </>
        ) : null}
      </div>
    </article>
  );
}
