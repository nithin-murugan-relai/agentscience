"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DatasetListItem, DatasetProviderListItem } from "@/lib/datasets";
import type {
  DatasetAreaKey,
  DatasetAreaMeta,
  DatasetTopicListItem,
} from "@/lib/topics";
import { formatDate } from "@/lib/utils";

const ALL_AREAS = "__all_areas__" as const;
const ALL_TOPICS = "__all_topics__" as const;
const ALL_PROVIDERS = "__all_providers__" as const;

type AreaFilter = typeof ALL_AREAS | DatasetAreaKey;
type TopicFilter = typeof ALL_TOPICS | string;
type ProviderFilter = typeof ALL_PROVIDERS | string;

const RECENT_DATASET_PREVIEW_LIMIT = 5;

/**
 * Two display modes for the registry:
 *   1. "overview" — hero search + field grid + recent datasets preview.
 *   2. "area"     — a single field is selected; topic and source filters
 *                   unfold below and scope the list.
 *
 * The transition is progressive disclosure: filters only appear once the
 * user has committed to a field, so the default view carries one clear
 * decision ("pick a field or search").
 */
export function DatasetRegistry({
  datasets,
  providers,
  topics,
  areas,
}: {
  datasets: DatasetListItem[];
  providers: DatasetProviderListItem[];
  topics: DatasetTopicListItem[];
  areas: DatasetAreaMeta[];
}) {
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>(ALL_AREAS);
  const [topicFilter, setTopicFilter] = useState<TopicFilter>(ALL_TOPICS);
  const [providerFilter, setProviderFilter] =
    useState<ProviderFilter>(ALL_PROVIDERS);

  // Unique provider + dataset counts per area. A provider or dataset that
  // wears topics from multiple areas is counted once per area.
  const areaCounts = useMemo(() => {
    const providerByArea = new Map<DatasetAreaKey, Set<string>>();
    const datasetByArea = new Map<DatasetAreaKey, Set<string>>();
    for (const provider of providers) {
      for (const topic of provider.topics) {
        const bucket = providerByArea.get(topic.area) ?? new Set<string>();
        bucket.add(provider.id);
        providerByArea.set(topic.area, bucket);
      }
    }
    for (const dataset of datasets) {
      for (const topic of dataset.topics) {
        const bucket = datasetByArea.get(topic.area) ?? new Set<string>();
        bucket.add(dataset.id);
        datasetByArea.set(topic.area, bucket);
      }
    }
    return { providerByArea, datasetByArea };
  }, [providers, datasets]);

  const selectedArea = useMemo(
    () =>
      areaFilter === ALL_AREAS
        ? null
        : areas.find((area) => area.key === areaFilter) ?? null,
    [areas, areaFilter],
  );

  // Topics scoped to the active area, filtered to those that actually carry
  // a provider or dataset. "All topics" is always the first pill.
  const visibleTopics = useMemo(() => {
    if (!selectedArea) return [];
    return topics
      .filter((topic) => topic.area === selectedArea.key)
      .filter(
        (topic) => topic.providerCount > 0 || topic.datasetCount > 0,
      )
      .sort((a, b) => {
        if (b.providerCount !== a.providerCount) {
          return b.providerCount - a.providerCount;
        }
        return a.name.localeCompare(b.name);
      });
  }, [topics, selectedArea]);

  // Datasets matching the area + topic + provider + text filters. Computed
  // once and reused for both the listing and the "5 datasets" counter.
  const filteredDatasets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((dataset) => {
      if (selectedArea) {
        if (!dataset.topics.some((topic) => topic.area === selectedArea.key)) {
          return false;
        }
      }
      if (topicFilter !== ALL_TOPICS) {
        if (!dataset.topics.some((topic) => topic.slug === topicFilter)) {
          return false;
        }
      }
      if (providerFilter !== ALL_PROVIDERS) {
        if (dataset.provider?.id !== providerFilter) return false;
      }
      if (!q) return true;
      return (
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.domain.toLowerCase().includes(q) ||
        (dataset.provider?.name.toLowerCase().includes(q) ?? false) ||
        (dataset.sourcePaper?.title.toLowerCase().includes(q) ?? false) ||
        dataset.keywords.some((keyword) =>
          keyword.toLowerCase().includes(q),
        ) ||
        dataset.topics.some(
          (topic) =>
            topic.name.toLowerCase().includes(q) ||
            topic.slug.toLowerCase().includes(q),
        )
      );
    });
  }, [datasets, query, selectedArea, topicFilter, providerFilter]);

  // Source (provider) options in the area view. Empty sources stay visible
  // but dimmed — "yes we connect to PhysioNet, it just has 0 Life Sciences
  // rows right now" is a better message than making them appear and vanish.
  const providerOptions = useMemo(() => {
    if (!selectedArea) return [];

    const datasetCountPerProvider = new Map<string, number>();
    for (const dataset of datasets) {
      if (!dataset.provider) continue;
      const inArea = dataset.topics.some(
        (topic) => topic.area === selectedArea.key,
      );
      if (!inArea) continue;
      if (topicFilter !== ALL_TOPICS) {
        const inTopic = dataset.topics.some(
          (topic) => topic.slug === topicFilter,
        );
        if (!inTopic) continue;
      }
      datasetCountPerProvider.set(
        dataset.provider.id,
        (datasetCountPerProvider.get(dataset.provider.id) ?? 0) + 1,
      );
    }

    const options = providers
      .filter((provider) =>
        provider.topics.some((topic) => topic.area === selectedArea.key),
      )
      .filter((provider) => {
        if (topicFilter === ALL_TOPICS) return true;
        return provider.topics.some((topic) => topic.slug === topicFilter);
      })
      .map((provider) => ({
        provider,
        count: datasetCountPerProvider.get(provider.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.provider.name.localeCompare(b.provider.name);
      });

    return options;
  }, [providers, datasets, selectedArea, topicFilter]);

  const handleSelectArea = (next: AreaFilter) => {
    setAreaFilter(next);
    setTopicFilter(ALL_TOPICS);
    setProviderFilter(ALL_PROVIDERS);
  };

  const handleSelectTopic = (next: TopicFilter) => {
    setTopicFilter(next);
    setProviderFilter(ALL_PROVIDERS);
  };

  if (selectedArea) {
    return (
      <AreaView
        area={selectedArea}
        query={query}
        onQueryChange={setQuery}
        topics={visibleTopics}
        topicFilter={topicFilter}
        onSelectTopic={handleSelectTopic}
        providerOptions={providerOptions}
        providerFilter={providerFilter}
        onSelectProvider={setProviderFilter}
        datasets={filteredDatasets}
        onClearArea={() => handleSelectArea(ALL_AREAS)}
      />
    );
  }

  return (
    <OverviewView
      query={query}
      onQueryChange={setQuery}
      areas={areas}
      areaCounts={areaCounts}
      onSelectArea={(key) => handleSelectArea(key)}
      datasets={datasets}
      filteredDatasets={filteredDatasets}
    />
  );
}

/* ─────────────────── Overview (default) ─────────────────── */

function OverviewView({
  query,
  onQueryChange,
  areas,
  areaCounts,
  onSelectArea,
  datasets,
  filteredDatasets,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  areas: DatasetAreaMeta[];
  areaCounts: {
    providerByArea: Map<DatasetAreaKey, Set<string>>;
    datasetByArea: Map<DatasetAreaKey, Set<string>>;
  };
  onSelectArea: (key: DatasetAreaKey) => void;
  datasets: DatasetListItem[];
  filteredDatasets: DatasetListItem[];
}) {
  const hasQuery = query.trim().length > 0;
  const previewDatasets = hasQuery
    ? filteredDatasets
    : datasets.slice(0, RECENT_DATASET_PREVIEW_LIMIT);

  return (
    <section className="flex flex-col gap-16 sm:gap-20">
      <HeroSearch
        title="Find data for your research"
        subtitle="Search thousands of datasets, or browse by field below."
        query={query}
        onQueryChange={onQueryChange}
        placeholder={'Try "pediatric cancer" or "climate"'}
      />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-medium text-ink">Browse by field</h2>
          <span className="text-xs text-ink-faint">
            Pick one to narrow your search
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const providerCount =
              areaCounts.providerByArea.get(area.key)?.size ?? 0;
            const datasetCount =
              areaCounts.datasetByArea.get(area.key)?.size ?? 0;
            return (
              <AreaTile
                key={area.key}
                area={area}
                providerCount={providerCount}
                datasetCount={datasetCount}
                onClick={() => onSelectArea(area.key)}
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-medium text-ink">
            {hasQuery ? "Search results" : "Recent datasets"}
          </h2>
          {!hasQuery && datasets.length > RECENT_DATASET_PREVIEW_LIMIT ? (
            <span className="text-xs text-ink-faint">
              Showing {RECENT_DATASET_PREVIEW_LIMIT} of {datasets.length}
            </span>
          ) : (
            <span className="text-xs text-ink-faint tabular-nums">
              {previewDatasets.length}{" "}
              {previewDatasets.length === 1 ? "dataset" : "datasets"}
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-rule">
          {previewDatasets.length > 0 ? (
            previewDatasets.map((dataset) => (
              <DatasetRow
                key={dataset.id}
                dataset={dataset}
                mode="overview"
              />
            ))
          ) : (
            <p className="py-12 text-sm text-ink-light">
              {hasQuery
                ? "No datasets match that search yet. Try broader terms."
                : "No datasets registered yet."}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

/* ─────────────────── Area (drilldown) ─────────────────── */

function AreaView({
  area,
  query,
  onQueryChange,
  topics,
  topicFilter,
  onSelectTopic,
  providerOptions,
  providerFilter,
  onSelectProvider,
  datasets,
  onClearArea,
}: {
  area: DatasetAreaMeta;
  query: string;
  onQueryChange: (value: string) => void;
  topics: DatasetTopicListItem[];
  topicFilter: TopicFilter;
  onSelectTopic: (slug: TopicFilter) => void;
  providerOptions: Array<{
    provider: DatasetProviderListItem;
    count: number;
  }>;
  providerFilter: ProviderFilter;
  onSelectProvider: (id: ProviderFilter) => void;
  datasets: DatasetListItem[];
  onClearArea: () => void;
}) {
  const showTopicFilter = topics.length > 0;
  const showProviderFilter = providerOptions.length > 0;
  const selectedProvider =
    providerFilter === ALL_PROVIDERS
      ? null
      : providerOptions.find(
          (option) => option.provider.id === providerFilter,
        )?.provider ?? null;

  return (
    <section className="flex flex-col gap-12 sm:gap-14">
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={onClearArea}
          className="text-xs text-ink-light transition-colors hover:text-ink"
        >
          ← All fields
        </button>
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-ink sm:text-5xl [text-wrap:balance]">
          {area.name}
        </h1>
        {area.description ? (
          <p className="mx-auto max-w-lg text-sm text-ink-light sm:text-base [text-wrap:pretty]">
            {area.description}
          </p>
        ) : null}

        <div className="mt-4 w-full max-w-xl">
          <label htmlFor="dataset-search" className="sr-only">
            Search
          </label>
          <input
            id="dataset-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`Search within ${area.name}`}
            className="field-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </header>

      {showTopicFilter || showProviderFilter ? (
        <section className="flex flex-col gap-3">
          {showTopicFilter ? (
            <FilterRow
              label="Topic"
              options={[
                {
                  key: ALL_TOPICS,
                  label: "All",
                  count: topics.length,
                  active: topicFilter === ALL_TOPICS,
                  dim: false,
                  onClick: () => onSelectTopic(ALL_TOPICS),
                },
                ...topics.map((topic) => ({
                  key: topic.slug,
                  label: topic.name,
                  count: topic.datasetCount,
                  active: topicFilter === topic.slug,
                  dim: topic.datasetCount === 0,
                  onClick: () => onSelectTopic(topic.slug),
                })),
              ]}
            />
          ) : null}
          {showProviderFilter ? (
            <FilterRow
              label="Source"
              options={[
                {
                  key: ALL_PROVIDERS,
                  label: "All",
                  count: providerOptions.reduce(
                    (sum, option) => sum + option.count,
                    0,
                  ),
                  active: providerFilter === ALL_PROVIDERS,
                  dim: false,
                  onClick: () => onSelectProvider(ALL_PROVIDERS),
                },
                ...providerOptions.map(({ provider, count }) => ({
                  key: provider.id,
                  label: provider.name,
                  count,
                  active: providerFilter === provider.id,
                  dim: count === 0,
                  onClick: () => onSelectProvider(provider.id),
                })),
              ]}
            />
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-medium text-ink tabular-nums">
            {datasets.length}{" "}
            {datasets.length === 1 ? "dataset" : "datasets"}
          </h2>
          <span className="text-xs text-ink-faint">
            Sorted by most recent
          </span>
        </div>

        <div className="mt-4 border-t border-rule">
          {datasets.length > 0 ? (
            datasets.map((dataset) => (
              <DatasetRow key={dataset.id} dataset={dataset} mode="area" />
            ))
          ) : (
            <AreaEmptyState
              area={area}
              selectedProvider={selectedProvider}
              onClearProvider={() => onSelectProvider(ALL_PROVIDERS)}
              onClearArea={onClearArea}
              query={query}
            />
          )}
        </div>
      </section>
    </section>
  );
}

function AreaEmptyState({
  area,
  selectedProvider,
  onClearProvider,
  onClearArea,
  query,
}: {
  area: DatasetAreaMeta;
  selectedProvider: DatasetProviderListItem | null;
  onClearProvider: () => void;
  onClearArea: () => void;
  query: string;
}) {
  const hasQuery = query.trim().length > 0;
  const message = hasQuery
    ? `Nothing in ${area.name} matches that search yet.`
    : selectedProvider
      ? `No ${selectedProvider.name} datasets in ${area.name} yet.`
      : `No datasets catalogued in ${area.name} yet.`;

  return (
    <div className="flex flex-col items-start gap-4 py-10 text-sm text-ink-light">
      <p>{message}</p>
      <div className="flex flex-wrap gap-2">
        {selectedProvider ? (
          <button
            type="button"
            onClick={onClearProvider}
            className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink"
          >
            Show all {area.name} sources
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClearArea}
          className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink"
        >
          Browse all fields
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Shared sub-components ─────────────────── */

function HeroSearch({
  title,
  subtitle,
  query,
  onQueryChange,
  placeholder,
}: {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-ink sm:text-5xl [text-wrap:balance]">
        {title}
      </h1>
      <p className="max-w-lg text-sm text-ink-light sm:text-base [text-wrap:pretty]">
        {subtitle}
      </p>
      <div className="w-full max-w-xl">
        <label htmlFor="dataset-search" className="sr-only">
          Search
        </label>
        <input
          id="dataset-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="field-input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </header>
  );
}

function AreaTile({
  area,
  datasetCount,
  onClick,
}: {
  area: DatasetAreaMeta;
  providerCount: number;
  datasetCount: number;
  onClick: () => void;
}) {
  // Headline the browsable count. Seeded providers without datasets used
  // to surface as "4 providers" and then click into an empty list; the
  // overview now reflects only what the user can actually open.
  const empty = datasetCount === 0;
  const countLabel = empty
    ? "Empty"
    : `${datasetCount} ${datasetCount === 1 ? "dataset" : "datasets"}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Browse ${area.name}: ${countLabel}`}
      className={
        "flex h-full min-h-[78px] items-center justify-between gap-4 bg-snow-white px-5 py-4 text-left transition-colors hover:bg-snow-white-dark " +
        (empty ? "opacity-55" : "")
      }
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium leading-tight text-ink">
          {area.name}
        </span>
        <span className="text-xs text-ink-light">{countLabel}</span>
      </span>
      <span
        aria-hidden
        className="text-ink-faint transition-colors group-hover:text-ink"
      >
        →
      </span>
    </button>
  );
}

interface FilterOption {
  key: string;
  label: string;
  count: number;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}

function FilterRow({
  label,
  options,
}: {
  label: string;
  options: FilterOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {options.map((option) => (
          <FilterPill key={option.key} option={option} />
        ))}
      </div>
    </div>
  );
}

function FilterPill({ option }: { option: FilterOption }) {
  return (
    <button
      type="button"
      onClick={option.onClick}
      aria-pressed={option.active}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
        (option.active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint") +
        (!option.active && option.dim ? " opacity-55" : "")
      }
    >
      <span>{option.label}</span>
      <span
        className={
          "text-[0.6875rem] tabular-nums " +
          (option.active ? "text-snow-white/70" : "text-ink-faint")
        }
      >
        {option.count}
      </span>
    </button>
  );
}

function DatasetRow({
  dataset,
  mode,
}: {
  dataset: DatasetListItem;
  mode: "overview" | "area";
}) {
  const formattedDate = formatDate(dataset.createdAt);
  const providerLabel = dataset.provider?.name ?? dataset.domain;

  // In the overview view we lead with the broadest area tag so visitors
  // can see which field a dataset lives in. Inside an area, every row
  // shares that area so we swap in the most specific topic tag instead.
  const primaryTag =
    mode === "overview"
      ? dataset.topics[0]?.area.replaceAll("_", " ").toLowerCase() ?? null
      : dataset.topics[0]?.name ?? null;
  const formattedPrimaryTag = primaryTag
    ? primaryTag.replace(/\b\w/g, (char) => char.toUpperCase())
    : null;

  return (
    <article className="border-b border-rule py-5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6">
      <div className="flex min-w-0 flex-col gap-1.5 md:pr-2">
        <h3 className="text-[0.9375rem] font-medium leading-snug text-ink [text-wrap:balance]">
          <a
            href={dataset.url}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-accent"
          >
            {dataset.name}
          </a>
        </h3>
        {dataset.description ? (
          <p className="text-sm leading-relaxed text-ink-light [text-wrap:pretty]">
            {dataset.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-light">
          {formattedPrimaryTag ? (
            <span className="inline-flex items-center rounded-full border border-rule px-2 py-0.5 text-[0.6875rem] text-ink">
              {formattedPrimaryTag}
            </span>
          ) : null}
          {providerLabel ? (
            <span className="text-ink-light">{providerLabel}</span>
          ) : null}
          {dataset.sourcePaper ? (
            <>
              <span aria-hidden className="text-rule">
                ·
              </span>
              <Link
                href={`/papers/${dataset.sourcePaper.slug}`}
                className="text-ink-light transition-colors hover:text-ink"
              >
                {dataset.sourcePaper.title}
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 min-w-[4.5rem] shrink-0 text-left text-xs text-ink-faint md:mt-0 md:pt-0.5 md:text-right">
        <span className="tabular-nums">{formattedDate}</span>
      </div>
    </article>
  );
}
