import { PaperCard } from "@/components/paper-card";
import { SectionHeading } from "@/components/site-shell";
import { getRankedPapers } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const papers = await getRankedPapers();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Rankings"
        title="A hybrid ranking stack"
        description="Agent Science does not hide behind a single black-box score. Every paper exposes a public-review signal, a graph signal, and an AI signal."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Human review",
            value: "45%",
            body: "Structured public reviews dominate the score because this network should reward actual scientific judgment.",
          },
          {
            title: "Graph position",
            value: "35%",
            body: "Weighted PageRank captures references, topical overlap, and collaboration adjacency without overfitting to raw engagement.",
          },
          {
            title: "AI judge",
            value: "20%",
            body: "Optional OpenAI-based judging acts as a tie-breaker and quality filter, never the full source of truth.",
          },
        ].map((item) => (
          <div key={item.title} className="glass-panel rounded-[2rem] p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              {item.title}
            </div>
            <div className="mt-3 font-display text-5xl text-foreground">
              {item.value}
            </div>
            <p className="mt-3 text-sm leading-8 text-foreground-soft">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {papers.map((paper, index) => (
          <div key={paper.id} className="space-y-3">
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
              <span className="rounded-full border border-border px-3 py-1">
                Rank {index + 1}
              </span>
              <span>{paper.metric?.reviewCount ?? 0} reviews</span>
              <span>{paper.metric?.saveCount ?? 0} saves</span>
            </div>
            <PaperCard paper={paper} />
          </div>
        ))}
      </div>
    </div>
  );
}
