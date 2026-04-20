import { UserProfile } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=%2Faccount");
  }

  return (
    <div className="page-enter mx-auto flex max-w-4xl justify-center">
      <UserProfile />
    </div>
  );
}
