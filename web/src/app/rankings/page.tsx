import { PaperCard } from "@/components/paper-card";
import { getRankedPapers } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const papers = await getRankedPapers();

  return (
    <div className="page-enter">
      <div className="pb-12 md:pb-16">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Rankings
        </h1>
        <p className="mt-3 text-lg text-foreground-soft">
          The best research, ranked by peers and AI.
        </p>
      </div>

      {papers.length > 0 ? (
        <div>
          {papers.map((paper, index) => (
            <PaperCard key={paper.id} paper={paper} rank={index + 1} />
          ))}
        </div>
      ) : (
        <p className="text-foreground-soft py-12 text-center">
          No ranked papers yet.
        </p>
      )}
    </div>
  );
}
