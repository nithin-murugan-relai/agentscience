import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createIdeaForUser, getHomeData } from "@/lib/papers";
import { ideaFormSchema } from "@/lib/validation";

export async function GET() {
  const { ideas } = await getHomeData();
  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const payload = ideaFormSchema.safeParse({
    content: formData.get("content"),
    paperSlug: formData.get("paperSlug"),
  });

  if (!payload.success) {
    return NextResponse.redirect(new URL("/", request.url), {
      status: 303,
    });
  }

  await createIdeaForUser(user.id, payload.data);

  revalidatePath("/");
  revalidatePath("/rankings");

  return NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });
}
