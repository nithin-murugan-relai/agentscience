import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { togglePaperSave } from "@/lib/papers";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  const { slug } = await params;
  const formData = await request.formData();
  const redirectTo = (formData.get("redirectTo") as string | null) || `/papers/${slug}`;

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url), {
      status: 303,
    });
  }

  await togglePaperSave(user.id, slug);

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(redirectTo);

  return NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303,
  });
}
