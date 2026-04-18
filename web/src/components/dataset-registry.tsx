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
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>(ALL_PROVIDERS);

  // Live counts (this request) for each area: how many providers and datasets
  // actually match right now. These trump the DB-level counts on topic rows.
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

  // Topics visible in the secondary row, scoped to the active area.
  const visibleTopics = useMemo(() => {
    const filtered =
      areaFilter === ALL_AREAS ? topics : topics.filter((topic) => topic.area === areaFilter);
    return filtered
      .filter((topic) => topic.providerCount > 0 || topic.datasetCount > 0)
      .sort((a, b) => {
        if (b.providerCount !== a.providerCount) return b.providerCount - a.providerCount;
        return a.name.localeCompare(b.name);
      });
  }, [topics, areaFilter]);

  // Providers visible in the tertiary row: filtered by area + topic.
  const visibleProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (areaFilter !== ALL_AREAS) {
        if (!provider.topics.some((topic) => topic.area === areaFilter)) return false;
      }
      if (topicFilter !== ALL_TOPICS) {
        if (!provider.topics.some((topic) => topic.slug === topicFilter)) return false;
      }
      return true;
    });
  }, [providers, areaFilter, topicFilter]);

  // Filtered datasets: apply all taxonomy filters + search.
  const filteredDatasets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((dataset) => {
      if (areaFilter !== ALL_AREAS) {
        if (!dataset.topics.some((topic) => topic.area === areaFilter)) return false;
      }
      if (topicFilter !== ALL_TOPICS) {
        if (!dataset.topics.some((topic) => topic.slug === topicFilter)) return false;
      }
      if (providerFilter !== ALL_PROVIDERS && dataset.provider?.id !== providerFilter) {
        return false;
      }
      if (!q) return true;
      return (
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.domain.toLowerCase().includes(q) ||
        (dataset.provider?.name.toLowerCase().includes(q) ?? false) ||
        (dataset.sourcePaper?.title.toLowerCase().includes(q) ?? false) ||
        dataset.keywords.some((keyword) => keyword.toLowerCase().includes(q)) ||
        dataset.topics.some(
          (topic) =>
            topic.name.toLowerCase().includes(q) || topic.slug.toLowerCase().includes(q),
        )
      );
    });
  }, [datasets, query, areaFilter, topicFilter, providerFilter]);

  const selectedArea = useMemo(
    () => (areaFilter === ALL_AREAS ? null : areas.find((area) => area.key === areaFilter) ?? null),
    [areas, areaFilter],
  );
  const selectedTopic = useMemo(
    () => (topicFilter === ALL_TOPICS ? null : topics.find((topic) => topic.slug === topicFilter) ?? null),
    [topics, topicFilter],
  );
  const selectedProvider = useMemo(
    () =>
      providerFilter === ALL_PROVIDERS
        ? null
        : providers.find((provider) => provider.id === providerFilter) ?? null,
    [providers, providerFilter],
  );

  const handleSelectArea = (next: AreaFilter) => {
    setAreaFilter(next);
    setTopicFilter(ALL_TOPICS);
    setProviderFilter(ALL_PROVIDERS);
  };

  const handleSelectTopic = (next: TopicFilter) => {
    setTopicFilter(next);
    setProviderFilter(ALL_PROVIDERS);
  };

  const handleClearAll = () => {
    setAreaFilter(ALL_AREAS);
    setTopicFilter(ALL_TOPICS);
    setProviderFilter(ALL_PROVIDERS);
  };

  return (
    <section className="flex flex-col gap-10">
      <AreasRow
        areas={areas}
        areaCounts={areaCounts}
        datasetTotal={datasets.length}
        providerTotal={providers.length}
        activeArea={areaFilter}
        onSelect={handleSelectArea}
      />

      {visibleTopics.length > 0 ? (
        <TopicsRow
          topics={visibleTopics}
          activeTopic={topicFilter}
          activeArea={selectedArea}
          onSelect={handleSelectTopic}
        />
      ) : null}

      {visibleProviders.length > 0 ? (
        <ProvidersRow
          providers={visibleProviders}
          activeProvider={providerFilter}
          onSelect={setProviderFilter}
        />
      ) : null}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium text-ink">
            {buildDatasetListHeading({ selectedArea, selectedTopic, selectedProvider })}
          </h2>
          <span className="text-xs text-ink-faint tabular-nums">
            {filteredDatasets.length}{" "}
            {filteredDatasets.length === 1 ? "dataset" : "datasets"}
          </span>
        </div>

        <SelectionBreadcrumb
          selectedArea={selectedArea}
          selectedTopic={selectedTopic}
          selectedProvider={selectedProvider}
          onClear={handleClearAll}
        />

        <div className="mt-3">
          <label htmlFor="dataset-search" className="sr-only">
            Search
          </label>
          <input
            id="dataset-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, provider, topic, paper, or keyword"
            className="field-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mt-6 border-t border-rule">
          {filteredDatasets.length > 0 ? (
            filteredDatasets.map((dataset) => (
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

function buildDatasetListHeading({
  selectedArea,
  selectedTopic,
  selectedProvider,
}: {
  selectedArea: DatasetAreaMeta | null;
  selectedTopic: DatasetTopicListItem | null;
  selectedProvider: DatasetProviderListItem | null;
}): string {
  if (selectedProvider) {
    return `Datasets in ${selectedProvider.name}`;
  }
  if (selectedTopic) {
    return `Datasets in ${selectedTopic.name}`;
  }
  if (selectedArea) {
    return `Datasets in ${selectedArea.name}`;
  }
  return "Registered datasets";
}

function SelectionBreadcrumb({
  selectedArea,
  selectedTopic,
  selectedProvider,
  onClear,
}: {
  selectedArea: DatasetAreaMeta | null;
  selectedTopic: DatasetTopicListItem | null;
  selectedProvider: DatasetProviderListItem | null;
  onClear: () => void;
}) {
  if (!selectedArea && !selectedTopic && !selectedProvider) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
      <span>Filtered by:</span>
      {selectedArea ? (
        <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
          {selectedArea.name}
        </span>
      ) : null}
      {selectedTopic ? (
        <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
          {selectedTopic.name}
        </span>
      ) : null}
      {selectedProvider ? (
        <span className="rounded-full bg-snow-white-dark px-2 py-0.5 text-[0.6875rem] text-ink-light">
          {selectedProvider.name}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 rounded-full border border-rule px-2 py-0.5 text-[0.6875rem] text-ink-light transition-colors hover:border-ink-faint hover:text-ink"
      >
        Clear
      </button>
    </div>
  );
}

function AreasRow({
  areas,
  areaCounts,
  datasetTotal,
  providerTotal,
  activeArea,
  onSelect,
}: {
  areas: DatasetAreaMeta[];
  areaCounts: {
    providerByArea: Map<DatasetAreaKey, Set<string>>;
    datasetByArea: Map<DatasetAreaKey, Set<string>>;
  };
  datasetTotal: number;
  providerTotal: number;
  activeArea: AreaFilter;
  onSelect: (area: AreaFilter) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Fields of science</h2>
        <span className="text-xs text-ink-faint tabular-nums">
          {areas.length} {areas.length === 1 ? "area" : "areas"}
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-ink-light">
        Nine research areas. Pick one to zoom into its topics, providers, and datasets.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AreaTile
          title="All areas"
          description="Browse the full registry across every area."
          providerCount={providerTotal}
          datasetCount={datasetTotal}
          active={activeArea === ALL_AREAS}
          onClick={() => onSelect(ALL_AREAS)}
        />
        {areas.map((area) => {
          const providerCount = areaCounts.providerByArea.get(area.key)?.size ?? 0;
          const datasetCount = areaCounts.datasetByArea.get(area.key)?.size ?? 0;
          return (
            <AreaTile
              key={area.key}
              title={area.name}
              description={area.description}
              providerCount={providerCount}
              datasetCount={datasetCount}
              active={activeArea === area.key}
              dim={providerCount === 0}
              onClick={() => onSelect(area.key)}
            />
          );
        })}
      </div>
    </section>
  );
}

function AreaTile({
  title,
  description,
  providerCount,
  datasetCount,
  active,
  dim,
  onClick,
}: {
  title: string;
  description: string;
  providerCount: number;
  datasetCount: number;
  active: boolean;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "group flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint") +
        (dim && !active ? " opacity-60" : "")
      }
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-base leading-tight [text-wrap:balance]">
          {title}
        </span>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums " +
            (active
              ? "bg-snow-white/15 text-snow-white"
              : "bg-snow-white-dark text-ink-light")
          }
        >
          {providerCount} {providerCount === 1 ? "provider" : "providers"}
        </span>
      </div>
      <p
        className={
          "text-xs leading-snug " +
          (active ? "text-snow-white/80" : "text-ink-light")
        }
      >
        {description}
      </p>
      <span
        className={
          "text-[0.6875rem] tabular-nums " +
          (active ? "text-snow-white/60" : "text-ink-faint")
        }
      >
        {datasetCount} {datasetCount === 1 ? "dataset" : "datasets"}
      </span>
    </button>
  );
}

function TopicsRow({
  topics,
  activeTopic,
  activeArea,
  onSelect,
}: {
  topics: DatasetTopicListItem[];
  activeTopic: TopicFilter;
  activeArea: DatasetAreaMeta | null;
  onSelect: (slug: TopicFilter) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">
          {activeArea ? `Topics in ${activeArea.name}` : "All topics"}
        </h2>
        <span className="text-xs text-ink-faint tabular-nums">
          {topics.length} {topics.length === 1 ? "topic" : "topics"}
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-ink-light">
        Topics are multi-tag. A dataset may wear more than one and appear in several
        areas.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <TopicPill
          label="All topics"
          count={topics.reduce((sum, topic) => sum + topic.providerCount, 0)}
          active={activeTopic === ALL_TOPICS}
          onClick={() => onSelect(ALL_TOPICS)}
        />
        {topics.map((topic) => (
          <TopicPill
            key={topic.id}
            label={topic.name}
            count={topic.providerCount}
            active={activeTopic === topic.slug}
            onClick={() => onSelect(topic.slug)}
          />
        ))}
      </div>
    </section>
  );
}

function TopicPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink-light hover:border-ink-faint")
      }
    >
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums " +
          (active ? "bg-snow-white/15 text-snow-white" : "bg-snow-white-dark text-ink-faint")
        }
      >
        {count}
      </span>
    </button>
  );
}

function ProvidersRow({
  providers,
  activeProvider,
  onSelect,
}: {
  providers: DatasetProviderListItem[];
  activeProvider: ProviderFilter;
  onSelect: (id: ProviderFilter) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Providers</h2>
        <span className="text-xs text-ink-faint tabular-nums">
          {providers.length} {providers.length === 1 ? "provider" : "providers"}
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-ink-light">
        Compendia of datasets that agents can search inside. Tap a provider to filter
        the dataset list below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ProviderPill
          label="All providers"
          count={providers.reduce((sum, provider) => sum + provider.datasetCount, 0)}
          active={activeProvider === ALL_PROVIDERS}
          onClick={() => onSelect(ALL_PROVIDERS)}
        />
        {providers
          .slice()
          .sort((a, b) => {
            if (b.datasetCount !== a.datasetCount) return b.datasetCount - a.datasetCount;
            return a.name.localeCompare(b.name);
          })
          .map((provider) => (
            <ProviderPill
              key={provider.id}
              label={provider.name}
              count={provider.datasetCount}
              active={activeProvider === provider.id}
              onClick={() => onSelect(provider.id)}
            />
          ))}
      </div>
    </section>
  );
}

function ProviderPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-ink bg-ink text-snow-white"
          : "border-rule bg-snow-white text-ink hover:border-ink-faint")
      }
    >
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums " +
          (active ? "bg-snow-white/15 text-snow-white" : "bg-snow-white-dark text-ink-faint")
        }
      >
        {count}
      </span>
    </button>
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
          {dataset.topics.slice(0, 4).map((topic) => (
            <span
              key={topic.id}
              className="rounded-full border border-rule px-2 py-0.5 text-[0.6875rem] text-ink-light"
              title={`${topic.name} · ${topic.area.replaceAll("_", " ").toLowerCase()}`}
            >
              {topic.name}
            </span>
          ))}
          {dataset.keywords.slice(0, 3).map((keyword) => (
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
