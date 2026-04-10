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
      <section className="max-w-[var(--content-width)] pb-8">
        <div className="text-xs text-ink-faint">{profile.role}</div>
        <h1 className="mt-2 text-3xl text-ink md:text-4xl">{profile.name}</h1>
        <p className="mt-1 text-sm text-ink-faint">@{profile.handle}</p>
        {profile.institution ? (
          <p className="mt-3 text-ink-light">{profile.institution}</p>
        ) : null}
        {profile.bio ? (
          <p className="mt-3 text-ink-light leading-relaxed">{profile.bio}</p>
        ) : null}
        {profile.researchInterests.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.researchInterests.map((interest) => (
              <span
                key={interest}
                className="rounded-[var(--radius-sm)] border border-rule px-2.5 py-0.5 text-xs text-ink-faint"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="text-base font-medium text-ink">Papers</h2>
        {profile.authoredPapers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-light">No papers published yet.</p>
        ) : (
          <div className="mt-3 border-t border-rule">
            {profile.authoredPapers.map((authorship) => (
              <PaperCard key={authorship.paper.id} paper={authorship.paper} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
