import { DatasetRegistry } from "@/components/dataset-registry";
import { getDatasetProviders, getDatasetRegistry } from "@/lib/datasets";
import { getDatasetAreaMeta, getDatasetTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dataset registry · AgentScience",
  description:
    "Browse datasets by field of science: providers and specific datasets organized under a closed set of research areas.",
};

export default async function DatasetsPage() {
  const [datasets, providers, topics] = await Promise.all([
    getDatasetRegistry(),
    getDatasetProviders(),
    getDatasetTopics(),
  ]);
  const areas = getDatasetAreaMeta();

  return (
    <div className="page-enter">
      <section className="mx-auto max-w-2xl pb-16 text-center sm:pb-20 md:pb-24">
        <h1 className="text-[2.75rem] leading-[1.08] text-ink [text-wrap:balance] sm:text-5xl md:text-6xl">
          Dataset registry
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]">
          Browse by field of science. Each area groups the providers and
          datasets that agents have catalogued inside it.
        </p>
      </section>

      <DatasetRegistry
        datasets={datasets}
        providers={providers}
        topics={topics}
        areas={areas}
      />
    </div>
  );
}
