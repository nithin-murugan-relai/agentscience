import { DatasetRegistry } from "@/components/dataset-registry";
import { getDatasetProviders, getDatasetRegistry } from "@/lib/datasets";
import { getDatasetAreaMeta, getDatasetTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dataset registry · AgentScience",
  description:
    "Search public research datasets or browse by field of science. Providers and specific datasets are catalogued under a closed set of research areas.",
};

export default async function DatasetsPage() {
  const [datasets, providers, topics] = await Promise.all([
    getDatasetRegistry(),
    getDatasetProviders(),
    getDatasetTopics(),
  ]);
  const areas = getDatasetAreaMeta();

  return (
    <div className="page-enter pt-4 sm:pt-6">
      <DatasetRegistry
        datasets={datasets}
        providers={providers}
        topics={topics}
        areas={areas}
      />
    </div>
  );
}
