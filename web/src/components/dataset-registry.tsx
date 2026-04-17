"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DatasetListItem, DatasetProviderListItem } from "@/lib/datasets";
import { formatDate } from "@/lib/utils";

const ALL_PROVIDERS = "__all__";
const UNASSIGNED_PROVIDER = "__unassigned__";

type ProviderFilter = typeof ALL_PROVIDERS | typeof UNASSIGNED_PROVIDER | string;

export function DatasetRegistry({
  datasets,
  providers,
}: {
  datasets: DatasetListItem[];
  providers: DatasetProviderListItem[];
}) {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>(ALL_PROVIDERS);

  const datasetCountsByProviderId = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const dataset of datasets) {
      if (dataset.provider) {
        counts.set(
          dataset.provider.id,
          (counts.get(dataset.provider.id) ?? 0) + 1,
        );
      } else {
        unassigned += 1;
      }
    }
    return { byId: counts, unassigned };
  }, [datasets]);

  const visibleProviders = useMemo(() => {
    return providers
      .map((provider) => ({
        ...provider,
        liveCount: datasetCountsByProviderId.byId.get(provider.id) ?? 0,
      }))
      .filter((provider) => provider.liveCount > 0 || provider.datasetCount > 0)
      .sort((a, b) => {
        if (b.liveCount !== a.liveCount) return b.liveCount - a.liveCount;
        return a.name.localeCompare(b.name);
      });
  }, [providers, datasetCountsByProviderId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((dataset) => {
      if (providerFilter === UNASSIGNED_PROVIDER && dataset.provider) {
        return false;
      }
      if (
        providerFilter !== ALL_PROVIDERS &&
        providerFilter !== UNASSIGNED_PROVIDER &&
        dataset.provider?.id !== providerFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.domain.toLowerCase().includes(q) ||
        dataset.provider?.name.toLowerCase().includes(q) ||
        dataset.sourcePaper?.title.toLowerCase().includes(q) ||
        dataset.keywords.some((keyword) => keyword.toLowerCase().includes(q))
      );
    });
  }, [datasets, query, providerFilter]);

  const selectedProvider =
    providerFilter === ALL_PROVIDERS || providerFilter === UNASSIGNED_PROVIDER
      ? null
      : providers.find((provider) => provider.id === providerFilter) ?? null;

  return (
    <section className="flex flex-col gap-10">
      {visibleProviders.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium text-ink">Providers</h2>
            <span className="text-xs text-ink-faint tabular-nums">
              {visibleProviders.length}{" "}
              {visibleProviders.length === 1 ? "compendium" : "compendia"}
            </span>
          </div>
          <p className="mt-1 max-w-prose text-sm text-ink-light">
            Compendia of datasets that agents can search inside. Click a provider to
            filter the dataset list below.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProviderAllTile
              active={providerFilter === ALL_PROVIDERS}
              datasetCount={datasets.length}
              onClick={() => setProviderFilter(ALL_PROVIDERS)}
            />
            {visibleProviders.map((provider) => (
              <ProviderTile
                key={provider.id}
                provider={provider}
                active={providerFilter === provider.id}
                onClick={() => setProviderFilter(provider.id)}
              />
            ))}
            {datasetCountsByProviderId.unassigned > 0 ? (
              <ProviderUnassignedTile
                active={providerFilter === UNASSIGNED_PROVIDER}
                datasetCount={datasetCountsByProviderId.unassigned}
                onClick={() => setProviderFilter(UNASSIGNED_PROVIDER)}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium text-ink">
            {selectedProvider
              ? `Datasets in ${selectedProvider.name}`
              : providerFilter === UNASSIGNED_PROVIDER
                ? "Datasets without a provider"
                : "Registered datasets"}
          </h2>
          <span className="text-xs text-ink-faint tabular-nums">
            {filtered.length} {filtered.length === 1 ? "dataset" : "datasets"}
          </span>
        </div>

        {selectedProvider ? (
          <ProviderSpotlight
            provider={selectedProvider}
            onClear={() => setProviderFilter(ALL_PROVIDERS)}
          />
        ) : null}

        <div className="mt-3">
          <label htmlFor="dataset-search" className="sr-only">
            Search
          </label>
          <input
            id="dataset-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, provider, paper, or keyword"
            className="field-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

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
    </section>
  );
}

function ProviderTile({
  provider,
  active,
  onClick,
}: {
  provider: DatasetProviderListItem & { liveCount: number };
  active: boolean;
  onClick: () => void;
}) {
  const count = provider.liveCount;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "group flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint")
      }
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-base leading-tight [text-wrap:balance]">
          {provider.name}
        </span>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums " +
            (active
              ? "bg-snow-white/15 text-snow-white"
              : "bg-snow-white-dark text-ink-light")
          }
        >
          {count} {count === 1 ? "dataset" : "datasets"}
        </span>
      </div>
      <p
        className={
          "text-xs leading-snug " + (active ? "text-snow-white/80" : "text-ink-light")
        }
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {provider.description}
      </p>
    </button>
  );
}

function ProviderAllTile({
  active,
  datasetCount,
  onClick,
}: {
  active: boolean;
  datasetCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint")
      }
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-base leading-tight">
          All providers
        </span>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums " +
            (active
              ? "bg-snow-white/15 text-snow-white"
              : "bg-snow-white-dark text-ink-light")
          }
        >
          {datasetCount} {datasetCount === 1 ? "dataset" : "datasets"}
        </span>
      </div>
      <p
        className={
          "text-xs leading-snug " + (active ? "text-snow-white/80" : "text-ink-light")
        }
      >
        Browse the full registry across every compendium.
      </p>
    </button>
  );
}

function ProviderUnassignedTile({
  active,
  datasetCount,
  onClick,
}: {
  active: boolean;
  datasetCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex h-full flex-col items-start gap-2 rounded-xl border border-dashed p-4 text-left transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint")
      }
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-base leading-tight">
          Unassigned
        </span>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums " +
            (active
              ? "bg-snow-white/15 text-snow-white"
              : "bg-snow-white-dark text-ink-light")
          }
        >
          {datasetCount} {datasetCount === 1 ? "dataset" : "datasets"}
        </span>
      </div>
      <p
        className={
          "text-xs leading-snug " + (active ? "text-snow-white/80" : "text-ink-light")
        }
      >
        Datasets not yet linked to a known provider.
      </p>
    </button>
  );
}

function ProviderSpotlight({
  provider,
  onClear,
}: {
  provider: DatasetProviderListItem;
  onClear: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-rule bg-snow-white-dark/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-display)] text-base leading-tight text-ink">
            {provider.name}
          </p>
          <p className="mt-1 text-sm text-ink-light [text-wrap:pretty]">
            {provider.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <a
              href={provider.homeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-light hover:text-accent [overflow-wrap:anywhere]"
            >
              {provider.domain}
            </a>
            {provider.searchKind ? (
              <>
                <span className="text-rule">&middot;</span>
                <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
                  Searchable via {provider.searchKind}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full border border-rule bg-snow-white px-3 py-1 text-xs text-ink-light transition-colors hover:border-ink-faint hover:text-ink"
        >
          Clear filter
        </button>
      </div>
    </div>
  );
}

function DatasetRow({ dataset }: { dataset: DatasetListItem }) {
  const formattedDate = formatDate(dataset.createdAt);
  const providerLabel = dataset.provider?.name ?? dataset.domain;

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
          {providerLabel ? (
            <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
              {providerLabel}
            </span>
          ) : null}
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
