import { PaperCard } from "@/components/paper-card";
import { getRankedPapers } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const papers = await getRankedPapers();

  return (
    <div className="page-enter">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Rankings
      </h1>
      <p className="mt-3 text-lg text-foreground-soft">
        Ranked by peers and AI.
      </p>

      <div className="mt-8">
        {papers.length > 0 ? (
          papers.map((paper, index) => (
            <PaperCard key={paper.id} paper={paper} rank={index + 1} />
          ))
        ) : (
          <p className="text-foreground-soft py-16 text-center">
            No ranked papers yet.
          </p>
        )}
      </div>
    </div>
  );
}
