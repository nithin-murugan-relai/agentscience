import type { Metadata } from "next";

import { getRedisClient } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics · AgentScience",
  description:
    "Shared AgentScience usage analytics for the website and desktop app.",
};

type AnalyticsSource = {
  id: string;
  label: string;
  kind: string;
  status: string;
  description?: string | null;
};

type Snapshot = {
  generatedAt: string | null;
  range: {
    label: string;
    start: string | null;
    end: string | null;
  };
  sources: AnalyticsSource[];
  summary: {
    visitors: number;
    pageViews: number;
    bounceRate: number | null;
    accounts: number | null;
    platformUsers: number | null;
    papers: number | null;
    reviews: number | null;
    ideas: number | null;
    appUsers: number | null;
    downloads: number | null;
    countries: number;
  };
  timeseries: Array<{
    date: string;
    visitors?: number | null;
    pageViews?: number | null;
    appUsers?: number | null;
  }>;
  web: {
    project: {
      name: string;
      domain: string;
      environment: string;
      plan: string;
      lastDeployment: string | null;
      lastCommit: string | null;
    };
    pages: AnalyticsRow[];
    referrers: AnalyticsRow[];
    countries: AnalyticsRow[];
    devices: AnalyticsRow[];
    browsers: AnalyticsRow[];
    operatingSystems: AnalyticsRow[];
    events: AnalyticsRow[];
  };
  platform: {
    status: string;
    users: number | null;
    papers: number | null;
    reviews: number | null;
    ideas: number | null;
  };
  app: {
    status: string;
    activeUsers: number | null;
    launches: number | null;
    downloads: number | null;
    versions: AnalyticsRow[];
    platforms: AnalyticsRow[];
    countries: AnalyticsRow[];
  };
  notes: string[];
};

type AnalyticsRow = {
  label: string;
  value: number;
  share?: number | null;
  href?: string | null;
};

const EMPTY_SNAPSHOT: Snapshot = {
  generatedAt: null,
  range: {
    label: "Not synced",
    start: null,
    end: null,
  },
  sources: [
    {
      id: "agentscience-analytics",
      label: "AgentScience analytics",
      kind: "snapshot",
      status: "pending",
      description: "No analytics snapshot has been published yet.",
    },
  ],
  summary: {
    visitors: 0,
    pageViews: 0,
    bounceRate: null,
    accounts: null,
    platformUsers: null,
    papers: null,
    reviews: null,
    ideas: null,
    appUsers: null,
    downloads: null,
    countries: 0,
  },
  timeseries: [],
  web: {
    project: {
      name: "agentscience",
      domain: "agentscience.app",
      environment: "production",
      plan: "unknown",
      lastDeployment: null,
      lastCommit: null,
    },
    pages: [],
    referrers: [],
    countries: [],
    devices: [],
    browsers: [],
    operatingSystems: [],
    events: [],
  },
  platform: {
    status: "pending",
    users: null,
    papers: null,
    reviews: null,
    ideas: null,
  },
  app: {
    status: "pending",
    activeUsers: null,
    launches: null,
    downloads: null,
    versions: [],
    platforms: [],
    countries: [],
  },
  notes: ["Waiting for the Jetson analytics cron to publish a snapshot."],
};

async function getAnalyticsSnapshot(): Promise<Snapshot> {
  const client = await getRedisClient();
  const redisKey = process.env.ANALYTICS_REDIS_KEY ?? "agentscience:analytics:snapshot";
  const raw = await client?.get(redisKey);

  if (!raw) {
    return EMPTY_SNAPSHOT;
  }

  try {
    return JSON.parse(raw) as Snapshot;
  } catch (error) {
    console.error("Failed to parse analytics snapshot.", error);
    return {
      ...EMPTY_SNAPSHOT,
      notes: ["The stored analytics snapshot could not be parsed."],
    };
  }
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "Pending";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "Pending";
  return `${Math.round(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not synced";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAxisDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function trafficAxisTicks(maxValue: number) {
  return [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map(
    (value) => {
      const rounded = Math.round(value);
      return {
        value: rounded,
        top: `${(1 - rounded / maxValue) * 100}%`,
      };
    },
  );
}

function maxSeriesValue(data: Snapshot) {
  return Math.max(
    1,
    ...data.timeseries.flatMap((point) => [
      point.visitors ?? 0,
      point.pageViews ?? 0,
      point.appUsers ?? 0,
    ]),
  );
}

function chartPoints(data: Snapshot, metric: "visitors" | "pageViews" | "appUsers") {
  if (data.timeseries.length === 0) return "";
  const maxValue = maxSeriesValue(data);
  const width = 820;
  const height = 220;
  const step = data.timeseries.length > 1 ? width / (data.timeseries.length - 1) : 0;

  return data.timeseries
    .map((point, index) => {
      const value = point[metric] ?? 0;
      const x = index * step;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function areaPoints(data: Snapshot, metric: "visitors" | "pageViews" | "appUsers") {
  const points = chartPoints(data, metric);
  if (!points) return "";
  return `0,220 ${points} 820,220`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-rule px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </div>
      <div className="mt-2 text-3xl font-medium leading-none text-ink">{value}</div>
      <div className="mt-2 text-xs text-ink-light">{detail}</div>
    </div>
  );
}

function DataList({
  title,
  rows,
  empty,
  valueLabel = "Visitors",
}: {
  title: string;
  rows: AnalyticsRow[];
  empty: string;
  valueLabel?: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className="min-h-[260px] border border-rule bg-snow-white">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <span className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-faint">
          {valueLabel}
        </span>
      </div>
      <div className="space-y-1 p-3">
        {rows.length > 0 ? (
          rows.slice(0, 8).map((row) => (
            <div key={`${title}-${row.label}`} className="relative overflow-hidden rounded-[var(--radius-sm)] px-3 py-2">
              <div
                className="absolute inset-y-1 left-1 rounded-[var(--radius-sm)] bg-code-bg"
                style={{ width: `${Math.max(8, (row.value / maxValue) * 96)}%` }}
              />
              <div className="relative flex min-w-0 items-center justify-between gap-4 text-sm">
                <span className="truncate text-ink">{row.label}</span>
                <span className="shrink-0 font-medium text-ink">
                  {row.share !== null && row.share !== undefined
                    ? formatPercent(row.share)
                    : formatNumber(row.value)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex min-h-[190px] items-center justify-center px-4 text-center text-sm text-ink-light">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusPill({ source }: { source: AnalyticsSource }) {
  const isLive = source.status === "synced" || source.status === "live";

  return (
    <div className="flex items-start gap-3 border-l border-rule pl-4">
      <span
        className={`mt-1 h-2 w-2 rounded-full ${
          isLive ? "bg-accent" : "bg-ink-faint"
        }`}
      />
      <div>
        <div className="text-sm font-medium text-ink">{source.label}</div>
        <div className="text-xs text-ink-light">{source.description}</div>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsSnapshot();
  const generated = formatDate(data.generatedAt);
  const maxTrafficValue = maxSeriesValue(data);
  const firstTrafficDate = data.timeseries[0]?.date;
  const middleTrafficDate = data.timeseries[Math.floor(data.timeseries.length / 2)]?.date;
  const lastTrafficDate = data.timeseries.at(-1)?.date;
  const trafficTicks = trafficAxisTicks(maxTrafficValue);

  return (
    <div className="page-enter pb-10">
      <section className="flex flex-col gap-8 border-b border-rule pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Shared analytics
          </div>
          <h1 className="mt-3 text-4xl leading-tight text-ink sm:text-5xl">
            AgentScience usage
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-light">
            Website traffic, project health, and app adoption in one place for
            the open source team.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
          {data.sources.map((source) => (
            <StatusPill key={source.id} source={source} />
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-hidden border border-rule bg-snow-white">
        <div className="grid sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="Visitors"
            value={formatNumber(data.summary.visitors)}
            detail={data.range.label}
          />
          <MetricCard
            label="Page views"
            value={formatNumber(data.summary.pageViews)}
            detail="First-party web traffic"
          />
          <MetricCard
            label="Accounts"
            value={formatNumber(data.summary.accounts)}
            detail="Platform accounts"
          />
          <MetricCard
            label="Papers"
            value={formatNumber(data.summary.papers)}
            detail="Public papers in database"
          />
          <MetricCard
            label="Reviews"
            value={formatNumber(data.summary.reviews)}
            detail="Paper reviews in database"
          />
          <MetricCard
            label="Downloads"
            value={formatNumber(data.summary.downloads)}
            detail="Desktop release assets"
          />
        </div>

        <div className="border-t border-rule px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-ink">Traffic trend</h2>
              <p className="text-xs text-ink-light">
                Last sync: {generated} · {data.web.project.environment}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-ink-light">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Visitors
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-ink" />
                Page views
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-danger" />
                App users
              </span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-[1.75rem_3.25rem_minmax(0,1fr)] grid-rows-[260px_auto_auto] gap-x-2 gap-y-2">
            <div className="flex items-center justify-center text-[0.7rem] font-medium uppercase tracking-[0.08em] text-ink-faint [writing-mode:vertical-rl] [transform:rotate(180deg)]">
              Daily count
            </div>
            <div className="relative h-full text-right text-[0.68rem] text-ink-faint">
              {trafficTicks.map((tick, index) => (
                <span
                  key={`${tick.value}-${index}`}
                  className="absolute right-0 tabular-nums"
                  style={{ top: tick.top, transform: "translateY(-50%)" }}
                >
                  {formatNumber(tick.value)}
                </span>
              ))}
            </div>
            {data.timeseries.length > 0 ? (
              <div className="relative h-full overflow-hidden">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 820 220"
                  role="img"
                  aria-label="AgentScience traffic trend by date and daily count"
                  preserveAspectRatio="none"
                >
                  {trafficTicks.map((tick, index) => {
                    const y = 220 - (tick.value / maxTrafficValue) * 220;
                    return (
                      <line
                        key={`${tick.value}-${index}`}
                        x1="0"
                        x2="820"
                        y1={y}
                        y2={y}
                        stroke="#E5E5E5"
                        strokeWidth="1"
                      />
                    );
                  })}
                  <line
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="220"
                    stroke="#CFCFCF"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1="0"
                    x2="820"
                    y1="220"
                    y2="220"
                    stroke="#CFCFCF"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polygon points={areaPoints(data, "visitors")} fill="rgba(59,91,219,0.12)" />
                  <polyline
                    points={chartPoints(data, "pageViews")}
                    fill="none"
                    stroke="#1A1A1A"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={chartPoints(data, "visitors")}
                    fill="none"
                    stroke="#3b5bdb"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={chartPoints(data, "appUsers")}
                    fill="none"
                    stroke="#D64832"
                    strokeDasharray="5 6"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-rule text-center text-sm text-ink-light">
                No time series has been synced yet.
              </div>
            )}
            <div />
            <div />
            <div className="flex items-center justify-between text-[0.7rem] text-ink-faint">
              <span>{formatAxisDate(firstTrafficDate)}</span>
              <span>{formatAxisDate(middleTrafficDate)}</span>
              <span>{formatAxisDate(lastTrafficDate)}</span>
            </div>
            <div />
            <div />
            <div className="text-center text-[0.7rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Date
            </div>
          </div>
          <div className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-light">
            Analytics are current through {generated}. First-party event tracking
            started on May 3, 2026 at 7:07 PM EDT; traffic before that was not
            captured by this dashboard.
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <DataList
          title="Pages"
          rows={data.web.pages}
          empty="Import the Vercel Pages CSV export to populate top pages."
        />
        <DataList
          title="Referrers"
          rows={data.web.referrers}
          empty="Import the Vercel Referrers CSV export to populate sources."
        />
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-3">
        <DataList
          title="Countries"
          rows={data.web.countries}
          empty="Country breakdown will appear after sync."
        />
        <DataList
          title="Devices"
          rows={data.web.devices}
          empty="Device breakdown will appear after sync."
        />
        <DataList
          title="Operating systems"
          rows={data.web.operatingSystems}
          empty="OS breakdown will appear after sync."
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <DataList
          title="AgentScience App versions"
          rows={data.app.versions}
          empty="App analytics are ready for the desktop feed."
          valueLabel="Downloads"
        />
        <DataList
          title="AgentScience App platforms"
          rows={data.app.platforms}
          empty="Release download counts will appear after sync."
          valueLabel="Downloads"
        />
        <DataList
          title="Custom events"
          rows={data.web.events}
          empty="No custom events have been synced."
        />
      </section>

      <section className="mt-8 grid gap-4 border-t border-rule pt-6 text-sm text-ink-light lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-sm font-medium text-ink">Vercel project</h2>
          <div className="mt-2 grid gap-1">
            <div>{data.web.project.name} · {data.web.project.domain}</div>
            <div>Plan: {data.web.project.plan}</div>
            <div>Last deployment: {data.web.project.lastDeployment ?? "Not synced"}</div>
            <div>Last commit: {data.web.project.lastCommit ?? "Not synced"}</div>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">Sync notes</h2>
          <ul className="mt-2 grid gap-1">
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
