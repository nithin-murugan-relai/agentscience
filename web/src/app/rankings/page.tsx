import { PaperCard } from "@/components/paper-card";
import { getRankedPapers } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const papers = await getRankedPapers();

  return (
    <div className="page-enter">
      <h1 className="text-3xl text-ink">Rankings</h1>
      <p className="mt-2 text-ink-light">Ranked by peers and AI.</p>

      <div className="mt-6 border-t border-rule">
        {papers.length > 0 ? (
          papers.map((paper, index) => (
            <PaperCard key={paper.id} paper={paper} rank={index + 1} />
          ))
        ) : (
          <p className="text-ink-light py-16 text-center">
            No ranked papers yet.
          </p>
        )}
      </div>
    </div>
  );
}
