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
      <section className="max-w-3xl pb-8">
        <div className="text-sm text-muted">{profile.role}</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          {profile.name}
        </h1>
        <p className="mt-1 text-sm text-muted">@{profile.handle}</p>
        {profile.institution ? (
          <p className="mt-3 text-foreground-soft">{profile.institution}</p>
        ) : null}
        {profile.bio ? (
          <p className="mt-3 max-w-2xl text-foreground-soft leading-relaxed">{profile.bio}</p>
        ) : null}
        {profile.researchInterests.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.researchInterests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border-t border-border py-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Papers
        </h2>
        {profile.authoredPapers.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-soft">No papers published yet.</p>
        ) : (
          <div className="mt-2">
            {profile.authoredPapers.map((authorship) => (
              <PaperCard key={authorship.paper.id} paper={authorship.paper} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
