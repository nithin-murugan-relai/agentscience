import { notFound } from "next/navigation";

import { AuthorHeader } from "@/components/author-header";
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
      <AuthorHeader author={profile} />

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
