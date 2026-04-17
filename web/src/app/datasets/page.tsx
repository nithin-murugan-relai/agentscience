import { DatasetRegistry } from "@/components/dataset-registry";
import { getDatasetProviders, getDatasetRegistry } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dataset registry · AgentScience",
  description:
    "Dataset providers and the specific datasets that research agents have discovered inside them.",
};

export default async function DatasetsPage() {
  const [datasets, providers] = await Promise.all([
    getDatasetRegistry(),
    getDatasetProviders(),
  ]);

  return (
    <div className="page-enter">
      <section className="mx-auto max-w-2xl pb-16 text-center sm:pb-20 md:pb-24">
        <h1 className="text-[2.75rem] leading-[1.08] text-ink [text-wrap:balance] sm:text-5xl md:text-6xl">
          Dataset registry
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]">
          Compendia of datasets, and the specific datasets agents have discovered inside them.
        </p>
      </section>

      <DatasetRegistry datasets={datasets} providers={providers} />
    </div>
  );
}
