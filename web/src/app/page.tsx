import Link from "next/link";

import { PaperCard } from "@/components/paper-card";
import { SectionHeading } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData } from "@/lib/papers";
import { formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ featured, recent, ideas, paperCount }, user] = await Promise.all([
    getHomeData(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-panel overflow-hidden rounded-[2.5rem] p-8 md:p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
            Scientific network
          </div>
          <h1 className="mt-5 max-w-4xl text-balance text-5xl leading-none text-foreground md:text-7xl">
            Papers first. Judgment second. Hype last.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-9 text-foreground-soft">
            Agent Science is the public layer for Sidekick. Scientists can ship
            AI-generated papers, keep the note trail visible, and rank work with
            a hybrid of public review, graph position, and optional LLM judgment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={user ? "/publish" : "/sign-up"}
              className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
            >
              {user ? "Publish a paper" : "Create an account"}
            </Link>
            <Link
              href="/rankings"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground-soft hover:border-accent hover:text-accent"
            >
              Inspect rankings
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Papers live",
                value: `${paperCount}`,
                note: "Published with public scoring and authorship.",
              },
              {
                label: "Scoring blend",
                value: "45 / 35 / 20",
                note: "Human review, graph position, then AI judgment.",
              },
              {
                label: "Sidekick path",
                value: "One token",
                note: "Direct publish endpoint for iPhone-generated drafts.",
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[1.75rem] bg-surface-muted p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                  {stat.label}
                </div>
                <div className="mt-3 font-display text-4xl text-foreground">
                  {stat.value}
                </div>
                <p className="mt-2 text-sm leading-7 text-foreground-soft">
                  {stat.note}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="glass-panel rounded-[2.5rem] p-8 md:p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            Why this exists
          </div>
          <div className="mt-5 space-y-5">
            {[
              "Sidekick can already turn raw notes into real draft papers. Agent Science is where those drafts get challenged in public.",
              "The feed is intentionally narrow: published work, lightweight note trails, and reviews that sharpen a paper rather than farm engagement.",
              "Ranking is transparent. Every score exposes its human, network, and AI components so 'AI slop' does not hide behind a single magic number.",
            ].map((item) => (
              <p key={item} className="text-sm leading-8 text-foreground-soft">
                {item}
              </p>
            ))}
          </div>

          {featured[0] ? (
            <div className="mt-8 rounded-[2rem] border border-border bg-surface-strong p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
                Current leader
              </div>
              <div className="mt-3 text-lg font-semibold text-foreground">
                {featured[0].title}
              </div>
              <div className="mt-3 text-sm leading-7 text-foreground-soft">
                Final score {formatScore(featured[0].metric?.finalScore)} with{" "}
                {featured[0].metric?.reviewCount ?? 0} public reviews.
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Front page"
          title="Featured papers"
          description="The top of the network should read like a serious scientific front page, not a scroll trap."
        />
        <div className="grid gap-6 xl:grid-cols-3">
          {featured.map((paper) => (
            <PaperCard key={paper.id} paper={paper} variant="feature" />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Recent"
            title="New on the network"
            description="Fresh papers still publish immediately; they just enter the network with transparent, revisable scores."
          />
          <div className="space-y-5">
            {recent.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <SectionHeading
            eyebrow="Lab notes"
            title="Idea trail"
            description="Keep the notes, but keep them subordinate to the paper. The feed is here to ground published work, not replace it."
          />

          {user ? (
            <form
              action="/api/ideas"
              method="post"
              className="glass-panel rounded-[2rem] p-5"
            >
              <textarea
                name="content"
                required
                minLength={20}
                maxLength={1000}
                placeholder="Leave a field note, a caveat, or a replication idea."
                className="min-h-[120px] w-full resize-y rounded-[1.5rem] border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              />
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-sm text-foreground-soft">
                  Notes can stand alone or attach to papers later.
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
                >
                  Post note
                </button>
              </div>
            </form>
          ) : (
            <div className="glass-panel rounded-[2rem] p-5 text-sm leading-7 text-foreground-soft">
              Sign in to attach field notes and review the papers you care about.
            </div>
          )}

          <div className="space-y-4">
            {ideas.map((idea) => (
              <article key={idea.id} className="glass-panel rounded-[2rem] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {idea.author.name}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                      @{idea.author.handle}
                    </div>
                  </div>
                  {idea.paper ? (
                    <Link
                      href={`/papers/${idea.paper.slug}`}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent hover:border-accent"
                    >
                      {idea.paper.title}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-8 text-foreground-soft">
                  {idea.content}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
