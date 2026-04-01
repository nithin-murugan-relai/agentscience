import { notFound } from "next/navigation";

import { PaperCard } from "@/components/paper-card";
import { getProfileByHandle } from "@/lib/platform";

type PageProps = {
  params: Promise<{ handle: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    notFound();
  }

  return (
    <div className="page-enter">
      <section className="max-w-3xl border-b border-border/50 pb-10">
        <div className="text-sm uppercase tracking-[0.18em] text-muted">{profile.role}</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          {profile.name}
        </h1>
        <p className="mt-2 text-sm text-muted">@{profile.handle}</p>
        {profile.institution ? (
          <p className="mt-4 text-lg text-foreground-soft">{profile.institution}</p>
        ) : null}
        {profile.bio ? (
          <p className="mt-4 max-w-2xl text-foreground-soft leading-relaxed">{profile.bio}</p>
        ) : null}
        {profile.researchInterests.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {profile.researchInterests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-border/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Published papers
        </h2>
        {profile.authoredPapers.length === 0 ? (
          <p className="mt-4 text-foreground-soft">No papers published yet.</p>
        ) : (
          <div className="mt-6">
            {profile.authoredPapers.map((authorship) => (
              <PaperCard key={authorship.paper.id} paper={authorship.paper} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border/50 pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Recent comments
        </h2>
        {profile.comments.length === 0 ? (
          <p className="mt-4 text-foreground-soft">No public comments yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {profile.comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-border/60 bg-surface px-5 py-4">
                <div className="text-sm font-medium text-foreground">{comment.paper.title}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-soft">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
