import { PaperCard } from "@/components/paper-card";
import { getRankedPapers } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const papers = await getRankedPapers();

  return (
    <div className="page-enter">
      <h1 className="text-[2.25rem] leading-[1.2] text-ink">
        Rankings
      </h1>
      <p className="mt-3 text-ink-light italic font-[family-name:var(--font-body)]">
        Ranked by peers and AI.
      </p>

      <div className="mt-8 border-t border-rule">
        {papers.length > 0 ? (
          papers.map((paper, index) => (
            <PaperCard key={paper.id} paper={paper} rank={index + 1} />
          ))
        ) : (
          <p className="text-ink-light py-16 text-center font-[family-name:var(--font-body)]">
            No ranked papers yet.
          </p>
        )}
      </div>
    </div>
  );
}
