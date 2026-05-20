import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountPaperList } from "@/components/account-paper-list";
import { AuthorHeader } from "@/components/author-header";
import { getCurrentUser } from "@/lib/auth";
import { getAccountPapers } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function MyPapersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=%2Fpapers%2Fme");
  }

  const account = await getAccountPapers(user.id);

  if (!account) {
    notFound();
  }

  return (
    <div className="page-enter">
      <AuthorHeader author={account} />

      <section className="border-t border-rule py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-medium text-ink">Your papers</h2>
          <Link href="/publish" className="btn-primary w-fit">
            Publish
          </Link>
        </div>
        <AccountPaperList papers={account.authoredPapers.map((authorship) => authorship.paper)} />
      </section>
    </div>
  );
}
